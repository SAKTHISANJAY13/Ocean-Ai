from __future__ import annotations
import pytest
from ..database import get_user_by_email
from ..security import verify_password


def test_user_registration_success(client):
    payload = {
        "name": "Dr. Sarah Connor",
        "email": "sarah.connor@noaa-satellite.gov",
        "password": "OceanSecurity99!",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "user" in data
    assert data["user"]["email"] == "sarah.connor@noaa-satellite.gov"
    assert data["user"]["name"] == "Dr. Sarah Connor"
    # Password hash must NEVER be in response
    assert "hashed_password" not in data["user"]
    assert "password" not in data["user"]

    # Verify cookies were set
    assert "origin_access_token" in response.cookies
    assert "origin_refresh_token" in response.cookies
    assert "origin_csrf_token" in response.cookies

    # Verify database persistence & Argon2id hash
    db_user = get_user_by_email("sarah.connor@noaa-satellite.gov")
    assert db_user is not None
    assert db_user["hashed_password"] != "OceanSecurity99!"
    assert db_user["hashed_password"].startswith("$argon2id$")
    assert verify_password("OceanSecurity99!", db_user["hashed_password"]) is True


def test_user_registration_duplicate_rejected(client):
    payload = {
        "name": "First Register",
        "email": "unique.analyst@origin.org",
        "password": "Password123!",
    }
    r1 = client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    # Second registration with same email (even with different casing)
    duplicate_payload = {
        "name": "Duplicate Register",
        "email": "UNIQUE.ANALYST@origin.org",
        "password": "Password123!",
    }
    r2 = client.post("/api/auth/register", json=duplicate_payload)
    assert r2.status_code == 409
    assert "already exists" in r2.json()["detail"]


def test_user_registration_weak_password_rejected(client):
    # Short password
    r1 = client.post("/api/auth/register", json={"name": "Test", "email": "short@origin.org", "password": "Pass1"})
    assert r1.status_code == 422

    # Password without digits
    r2 = client.post("/api/auth/register", json={"name": "Test", "email": "nodigit@origin.org", "password": "PasswordOnly"})
    assert r2.status_code == 422


def test_login_success(client, registered_user):
    payload = {
        "email": registered_user["user"]["email"],
        "password": registered_user["raw_password"],
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == registered_user["user"]["email"]
    assert "origin_access_token" in response.cookies
    assert "origin_refresh_token" in response.cookies
    assert "origin_csrf_token" in response.cookies


def test_login_invalid_password(client, registered_user):
    payload = {
        "email": registered_user["user"]["email"],
        "password": "WrongPassword123!",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_nonexistent_email(client):
    payload = {
        "email": "ghost.user@doesnotexist.com",
        "password": "Password123!",
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_login_rate_limiting(client):
    email = "target.victim@origin.org"
    for _ in range(5):
        resp = client.post("/api/auth/login", json={"email": email, "password": "BadPassword1!"})
        assert resp.status_code == 401

    # 6th attempt must trigger 429 Too Many Requests
    blocked_resp = client.post("/api/auth/login", json={"email": email, "password": "BadPassword1!"})
    assert blocked_resp.status_code == 429
    assert "Too many failed login attempts" in blocked_resp.json()["detail"]
    assert "Retry-After" in blocked_resp.headers


def test_refresh_token_rotation(client, registered_user):
    # Call refresh using cookies from registration
    response = client.post("/api/auth/refresh", cookies=registered_user["cookies"])
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    new_access_token = data["access_token"]
    assert new_access_token != registered_user["access_token"]

    # Ensure new cookies were issued
    assert "origin_access_token" in response.cookies
    assert "origin_refresh_token" in response.cookies


def test_refresh_token_reuse_detection(client, registered_user):
    initial_cookies = registered_user["cookies"]
    # First refresh succeeds
    r1 = client.post("/api/auth/refresh", cookies=initial_cookies)
    assert r1.status_code == 200

    # Attacker reuses the old refresh token that was just rotated
    r2 = client.post("/api/auth/refresh", cookies=initial_cookies)
    assert r2.status_code == 401
    assert "reuse detected" in r2.json()["detail"].lower()


def test_logout(client, registered_user):
    response = client.post("/api/auth/logout", cookies=registered_user["cookies"])
    assert response.status_code == 200
    assert "terminated" in response.json()["message"]
