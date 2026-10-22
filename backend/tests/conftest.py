from __future__ import annotations
import os
import tempfile
import uuid
import pytest
from starlette.testclient import TestClient

# Configure test environment prior to importing backend app
test_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
test_db_path = test_db_file.name
test_db_file.close()

os.environ["ORIGIN_ENVIRONMENT"] = "testing"
os.environ["ORIGIN_DATABASE_PATH"] = test_db_path
os.environ["ORIGIN_JWT_SECRET"] = "test-secret-key-must-be-at-least-32-bytes-secure-origin-test"
os.environ["ORIGIN_COOKIE_SECURE"] = "false"
os.environ["ORIGIN_LOGIN_MAX_ATTEMPTS"] = "5"
os.environ["ORIGIN_LOGIN_WINDOW_SECONDS"] = "60"

from ..config import settings
from ..database import init_db
from ..main import app
from ..rate_limiter import login_rate_limiter


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    init_db(test_db_path)
    yield
    if os.path.exists(test_db_path):
        os.remove(test_db_path)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    login_rate_limiter.reset_all()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def registered_user(client):
    unique_suffix = uuid.uuid4().hex[:8]
    user_payload = {
        "name": f"Commander Vance {unique_suffix}",
        "email": f"elena.vance.{unique_suffix}@origin-marine.org",
        "password": "SecurePassword123!",
    }
    response = client.post("/api/auth/register", json=user_payload)
    assert response.status_code == 201
    data = response.json()
    return {
        "user": data["user"],
        "access_token": data["access_token"],
        "csrf_token": data["csrf_token"],
        "cookies": response.cookies,
        "raw_password": user_payload["password"],
    }
