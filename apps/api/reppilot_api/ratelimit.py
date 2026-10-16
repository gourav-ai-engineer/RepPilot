"""Simple in-process sliding-window rate limiter.

Good for a single server pilot. With several workers or servers, move this
to Redis or the database so limits are shared.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, status

LIMITS: dict[str, tuple[int, int]] = {
    # action: (max events, window seconds)
    "login": (10, 15 * 60),
    "register": (5, 60 * 60),
    "post": (10, 60 * 60),
    "comment": (60, 60 * 60),
    "message": (120, 60 * 60),
    "friend_request": (30, 24 * 60 * 60),
    "report": (20, 24 * 60 * 60),
    "upload": (20, 24 * 60 * 60),
    "entry": (20, 24 * 60 * 60),
}

_events: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def hit(action: str, key: str | int) -> None:
    limit, window = LIMITS[action]
    k = f"{action}:{key}"
    now = time.monotonic()
    with _lock:
        q = _events[k]
        while q and q[0] <= now - window:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "You are doing that too often. Please wait a little and try again.")
        q.append(now)


def reset() -> None:
    with _lock:
        _events.clear()
