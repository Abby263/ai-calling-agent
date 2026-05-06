from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import httpx
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


@dataclass(frozen=True)
class ClerkUserProfile:
    email: str | None = None
    name: str | None = None
    picture: str | None = None


class ClerkAuthService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def session_payload(self, request: Request) -> dict[str, object]:
        auth_error: str | None = None
        try:
            session = self.get_session(request, raise_errors=True)
        except HTTPException as exc:
            session = None
            auth_error = str(exc.detail)
        return {
            "provider": "clerk",
            "auth_required": self.settings.auth_required,
            "auth_configured": self.settings.auth_configured,
            "authenticated": session is not None,
            "user": _public_user(session) if session else None,
            "billing": _billing_payload(request, self.settings, session),
            "auth_error": auth_error,
        }

    def require_user(self, request: Request) -> AuthenticatedUser | None:
        if not self.settings.auth_required:
            return None
        if not self.settings.auth_configured:
            raise HTTPException(
                status_code=503,
                detail="Authentication is required but Clerk is not configured.",
            )
        session = self.get_session(request, raise_errors=True)
        if session is None:
            raise HTTPException(status_code=401, detail="Sign in with Clerk is required.")
        return session

    def get_session(
        self,
        request: Request,
        *,
        raise_errors: bool = False,
    ) -> AuthenticatedUser | None:
        if not self.settings.auth_configured:
            return None
        token = self._session_token(request)
        if not token:
            return None
        try:
            claims = self._verify_token(token)
        except HTTPException:
            if raise_errors:
                raise
            return None

        subject = _optional_string(claims.get("sub"))
        if not subject:
            return None

        email = _email_from_claims(claims)
        name = _optional_string(claims.get("name"))
        picture = _optional_string(claims.get("picture"))
        if not email or not name or not picture:
            profile = _clerk_user_profile(self.settings.clerk_secret_key, subject)
            email = email or profile.email
            name = name or profile.name
            picture = picture or profile.picture
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
            picture=picture,
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


_CLERK_PROFILE_CACHE: dict[tuple[str, str], ClerkUserProfile] = {}


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _email_from_claims(claims: dict[str, object]) -> str | None:
    for key in ("email", "email_address", "primary_email_address"):
        email = _optional_string(claims.get(key))
        if email:
            return email
    return None


def _clerk_user_profile(secret_key: str | None, subject: str) -> ClerkUserProfile:
    if not secret_key or not subject:
        return ClerkUserProfile()
    cache_key = (secret_key, subject)
    if cache_key in _CLERK_PROFILE_CACHE:
        return _CLERK_PROFILE_CACHE[cache_key]
    try:
        response = httpx.get(
            f"https://api.clerk.com/v1/users/{subject}",
            headers={"Authorization": f"Bearer {secret_key}"},
            timeout=3,
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return ClerkUserProfile()
    if not isinstance(payload, dict):
        return ClerkUserProfile()
    profile = ClerkUserProfile(
        email=_primary_email_from_clerk_user(payload),
        name=_name_from_clerk_user(payload),
        picture=_optional_string(payload.get("image_url")),
    )
    if profile.email or profile.name or profile.picture:
        _CLERK_PROFILE_CACHE[cache_key] = profile
    return profile


def _primary_email_from_clerk_user(payload: dict[str, object]) -> str | None:
    email_addresses = payload.get("email_addresses")
    if not isinstance(email_addresses, list):
        return None

    primary_id = _optional_string(payload.get("primary_email_address_id"))
    first_email: str | None = None
    for item in email_addresses:
        if not isinstance(item, dict):
            continue
        email = _optional_string(item.get("email_address"))
        if not email:
            continue
        first_email = first_email or email
        if primary_id and item.get("id") == primary_id:
            return email
    return first_email


def _name_from_clerk_user(payload: dict[str, object]) -> str | None:
    first_name = _optional_string(payload.get("first_name"))
    last_name = _optional_string(payload.get("last_name"))
    full_name = " ".join(part for part in (first_name, last_name) if part)
    return full_name or _optional_string(payload.get("username"))


def _public_user(user: AuthenticatedUser | None) -> dict[str, str | None] | None:
    if not user:
        return None
    return {
        "id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
    }


def _billing_payload(
    request: Request,
    settings: Settings,
    user: AuthenticatedUser | None,
) -> dict[str, object]:
    if not user:
        return {
            "plan": "anonymous",
            "free_request_limit": settings.free_request_limit,
            "request_count": 0,
            "remaining_requests": 0,
            "unlimited": False,
        }

    email = user.email.lower() if user.email else None
    admin = user.subject in settings.admin_clerk_subjects or (
        email is not None and email in settings.admin_emails
    )
    paid = email is not None and email in settings.paid_user_emails
    request_count = request.app.state.store.get_request_count(user.user_id)
    unlimited = admin or paid
    remaining = None if unlimited else max(settings.free_request_limit - request_count, 0)
    return {
        "plan": "admin" if admin else "paid" if paid else "free",
        "free_request_limit": settings.free_request_limit,
        "request_count": request_count,
        "remaining_requests": remaining,
        "unlimited": unlimited,
    }
