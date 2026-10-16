"""Moderation side effects: audit log, strikes, suspensions, auto-hiding."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .models import ChallengeEntry, Comment, Message, ModerationAction, Post, Report, User

TARGETS = {"post": Post, "comment": Comment, "message": Message, "entry": ChallengeEntry}


def record(db: Session, *, moderator_id: int | None, target_type: str, target_id: int,
           subject_user_id: int | None, action: str, reason: str = "") -> ModerationAction:
    a = ModerationAction(moderator_id=moderator_id, target_type=target_type, target_id=target_id,
                         subject_user_id=subject_user_id, action=action, reason=reason[:300])
    db.add(a)
    db.flush()
    return a


def add_strike(db: Session, user: User, moderator_id: int | None, reason: str) -> None:
    """Repeat offenders: suspension after N strikes, account closure after more."""
    user.strikes += 1
    if user.strikes >= settings.ban_after_strikes:
        user.banned = True
        record(db, moderator_id=moderator_id, target_type="user", target_id=user.id, subject_user_id=user.id,
               action="ban", reason=f"Repeated violations ({user.strikes} strikes). {reason}")
    elif user.strikes >= settings.suspend_after_strikes:
        user.suspended_until = datetime.now(timezone.utc) + timedelta(days=settings.suspension_days)
        record(db, moderator_id=moderator_id, target_type="user", target_id=user.id, subject_user_id=user.id,
               action="suspend", reason=f"{user.strikes} strikes. {reason}")


def author_of(target) -> int | None:
    for attr in ("author_id", "sender_id", "user_id"):
        if hasattr(target, attr):
            return getattr(target, attr)
    return None


def maybe_auto_hide(db: Session, target_type: str, target_id: int) -> None:
    """Hide content once enough different people report it, pending review."""
    model = TARGETS.get(target_type)
    if model is None:
        return
    count = db.scalar(select(func.count(Report.id)).where(
        Report.target_type == target_type, Report.target_id == target_id, Report.status == "open"))
    target = db.get(model, target_id)
    if target is not None and count >= settings.auto_hide_reports and target.status in ("visible", "valid"):
        target.status = "held"
        record(db, moderator_id=None, target_type=target_type, target_id=target_id,
               subject_user_id=author_of(target), action="hide", reason=f"Hidden automatically after {count} reports.")
