import os
from typing import List


class Settings:
    # Environment
    ENVIRONMENT: str = os.getenv("ORIGIN_ENVIRONMENT", "development")
    IS_PRODUCTION: bool = ENVIRONMENT.lower() == "production"

    # JWT Configuration
    JWT_SECRET_KEY: str = os.getenv(
        "ORIGIN_JWT_SECRET",
        "dev-secret-key-must-be-at-least-32-bytes-origin-marine-investigation-2026-secure",
    )
    JWT_ALGORITHM: str = os.getenv("ORIGIN_JWT_ALGORITHM", "HS256")
    JWT_ISSUER: str = os.getenv("ORIGIN_JWT_ISSUER", "origin-api")
    JWT_AUDIENCE: str = os.getenv("ORIGIN_JWT_AUDIENCE", "origin-client")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ORIGIN_ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("ORIGIN_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Cookie Configuration
    COOKIE_ACCESS_NAME: str = "origin_access_token"
    COOKIE_REFRESH_NAME: str = "origin_refresh_token"
    COOKIE_CSRF_NAME: str = "origin_csrf_token"
    COOKIE_SECURE: bool = os.getenv("ORIGIN_COOKIE_SECURE", "false").lower() in ("true", "1") or IS_PRODUCTION
    COOKIE_SAMESITE: str = os.getenv("ORIGIN_COOKIE_SAMESITE", "lax")

    # Rate Limiting
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = int(os.getenv("ORIGIN_LOGIN_MAX_ATTEMPTS", "5"))
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("ORIGIN_LOGIN_WINDOW_SECONDS", "60"))

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "ORIGIN_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]

    # Database
    DATABASE_PATH: str = os.getenv(
        "ORIGIN_DATABASE_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "origin.db"),
    )

    def validate(self) -> None:
        """Validate critical security configurations on startup."""
        if len(self.JWT_SECRET_KEY.encode("utf-8")) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 bytes (256 bits) for HS256")
        if self.IS_PRODUCTION:
            if "dev-secret" in self.JWT_SECRET_KEY:
                raise ValueError("Insecure default JWT secret cannot be used in production environment")
            if not self.COOKIE_SECURE:
                raise ValueError("COOKIE_SECURE must be True in production environment")
        if "*" in self.CORS_ORIGINS:
            raise ValueError("Wildcard CORS origins are forbidden when allow_credentials=True")


settings = Settings()
settings.validate()
