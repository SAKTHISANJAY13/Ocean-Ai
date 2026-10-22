from __future__ import annotations
import datetime
import jwt
import pytest
from ..config import settings
from ..security import create_access_token, decode_access_token, TokenExpiredException, TokenInvalidException


def test_valid_access_token_decoding():
    token = create_access_token(
        user_id="test-user-id-123",
        email="test@origin.org",
        name="Test Analyst",
        role="investigator",
    )
    payload = decode_access_token(token)
    assert payload["sub"] == "test-user-id-123"
    assert payload["email"] == "test@origin.org"
    assert payload["iss"] == settings.JWT_ISSUER
    assert payload["aud"] == settings.JWT_AUDIENCE
    assert payload["type"] == "access"


def test_expired_token_rejected():
    # Create token expired 1 hour ago
    expired_token = create_access_token(
        user_id="test-user-id-123",
        email="test@origin.org",
        name="Test Analyst",
        expires_delta=datetime.timedelta(minutes=-60),
    )
    with pytest.raises(TokenExpiredException):
        decode_access_token(expired_token)


def test_token_with_wrong_audience_rejected():
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": "test-user-123",
        "email": "test@origin.org",
        "name": "Test",
        "role": "investigator",
        "iss": settings.JWT_ISSUER,
        "aud": "wrong-audience-service",
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(minutes=15)).timestamp()),
        "jti": "random-jti",
        "type": "access",
    }
    bad_token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(TokenInvalidException):
        decode_access_token(bad_token)


def test_token_with_wrong_issuer_rejected():
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": "test-user-123",
        "email": "test@origin.org",
        "name": "Test",
        "role": "investigator",
        "iss": "untrusted-issuer",
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(minutes=15)).timestamp()),
        "jti": "random-jti",
        "type": "access",
    }
    bad_token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(TokenInvalidException):
        decode_access_token(bad_token)


def test_token_with_tampered_signature_rejected():
    valid_token = create_access_token(
        user_id="test-user-id-123",
        email="test@origin.org",
        name="Test Analyst",
    )
    # Tamper with the secret signature
    tampered_token = valid_token[:-4] + "abcd"
    with pytest.raises(TokenInvalidException):
        decode_access_token(tampered_token)


def test_token_signed_with_wrong_secret_rejected():
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": "test-user-123",
        "email": "test@origin.org",
        "name": "Test",
        "role": "investigator",
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(minutes=15)).timestamp()),
        "jti": "random-jti",
        "type": "access",
    }
    foreign_token = jwt.encode(payload, "different-unauthorized-secret-key-32b!", algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(TokenInvalidException):
        decode_access_token(foreign_token)


def test_malformed_token_string_rejected():
    with pytest.raises(TokenInvalidException):
        decode_access_token("not.a.valid.jwt.string")
