from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from ..config import settings
from ..database import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    store_refresh_token,
    get_refresh_token,
    revoke_refresh_token,
    revoke_refresh_token_family,
)
from ..dependencies import get_current_user
from ..models.auth import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    TokenResponse,
    MessageResponse,
    CSRFResponse,
)
from ..rate_limiter import login_rate_limiter
from ..security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_token,
    generate_csrf_token,
    TokenExpiredException,
    TokenInvalidException,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
) -> None:
    """Helper to set hardened authentication and CSRF cookies."""
    # HttpOnly Access Token
    response.set_cookie(
        key=settings.COOKIE_ACCESS_NAME,
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    # HttpOnly Refresh Token restricted to /api/auth
    response.set_cookie(
        key=settings.COOKIE_REFRESH_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/auth",
    )
    # Readable CSRF Token for Double-Submit Header
    response.set_cookie(
        key=settings.COOKIE_CSRF_NAME,
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Helper to cleanly purge all authentication and CSRF cookies."""
    response.delete_cookie(
        key=settings.COOKIE_ACCESS_NAME,
        path="/",
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.COOKIE_REFRESH_NAME,
        path="/api/auth",
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=settings.COOKIE_CSRF_NAME,
        path="/",
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new investigator account",
)
async def register(
    req: RegisterRequest,
    response: Response,
) -> TokenResponse:
    # 1. Normalize and check for existing account
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists",
        )

    # 2. Hash password securely with Argon2id
    hashed = hash_password(req.password)

    # 3. Store in persistent database
    user = create_user(
        name=req.name,
        email=req.email,
        hashed_password=hashed,
        role="investigator",
    )

    # 4. Generate access & refresh tokens
    access_token = create_access_token(
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
    )
    raw_refresh, token_hash, family_id, expires_at = create_refresh_token(user_id=user["id"])
    store_refresh_token(
        user_id=user["id"],
        token_hash=token_hash,
        family_id=family_id,
        expires_at=expires_at,
    )

    # 5. Generate CSRF token and set secure cookies
    csrf_token = generate_csrf_token()
    _set_auth_cookies(response, access_token, raw_refresh, csrf_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(**user),
        csrf_token=csrf_token,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate investigator with credentials",
)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"

    # 1. Check Rate Limiter
    allowed, retry_after = login_rate_limiter.check_rate_limit(client_ip, req.email)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # 2. Lookup user
    user = get_user_by_email(req.email)
    if not user:
        login_rate_limiter.record_failure(client_ip, req.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # 3. Verify Argon2id password hash
    if not verify_password(req.password, user["hashed_password"]):
        login_rate_limiter.record_failure(client_ip, req.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # 4. Check account active status
    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact system administrator.",
        )

    # Successful login: reset rate limit tracking
    login_rate_limiter.record_success(client_ip, req.email)

    # 5. Issue JWT tokens
    access_token = create_access_token(
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
    )
    raw_refresh, token_hash, family_id, expires_at = create_refresh_token(user_id=user["id"])
    store_refresh_token(
        user_id=user["id"],
        token_hash=token_hash,
        family_id=family_id,
        expires_at=expires_at,
    )

    # 6. Issue CSRF token and set session cookies
    csrf_token = generate_csrf_token()
    _set_auth_cookies(response, access_token, raw_refresh, csrf_token)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            is_active=bool(user["is_active"]),
            created_at=user["created_at"],
        ),
        csrf_token=csrf_token,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and issue fresh access token",
)
async def refresh_session(
    request: Request,
    response: Response,
) -> TokenResponse:
    # 1. Retrieve refresh token from cookie or Authorization header fallback
    raw_refresh = request.cookies.get(settings.COOKIE_REFRESH_NAME)
    if not raw_refresh:
        # Check header if cookie not sent
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_refresh = auth_header.replace("Bearer ", "").strip()

    if not raw_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
        )

    # 2. Decode and validate token structure & expiration
    try:
        payload = decode_refresh_token(raw_refresh)
    except TokenExpiredException:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired. Please sign in again.",
        )
    except TokenInvalidException as e:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid refresh token: {e}",
        )

    token_hash = hash_token(raw_refresh)
    stored_token = get_refresh_token(token_hash)
    if not stored_token:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unrecognized refresh token",
        )

    # 3. Automatic Reuse Detection
    if stored_token.get("revoked_at") is not None:
        # Re-use of an already revoked token! Revoke the entire family immediately
        family_id = stored_token["family_id"]
        revoke_refresh_token_family(family_id)
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token reuse detected. All sessions in this family revoked.",
        )

    # 4. Check expiration in DB
    now = datetime.now(timezone.utc)
    token_exp = datetime.fromisoformat(stored_token["expires_at"])
    if token_exp < now:
        revoke_refresh_token(token_hash)
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )

    # 5. Lookup user
    user = get_user_by_id(stored_token["user_id"])
    if not user or not user.get("is_active"):
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account inactive or missing",
        )

    # 6. Rotate: revoke old token and issue new token pair within same family
    revoke_refresh_token(token_hash)
    new_raw_refresh, new_token_hash, family_id, new_expires_at = create_refresh_token(
        user_id=user["id"],
        family_id=stored_token["family_id"],
    )
    store_refresh_token(
        user_id=user["id"],
        token_hash=new_token_hash,
        family_id=family_id,
        expires_at=new_expires_at,
    )

    new_access_token = create_access_token(
        user_id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
    )

    new_csrf_token = generate_csrf_token()
    _set_auth_cookies(response, new_access_token, new_raw_refresh, new_csrf_token)

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            role=user["role"],
            is_active=bool(user["is_active"]),
            created_at=user["created_at"],
        ),
        csrf_token=new_csrf_token,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke session and clear cookies",
)
async def logout(
    request: Request,
    response: Response,
) -> MessageResponse:
    # Attempt to revoke the refresh token in the database if present
    raw_refresh = request.cookies.get(settings.COOKIE_REFRESH_NAME)
    if raw_refresh:
        token_hash = hash_token(raw_refresh)
        revoke_refresh_token(token_hash)

    # Purge all session cookies
    _clear_auth_cookies(response)
    return MessageResponse(message="Investigator session terminated successfully")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve profile of the currently authenticated investigator",
)
async def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> UserResponse:
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user["email"],
        role=current_user["role"],
        is_active=bool(current_user["is_active"]),
        created_at=current_user["created_at"],
    )


@router.get(
    "/csrf",
    response_model=CSRFResponse,
    summary="Get or initialize CSRF token for state-changing browser requests",
)
async def get_csrf(
    request: Request,
    response: Response,
) -> CSRFResponse:
    existing_csrf = request.cookies.get(settings.COOKIE_CSRF_NAME)
    if not existing_csrf:
        existing_csrf = generate_csrf_token()
        response.set_cookie(
            key=settings.COOKIE_CSRF_NAME,
            value=existing_csrf,
            httponly=False,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
            path="/",
        )
    return CSRFResponse(csrf_token=existing_csrf)
