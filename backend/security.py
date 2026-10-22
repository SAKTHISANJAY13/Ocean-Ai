from __future__ import annotations
import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import argon2
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError, InvalidIssuerError, InvalidAudienceError

from .config import settings

# Initialize Argon2id password hasher with secure, production-grade parameters
password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MiB
    parallelism=4,
    hash_len=32,
    type=Type.ID,
)


class SecurityException(Exception):
    """Base exception for security and authentication failures."""
    pass


class TokenExpiredException(SecurityException):
    """Raised when a JWT has expired."""
    pass


class TokenInvalidException(SecurityException):
    """Raised when a JWT is malformed, has invalid claims, or failed signature check."""
    pass


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash in constant time."""
    try:
        return password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if the hash needs upgrading to newer hasher parameters."""
    return password_hasher.check_needs_rehash(hashed_password)


def normalize_email(email: str) -> str:
    """Trim and lowercase email addresses."""
    return email.strip().lower()


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Validate password meets minimum security strength requirements."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number."
    return True, ""


def create_access_token(
    user_id: str,
    email: str,
    name: str,
    role: str = "investigator",
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Issue a signed JWT access token with full standard claims."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    payload: Dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": uuid.uuid4().hex,
        "type": "access",
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(
    user_id: str,
    family_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str, str, str]:
    """
    Issue a signed JWT refresh token and calculate its SHA-256 hash for database storage.
    Returns: (raw_token, token_hash, family_id, expires_at_iso)
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    fam_id = family_id or uuid.uuid4().hex

    payload: Dict[str, Any] = {
        "sub": user_id,
        "family_id": fam_id,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "jti": uuid.uuid4().hex,
        "type": "refresh",
    }

    raw_token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    token_hash = hash_token(raw_token)
    return raw_token, token_hash, fam_id, expire.isoformat()


def hash_token(token: str) -> str:
    """Generate SHA-256 hash of a raw token for safe database persistence."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and strictly validate an access token's signature, issuer, audience, and expiration."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
                "verify_aud": True,
                "require": ["exp", "iat", "iss", "aud", "sub", "type"],
            },
        )
        if payload.get("type") != "access":
            raise TokenInvalidException("Token is not an access token")
        return payload
    except ExpiredSignatureError as e:
        raise TokenExpiredException("Access token has expired") from e
    except (InvalidIssuerError, InvalidAudienceError) as e:
        raise TokenInvalidException(f"Invalid token claim: {e}") from e
    except InvalidTokenError as e:
        raise TokenInvalidException(f"Invalid token: {e}") from e


def decode_refresh_token(token: str) -> Dict[str, Any]:
    """Decode and strictly validate a refresh token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
                "verify_aud": True,
                "require": ["exp", "iat", "iss", "aud", "sub", "type", "family_id"],
            },
        )
        if payload.get("type") != "refresh":
            raise TokenInvalidException("Token is not a refresh token")
        return payload
    except ExpiredSignatureError as e:
        raise TokenExpiredException("Refresh token has expired") from e
    except (InvalidIssuerError, InvalidAudienceError) as e:
        raise TokenInvalidException(f"Invalid token claim: {e}") from e
    except InvalidTokenError as e:
        raise TokenInvalidException(f"Invalid token: {e}") from e


def generate_csrf_token() -> str:
    """Generate a high-entropy CSRF double-submit token."""
    return secrets.token_urlsafe(32)


def verify_csrf_token(cookie_token: Optional[str], header_token: Optional[str]) -> bool:
    """Verify CSRF token using constant-time comparison."""
    if not cookie_token or not header_token:
        return False
    return hmac.compare_digest(cookie_token, header_token)
