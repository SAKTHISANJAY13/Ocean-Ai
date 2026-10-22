from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers import auth, investigations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Safe startup initialization
    settings.validate()
    init_db()
    yield


app = FastAPI(
    title="ORIGIN API",
    description="AI-Based Oil Spill Detection and Source Attribution with Enterprise JWT Authentication",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration supporting credentials with explicitly configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "Accept", "Origin"],
    expose_headers=["Retry-After"],
)

# Authentication and Protected Investigation Routers
app.include_router(auth.router)
app.include_router(investigations.router)


@app.get("/")
def root():
    """Public root status endpoint."""
    return {
        "message": "ORIGIN API is running",
        "status": "online",
    }


@app.get("/api/health")
def health():
    """Public health-check endpoint. Never returns secrets or internal config."""
    return {
        "status": "healthy",
        "service": "ORIGIN backend",
    }