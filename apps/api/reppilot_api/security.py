from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

_hasher = PasswordHasher()
_bearer = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _hasher.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(hours=settings.jwt_ttl_hours)}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def _unauthorized() -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, "Please log in again.", headers={"WWW-Authenticate": "Bearer"})


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise _unauthorized()
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized()
    user = db.get(User, user_id)
    if user is None:
        raise _unauthorized()
    if user.banned:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been closed for breaking the community standards.")
    return user


def is_suspended(user: User) -> bool:
    until = user.suspended_until
    if until is None:
        return False
    if until.tzinfo is None:  # SQLite drops tz info
        until = until.replace(tzinfo=timezone.utc)
    return until > datetime.now(timezone.utc)


def active_user(user: User = Depends(current_user)) -> User:
    """A logged-in user who is allowed to create content (not suspended)."""
    if is_suspended(user):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Your account is temporarily suspended from posting. You can still use your workouts and appeal the decision.",
        )
    return user


def moderator(user: User = Depends(current_user)) -> User:
    if user.role != "moderator":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Moderators only.")
    return user
