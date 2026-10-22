from __future__ import annotations
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .database import get_user_by_id, get_investigation_by_id
from .security import (
    decode_access_token,
    verify_csrf_token,
    TokenExpiredException,
    TokenInvalidException,
)

# Optional HTTPBearer scheme (does not auto-error so we can also check cookies)
security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    bearer_auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Dict[str, Any]:
    """
    Extract and validate the authenticated user from HttpOnly cookie or Authorization Bearer header.
    Validates token claims, database existence, active status, and CSRF protection on mutating requests.
    """
    token: Optional[str] = None
    is_cookie_auth = False

    # 1. Check Authorization Bearer header
    if bearer_auth and bearer_auth.credentials:
        token = bearer_auth.credentials
    # 2. Check HttpOnly access cookie
    elif settings.COOKIE_ACCESS_NAME in request.cookies:
        token = request.cookies[settings.COOKIE_ACCESS_NAME]
        is_cookie_auth = True

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3. Decode and validate JWT access token
    try:
        payload = decode_access_token(token)
    except TokenExpiredException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"The access token expired\""},
        )
    except TokenInvalidException as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {e}",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: missing subject claim",
        )

    # 4. Lookup user in persistent database
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this session no longer exists",
        )

    if not user.get("is_active"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # 5. Enforce CSRF protection for cookie-based state-changing requests
    if is_cookie_auth and request.method in ("POST", "PUT", "PATCH", "DELETE"):
        csrf_cookie = request.cookies.get(settings.COOKIE_CSRF_NAME)
        csrf_header = request.headers.get("X-CSRF-Token")

        if not verify_csrf_token(csrf_cookie, csrf_header):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token validation failed for state-changing request",
            )

    return user


async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """Dependency ensuring user is active."""
    return current_user


async def verify_investigation_ownership(
    investigation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Server-side authorization check verifying that the investigation exists
    and belongs to the authenticated user or system baseline (or user has admin privileges).
    """
    investigation = get_investigation_by_id(investigation_id)
    if not investigation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation with ID '{investigation_id}' not found",
        )

    if (
        investigation["user_id"] != "system"
        and investigation["user_id"] != current_user["id"]
        and current_user.get("role") != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access or modify this investigation",
        )

    return investigation
