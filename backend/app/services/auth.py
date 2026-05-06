from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from fastapi import HTTPException, Request
from jwt import InvalidTokenError, PyJWKClient
from jwt import decode as jwt_decode
from jwt.exceptions import PyJWKClientError

from app.core.config import Settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    subject: str
    email: str | None = None
    name: str | None = None
    picture: str | None = None


class ClerkAuthService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def session_payload(self, request: Request) -> dict[str, object]:
        session = self.get_session(request)
        return {
            "provider": "clerk",
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
                detail="Authentication is required but Clerk is not configured.",
            )
        session = self.get_session(request)
        if session is None:
            raise HTTPException(status_code=401, detail="Sign in with Clerk is required.")
        return session

    def get_session(self, request: Request) -> AuthenticatedUser | None:
        if not self.settings.auth_configured:
            return None
        token = self._session_token(request)
        if not token:
            return None
        try:
            claims = self._verify_token(token)
        except HTTPException:
            return None

        subject = _optional_string(claims.get("sub"))
        if not subject:
            return None

        email = _optional_string(claims.get("email"))
        name = _optional_string(claims.get("name"))
        user_id = request.app.state.store.ensure_user(
            external_subject=f"clerk:{subject}",
            email=email,
            name=name,
        )
        return AuthenticatedUser(
            user_id=user_id,
            subject=subject,
            email=email,
            name=name,
            picture=_optional_string(claims.get("picture")),
        )

    def _session_token(self, request: Request) -> str | None:
        authorization = request.headers.get("authorization", "")
        if authorization.lower().startswith("bearer "):
            return authorization.split(" ", 1)[1].strip()
        return request.cookies.get("__session")

    def _verify_token(self, token: str) -> dict[str, object]:
        try:
            signing_key = _jwks_client(
                self.settings.clerk_jwks_endpoint,
                self.settings.clerk_secret_key,
            ).get_signing_key_from_jwt(token)
            decode_kwargs: dict[str, object] = {
                "key": signing_key.key,
                "algorithms": ["RS256"],
                "options": {"verify_aud": False},
            }
            if self.settings.clerk_jwt_issuer:
                decode_kwargs["issuer"] = self.settings.clerk_jwt_issuer
            claims = jwt_decode(token, **decode_kwargs)
        except (InvalidTokenError, PyJWKClientError) as exc:
            raise HTTPException(status_code=401, detail="Invalid Clerk session token.") from exc

        authorized_parties = self.settings.clerk_authorized_parties
        authorized_party = claims.get("azp")
        if authorized_party and authorized_party not in authorized_parties:
            raise HTTPException(status_code=401, detail="Invalid Clerk authorized party.")
        status = claims.get("sts")
        if status == "pending":
            raise HTTPException(status_code=403, detail="Clerk account setup is incomplete.")
        return claims


@lru_cache(maxsize=8)
def _jwks_client(jwks_url: str, secret_key: str | None) -> PyJWKClient:
    headers = {"Authorization": f"Bearer {secret_key}"} if secret_key else None
    return PyJWKClient(jwks_url, headers=headers)


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _public_user(user: AuthenticatedUser | None) -> dict[str, str | None] | None:
    if not user:
        return None
    return {
        "id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
    }
