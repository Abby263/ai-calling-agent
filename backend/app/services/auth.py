from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from time import time
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from app.core.config import Settings

AUTH_COOKIE = "vca_session"
OAUTH_STATE_COOKIE = "vca_oauth_state"
SESSION_TTL_SECONDS = 60 * 60 * 8
OAUTH_STATE_TTL_SECONDS = 60 * 10
VERCEL_AUTHORIZE_URL = "https://vercel.com/oauth/authorize"
VERCEL_TOKEN_URL = "https://api.vercel.com/login/oauth/token"
VERCEL_USERINFO_URL = "https://api.vercel.com/login/oauth/userinfo"


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    subject: str
    email: str | None
    name: str | None
    picture: str | None = None


class VercelOAuthService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def session_payload(self, request: Request) -> dict[str, object]:
        session = self.get_session(request)
        return {
            "auth_required": self.settings.auth_required,
            "auth_configured": self.settings.auth_configured,
            "authenticated": session is not None,
            "user": _public_user(session) if session else None,
        }

    def require_user(self, request: Request) -> AuthenticatedUser | None:
        if not self.settings.auth_required:
            return None
        if not self.settings.auth_configured:
            raise HTTPException(
                status_code=503,
                detail="Authentication is required but Vercel OAuth is not configured.",
            )
        session = self.get_session(request)
        if session is None:
            raise HTTPException(status_code=401, detail="Sign in is required to run tasks.")
        return session

    def get_session(self, request: Request) -> AuthenticatedUser | None:
        token = request.cookies.get(AUTH_COOKIE)
        payload = self._verify_signed_payload(token)
        if not payload:
            return None
        expires_at = payload.get("exp")
        if not isinstance(expires_at, int | float) or expires_at < time():
            return None
        user_id = payload.get("user_id")
        subject = payload.get("sub")
        if not isinstance(user_id, str) or not isinstance(subject, str):
            return None
        return AuthenticatedUser(
            user_id=user_id,
            subject=subject,
            email=_optional_string(payload.get("email")),
            name=_optional_string(payload.get("name")),
            picture=_optional_string(payload.get("picture")),
        )

    def begin_login(self, request: Request) -> RedirectResponse:
        self._ensure_configured()
        state = secrets.token_urlsafe(32)
        code_verifier = secrets.token_urlsafe(64)
        nonce = secrets.token_urlsafe(32)
        code_challenge = _base64url(hashlib.sha256(code_verifier.encode("utf-8")).digest())
        next_path = _safe_next_path(request.query_params.get("next"))
        redirect_uri = self._redirect_uri(request)
        state_payload = {
            "state": state,
            "code_verifier": code_verifier,
            "nonce": nonce,
            "next": next_path,
            "exp": time() + OAUTH_STATE_TTL_SECONDS,
        }
        params = {
            "client_id": self.settings.vercel_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        response = RedirectResponse(f"{VERCEL_AUTHORIZE_URL}?{urlencode(params)}", status_code=302)
        self._set_signed_cookie(
            response=response,
            name=OAUTH_STATE_COOKIE,
            payload=state_payload,
            max_age=OAUTH_STATE_TTL_SECONDS,
        )
        return response

    async def finish_login(self, request: Request) -> RedirectResponse:
        self._ensure_configured()
        error = request.query_params.get("error")
        if error:
            raise HTTPException(status_code=400, detail=f"Vercel sign-in failed: {error}")
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        state_payload = self._verify_signed_payload(request.cookies.get(OAUTH_STATE_COOKIE))
        if not code or not state or not state_payload or state_payload.get("state") != state:
            raise HTTPException(status_code=400, detail="Invalid or expired sign-in state.")

        token_data = await self._exchange_code(
            code=code,
            code_verifier=str(state_payload["code_verifier"]),
            redirect_uri=self._redirect_uri(request),
        )
        access_token = token_data.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise HTTPException(status_code=502, detail="Vercel did not return an access token.")

        profile = await self._fetch_userinfo(access_token)
        subject = profile.get("sub")
        if not isinstance(subject, str) or not subject:
            raise HTTPException(status_code=502, detail="Vercel did not return a user subject.")

        user_id = request.app.state.store.ensure_user(
            external_subject=f"vercel:{subject}",
            email=_optional_string(profile.get("email")),
            name=_optional_string(profile.get("name") or profile.get("preferred_username")),
        )
        session_payload = {
            "user_id": user_id,
            "sub": subject,
            "email": _optional_string(profile.get("email")),
            "name": _optional_string(profile.get("name") or profile.get("preferred_username")),
            "picture": _optional_string(profile.get("picture")),
            "exp": time() + SESSION_TTL_SECONDS,
        }
        response = RedirectResponse(
            _safe_next_path(_optional_string(state_payload.get("next"))),
            status_code=302,
        )
        self._set_signed_cookie(
            response=response,
            name=AUTH_COOKIE,
            payload=session_payload,
            max_age=SESSION_TTL_SECONDS,
        )
        response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
        return response

    def logout(self) -> Response:
        response = Response(status_code=204)
        response.delete_cookie(AUTH_COOKIE, path="/")
        response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
        return response

    async def _exchange_code(
        self,
        *,
        code: str,
        code_verifier: str,
        redirect_uri: str,
    ) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                VERCEL_TOKEN_URL,
                data={
                    "client_id": self.settings.vercel_client_id,
                    "client_secret": self.settings.vercel_client_secret,
                    "code": code,
                    "code_verifier": code_verifier,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
            )
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Failed to exchange Vercel sign-in code.")
        return response.json()

    async def _fetch_userinfo(self, access_token: str) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                VERCEL_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail="Failed to fetch Vercel user profile.")
        return response.json()

    def _redirect_uri(self, request: Request) -> str:
        base_url = self.settings.public_base_url.rstrip("/")
        if self.settings.app_env == "development":
            base_url = str(request.base_url).rstrip("/")
        return f"{base_url}/api/auth/callback"

    def _ensure_configured(self) -> None:
        if not self.settings.auth_configured:
            raise HTTPException(status_code=503, detail="Vercel OAuth is not configured.")

    def _set_signed_cookie(
        self,
        *,
        response: Response,
        name: str,
        payload: dict[str, object],
        max_age: int,
    ) -> None:
        response.set_cookie(
            key=name,
            value=self._sign_payload(payload),
            httponly=True,
            secure=self.settings.app_env == "production",
            samesite="lax",
            max_age=max_age,
            path="/",
        )

    def _sign_payload(self, payload: dict[str, object]) -> str:
        secret = self.settings.auth_session_secret
        if not secret:
            raise HTTPException(status_code=503, detail="Authentication secret is missing.")
        encoded = _base64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signature = hmac.new(
            secret.encode("utf-8"),
            encoded.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return f"{encoded}.{_base64url(signature)}"

    def _verify_signed_payload(self, token: str | None) -> dict[str, object] | None:
        secret = self.settings.auth_session_secret
        if not token or not secret or "." not in token:
            return None
        encoded, signature = token.rsplit(".", 1)
        expected = hmac.new(
            secret.encode("utf-8"),
            encoded.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(_base64url(expected), signature):
            return None
        try:
            return json.loads(_decode_base64url(encoded))
        except (json.JSONDecodeError, ValueError):
            return None


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode_base64url(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _safe_next_path(value: str | None) -> str:
    if value and value.startswith("/") and not value.startswith("//"):
        return value
    return "/app"


def _public_user(user: AuthenticatedUser | None) -> dict[str, str | None] | None:
    if not user:
        return None
    return {
        "id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
    }
