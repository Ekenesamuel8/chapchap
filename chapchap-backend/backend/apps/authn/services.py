from dataclasses import dataclass
from typing import Any

from django.conf import settings
from google.auth.transport.requests import Request
from google.oauth2 import id_token


class GoogleAuthTimeoutRequest(Request):
    def __call__(
        self,
        url,
        method="GET",
        body=None,
        headers=None,
        timeout=120,
        **kwargs,
    ):
        configured_timeout = settings.GOOGLE_AUTH_HTTP_TIMEOUT_SECONDS
        return super().__call__(
            url,
            method=method,
            body=body,
            headers=headers,
            timeout=min(timeout, configured_timeout),
            **kwargs,
        )


class GoogleAuthError(Exception):
    """Base exception for Google authentication failures."""


class GoogleAuthConfigurationError(GoogleAuthError):
    """Raised when Google auth settings are incomplete."""


class InvalidGoogleTokenError(GoogleAuthError):
    """Raised when a Google ID token is invalid."""


class UnverifiedGoogleEmailError(GoogleAuthError):
    """Raised when a Google account email is not verified."""


@dataclass(frozen=True)
class GoogleUserInfo:
    sub: str
    email: str
    name: str
    picture: str
    email_verified: bool


def verify_google_id_token(token: str) -> GoogleUserInfo:
    if not token.strip():
        raise InvalidGoogleTokenError("Invalid Google ID token.")

    audience = settings.GOOGLE_CLIENT_ID or None
    if settings.GOOGLE_OAUTH_VERIFY_AUDIENCE and not audience:
        raise GoogleAuthConfigurationError(
            "Google authentication is not configured correctly."
        )

    try:
        if not settings.GOOGLE_OAUTH_VERIFY_AUDIENCE:
            audience = None

        payload: dict[str, Any] = id_token.verify_oauth2_token(
            token,
            GoogleAuthTimeoutRequest(),
            audience=audience,
        )
    except Exception as exc:  # noqa: BLE001
        raise InvalidGoogleTokenError("Invalid Google ID token.") from exc

    email = str(payload.get("email", "")).strip().lower()
    provider_user_id = str(payload.get("sub", "")).strip()
    email_verified = bool(payload.get("email_verified"))

    if not provider_user_id or not email:
        raise InvalidGoogleTokenError("Invalid Google ID token.")

    if not email_verified:
        raise UnverifiedGoogleEmailError("Google account email is not verified.")

    return GoogleUserInfo(
        sub=provider_user_id,
        email=email,
        name=str(payload.get("name", "")).strip(),
        picture=str(payload.get("picture", "")).strip(),
        email_verified=email_verified,
    )
