from __future__ import annotations
import threading
import time
from collections import defaultdict
from typing import Dict, List, Optional, Tuple
from .config import settings


class LoginRateLimiter:
    """
    Sliding window rate limiter for login attempts per client IP and targeted account.
    Protects against brute force and credential stuffing attacks.
    """

    def __init__(
        self,
        max_attempts: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ) -> None:
        self.max_attempts = max_attempts or settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
        self.window_seconds = window_seconds or settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS
        self._ip_attempts: Dict[str, List[float]] = defaultdict(list)
        self._account_attempts: Dict[str, List[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def _clean_window(self, timestamps: List[float], now: float) -> List[float]:
        threshold = now - self.window_seconds
        return [ts for ts in timestamps if ts > threshold]

    def check_rate_limit(self, ip: str, email: str) -> Tuple[bool, int]:
        """
        Check if an attempt is permitted.
        Returns: (is_allowed, retry_after_seconds)
        """
        now = time.time()
        normalized_email = email.strip().lower()

        with self._lock:
            # Clean expired records
            self._ip_attempts[ip] = self._clean_window(self._ip_attempts[ip], now)
            self._account_attempts[normalized_email] = self._clean_window(
                self._account_attempts[normalized_email], now
            )

            ip_count = len(self._ip_attempts[ip])
            acc_count = len(self._account_attempts[normalized_email])

            if ip_count >= self.max_attempts or acc_count >= self.max_attempts:
                # Find oldest attempt within window to calculate retry_after
                oldest_ip = self._ip_attempts[ip][0] if self._ip_attempts[ip] else now
                oldest_acc = self._account_attempts[normalized_email][0] if self._account_attempts[normalized_email] else now
                earliest = min(oldest_ip, oldest_acc)
                retry_after = max(1, int(self.window_seconds - (now - earliest)))
                return False, retry_after

            return True, 0

    def record_failure(self, ip: str, email: str) -> None:
        """Record a failed login attempt."""
        now = time.time()
        normalized_email = email.strip().lower()

        with self._lock:
            self._ip_attempts[ip].append(now)
            self._account_attempts[normalized_email].append(now)

    def record_success(self, ip: str, email: str) -> None:
        """Reset failed attempts on successful login."""
        normalized_email = email.strip().lower()

        with self._lock:
            self._ip_attempts.pop(ip, None)
            self._account_attempts.pop(normalized_email, None)

    def reset_all(self) -> None:
        """Reset rate limiter state (useful for unit testing)."""
        with self._lock:
            self._ip_attempts.clear()
            self._account_attempts.clear()


login_rate_limiter = LoginRateLimiter()
