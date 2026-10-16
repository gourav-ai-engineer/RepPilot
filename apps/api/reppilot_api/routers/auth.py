import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import ratelimit
from ..config import settings
from ..db import get_db
from ..models import Media, User
from ..screening import screen_text
from ..security import create_token, current_user, hash_password, is_suspended, verify_password

router = APIRouter(prefix="/auth", tags=["account"])
me_router = APIRouter(prefix="/me", tags=["account"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=40)
    date_of_birth: date
    accept_community_standards: bool

    @field_validator("display_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MeOut(BaseModel):
    id: int
    email: str
    display_name: str
    bio: str
    experience: str
    profile_visibility: str
    role: str
    strikes: int
    suspended: bool


class TokenOut(BaseModel):
    token: str
    user: MeOut


class MeUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=40)
    bio: str | None = Field(default=None, max_length=200)
    experience: str | None = Field(default=None, pattern="^(beginner|intermediate|advanced)$")
    profile_visibility: str | None = Field(default=None, pattern="^(public|friends)$")


def me_out(u: User) -> MeOut:
    return MeOut(id=u.id, email=u.email, display_name=u.display_name, bio=u.bio, experience=u.experience,
                 profile_visibility=u.profile_visibility, role=u.role, strikes=u.strikes, suspended=is_suspended(u))


def age_on(dob: date, today: date) -> int:
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    ratelimit.hit("register", request.client.host if request.client else "unknown")
    if not body.accept_community_standards:
        raise HTTPException(400, "Please accept the community standards to create an account.")
    # Adult-only pilot. Only the result of this check is stored, never the date of birth.
    if age_on(body.date_of_birth, date.today()) < settings.min_age:
        raise HTTPException(403, f"RepPilot is currently only for adults ({settings.min_age}+).")
    if screen_text(body.display_name).decision != "allow":
        raise HTTPException(400, "Please choose a different display name.")
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists.")
    user = User(email=email, password_hash=hash_password(body.password), display_name=body.display_name,
                role="moderator" if email in settings.moderator_emails else "member")
    db.add(user)
    db.commit()
    return TokenOut(token=create_token(user.id), user=me_out(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    ratelimit.hit("login", email)
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is not correct.")
    if user.banned:
        raise HTTPException(403, "This account has been closed for breaking the community standards.")
    return TokenOut(token=create_token(user.id), user=me_out(user))


@me_router.get("", response_model=MeOut)
def get_me(user: User = Depends(current_user)):
    return me_out(user)


@me_router.patch("", response_model=MeOut)
def update_me(body: MeUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_none=True)
    if "display_name" in data:
        data["display_name"] = data["display_name"].strip()
    for field in ("display_name", "bio"):
        if field in data and screen_text(data[field]).decision != "allow":
            raise HTTPException(400, "Please change that text — it does not meet the community standards.")
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    return me_out(user)


@me_router.delete("", status_code=204)
def delete_me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Permanently deletes the account and everything it created, including media files."""
    for m in db.scalars(select(Media).where(Media.owner_id == user.id)):
        try:
            os.remove(m.path)
        except OSError:
            pass
    db.delete(user)
    db.commit()
