from __future__ import annotations
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from .config import settings


def get_db_path(custom_path: Optional[str] = None) -> str:
    path = custom_path or settings.DATABASE_PATH
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    return path


def get_db_connection(custom_path: Optional[str] = None) -> sqlite3.Connection:
    path = get_db_path(custom_path)
    conn = sqlite3.connect(path, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(custom_path: Optional[str] = None) -> None:
    """Initialize database tables, indexes, system account, and baseline incidents."""
    conn = get_db_connection(custom_path)
    try:
        with conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'investigator',
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    token_hash TEXT UNIQUE NOT NULL,
                    family_id TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked_at TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_refresh_token_hash ON refresh_tokens(token_hash);
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens(family_id);
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS investigations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    region TEXT NOT NULL,
                    observed_at TEXT NOT NULL,
                    oil_confidence REAL NOT NULL,
                    area_km2 REAL NOT NULL,
                    status TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    coordinates_lat REAL NOT NULL,
                    coordinates_lng REAL NOT NULL,
                    detection_risk TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_investigations_user ON investigations(user_id);
                """
            )

            # System account for common geospatial datasets
            now = datetime.now(timezone.utc).isoformat()
            conn.execute(
                """
                INSERT OR IGNORE INTO users (id, name, email, hashed_password, role, is_active, created_at, updated_at)
                VALUES ('system', 'ORIGIN Intelligence System', 'system@origin-marine.org', '$argon2id$v=19$m=65536,t=3,p=4$system_placeholder_hash', 'admin', 1, ?, ?);
                """,
                (now, now),
            )

            # Seed system flagship investigations (INC-204, etc.)
            seed_system_investigations(conn)
    finally:
        conn.close()


def seed_system_investigations(conn: sqlite3.Connection) -> None:
    now = datetime.now(timezone.utc).isoformat()
    defaults = [
        ("INC-204", "system", "Bay of Bengal", "2026-08-18T04:32:00Z", 0.942, 14.2, "Reconstruction Running", "High", 12.86, 80.35, "Low"),
        ("INC-2026-039", "system", "Arabian Sea", "2026-08-23T14:15:00Z", 0.74, 5.6, "New Detection", "Medium", 15.22, 69.45, "Medium"),
        ("INC-2026-037", "system", "Andaman Region", "2026-08-22T08:45:00Z", 0.91, 22.4, "AIS Correlation", "High", 10.55, 92.12, "Low"),
    ]
    for inc in defaults:
        conn.execute(
            """
            INSERT OR IGNORE INTO investigations (
                id, user_id, region, observed_at, oil_confidence, area_km2,
                status, priority, coordinates_lat, coordinates_lng, detection_risk, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """,
            (inc[0], inc[1], inc[2], inc[3], inc[4], inc[5], inc[6], inc[7], inc[8], inc[9], inc[10], now),
        )


# User Operations
def create_user(
    name: str,
    email: str,
    hashed_password: str,
    role: str = "investigator",
    custom_path: Optional[str] = None,
) -> Dict[str, Any]:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    clean_email = email.strip().lower()

    conn = get_db_connection(custom_path)
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO users (id, name, email, hashed_password, role, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?);
                """,
                (user_id, name.strip(), clean_email, hashed_password, role, now, now),
            )

        return {
            "id": user_id,
            "name": name.strip(),
            "email": clean_email,
            "role": role,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
    finally:
        conn.close()


def get_user_by_email(email: str, custom_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    clean_email = email.strip().lower()
    conn = get_db_connection(custom_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ? LIMIT 1;", (clean_email,))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def get_user_by_id(user_id: str, custom_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(custom_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ? LIMIT 1;", (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


# Refresh Token Operations
def store_refresh_token(
    user_id: str,
    token_hash: str,
    family_id: str,
    expires_at: str,
    custom_path: Optional[str] = None,
) -> Dict[str, Any]:
    token_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection(custom_path)
    try:
        with conn:
            conn.execute(
                """
                INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, revoked_at, created_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?);
                """,
                (token_id, user_id, token_hash, family_id, expires_at, now),
            )
        return {
            "id": token_id,
            "user_id": user_id,
            "token_hash": token_hash,
            "family_id": family_id,
            "expires_at": expires_at,
            "revoked_at": None,
            "created_at": now,
        }
    finally:
        conn.close()


def get_refresh_token(token_hash: str, custom_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(custom_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1;", (token_hash,))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def revoke_refresh_token(token_hash: str, custom_path: Optional[str] = None) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection(custom_path)
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL;",
                (now, token_hash),
            )
            return cursor.rowcount > 0
    finally:
        conn.close()


def revoke_refresh_token_family(family_id: str, custom_path: Optional[str] = None) -> int:
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection(custom_path)
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL;",
                (now, family_id),
            )
            return cursor.rowcount
    finally:
        conn.close()


def revoke_all_user_tokens(user_id: str, custom_path: Optional[str] = None) -> int:
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection(custom_path)
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL;",
                (now, user_id),
            )
            return cursor.rowcount
    finally:
        conn.close()


# Investigations Operations
def list_investigations_for_user(user_id: str, custom_path: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection(custom_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM investigations 
            WHERE user_id = ? OR user_id = 'system' 
            ORDER BY observed_at DESC;
            """,
            (user_id,),
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_investigation_by_id(investigation_id: str, custom_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_db_connection(custom_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM investigations WHERE id = ? LIMIT 1;", (investigation_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()
