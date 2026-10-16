from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import ratelimit
from ..db import get_db
from ..enforcement import TARGETS, author_of, maybe_auto_hide
from ..models import Appeal, ModerationAction, Report, User
from ..security import current_user

router = APIRouter(tags=["safety"])

HIGH_PRIORITY = {"sexual", "self_harm", "violence", "minor_safety"}


class ReportIn(BaseModel):
    target_type: str = Field(pattern="^(post|comment|message|user|entry)$")
    target_id: int
    reason: str = Field(pattern="^(sexual|harassment|hate|violence|self_harm|spam|misinformation|minor_safety|other)$")
    details: str = Field(default="", max_length=500)


@router.post("/reports", status_code=201)
def report(body: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.target_type == "user":
        target = db.get(User, body.target_id)
        owner = body.target_id
    else:
        target = db.get(TARGETS[body.target_type], body.target_id)
        owner = author_of(target) if target else None
    if target is None:
        raise HTTPException(404, "Not found.")
    if owner == user.id:
        raise HTTPException(400, "You cannot report your own content.")
    ratelimit.hit("report", user.id)
    db.add(Report(reporter_id=user.id, target_type=body.target_type, target_id=body.target_id, reason=body.reason,
                  details=body.details, priority="high" if body.reason in HIGH_PRIORITY else "normal"))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"status": "already_reported", "message": "You already reported this. Thank you."}
    maybe_auto_hide(db, body.target_type, body.target_id)
    db.commit()
    return {"status": "received", "message": "Thank you. A moderator will review this."}


class ActionOut(BaseModel):
    id: int
    target_type: str
    target_id: int
    action: str
    reason: str
    created_at: datetime
    appeal_status: str | None


@router.get("/moderation/actions/mine", response_model=list[ActionOut])
def my_actions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Moderation decisions that affected you, so you can understand and appeal them."""
    out = []
    for a in db.scalars(select(ModerationAction).where(
            ModerationAction.subject_user_id == user.id, ModerationAction.action != "approve").order_by(ModerationAction.id.desc())):
        appeal = db.scalar(select(Appeal).where(Appeal.action_id == a.id))
        out.append(ActionOut(id=a.id, target_type=a.target_type, target_id=a.target_id, action=a.action,
                             reason=a.reason, created_at=a.created_at, appeal_status=appeal.status if appeal else None))
    return out


class AppealIn(BaseModel):
    action_id: int
    message: str = Field(min_length=5, max_length=1000)


@router.post("/appeals", status_code=201)
def appeal(body: AppealIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = db.get(ModerationAction, body.action_id)
    if a is None or a.subject_user_id != user.id or a.action == "approve":
        raise HTTPException(404, "Decision not found.")
    if db.scalar(select(Appeal.id).where(Appeal.action_id == a.id)):
        raise HTTPException(409, "You already appealed this decision.")
    db.add(Appeal(action_id=a.id, user_id=user.id, message=body.message.strip()))
    db.commit()
    return {"status": "open", "message": "Your appeal was sent. A different moderator will look at it."}
