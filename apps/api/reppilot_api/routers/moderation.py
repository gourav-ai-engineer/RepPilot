from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..enforcement import TARGETS, add_strike, author_of, record
from ..models import Appeal, Media, ModerationAction, Post, Report, User
from ..screening import screen_text
from ..security import moderator

router = APIRouter(prefix="/moderation", tags=["moderation"])


class QueueItem(BaseModel):
    target_type: str  # post | comment | message | entry | media | user
    target_id: int
    author_id: int | None
    author_name: str | None
    preview: str
    status: str
    report_count: int
    reasons: list[str]
    priority: str
    created_at: datetime | None


class AppealItem(BaseModel):
    id: int
    action_id: int
    action: str
    action_reason: str
    target_type: str
    target_id: int
    user_id: int
    message: str
    created_at: datetime


class QueueOut(BaseModel):
    items: list[QueueItem]
    appeals: list[AppealItem]


def _preview(target_type: str, t) -> str:
    if target_type == "media":
        return f"[{t.kind} upload, {t.size // 1024} KB]"
    if target_type == "entry":
        return f"Challenge entry: {t.value}"
    if target_type == "user":
        return f"User profile: {t.display_name} — {t.bio}"
    return t.body[:300]


@router.get("/queue", response_model=QueueOut)
def queue(mod: User = Depends(moderator), db: Session = Depends(get_db)):
    keys: dict[tuple[str, int], QueueItem] = {}

    def add(tt: str, t, reasons: list[str] | None = None, count: int = 0, priority: str = "normal"):
        uid = t.id if tt == "user" else (t.owner_id if tt == "media" else author_of(t))
        author = db.get(User, uid) if uid else None
        keys[(tt, t.id)] = QueueItem(target_type=tt, target_id=t.id, author_id=uid,
                                     author_name=author.display_name if author else None, preview=_preview(tt, t),
                                     status=getattr(t, "status", "reported"), report_count=count, reasons=reasons or [],
                                     priority=priority, created_at=getattr(t, "created_at", None))

    for tt, model in TARGETS.items():
        for t in db.scalars(select(model).where(model.status == "held")):
            add(tt, t)
    for m in db.scalars(select(Media).where(Media.status == "pending")):
        add("media", m)
    grouped = db.execute(select(Report.target_type, Report.target_id, func.count(Report.id),
                                func.group_concat(Report.reason) if db.bind.dialect.name == "sqlite" else func.string_agg(Report.reason, ","),
                                func.max(Report.priority))
                         .where(Report.status == "open").group_by(Report.target_type, Report.target_id))
    for tt, tid, count, reasons, priority in grouped:
        model = User if tt == "user" else TARGETS.get(tt)
        t = db.get(model, tid) if model else None
        if t is None:
            continue
        add(tt, t, sorted(set((reasons or "").split(","))), count, "high" if priority == "high" else "normal")
    items = sorted(keys.values(), key=lambda i: (i.priority != "high", -(i.report_count), i.target_id))

    appeals = []
    for a in db.scalars(select(Appeal).where(Appeal.status == "open").order_by(Appeal.id)):
        act = db.get(ModerationAction, a.action_id)
        # Appeals go to a different moderator than the one who decided.
        if act is None or act.moderator_id == mod.id:
            continue
        appeals.append(AppealItem(id=a.id, action_id=act.id, action=act.action, action_reason=act.reason,
                                  target_type=act.target_type, target_id=act.target_id, user_id=a.user_id,
                                  message=a.message, created_at=a.created_at))
    return QueueOut(items=items, appeals=appeals)


class DecisionIn(BaseModel):
    target_type: str = Field(pattern="^(post|comment|message|entry|media|user)$")
    target_id: int
    action: str = Field(pattern="^(approve|remove|warn|suspend|ban)$")
    reason: str = Field(default="", max_length=300)
    strike: bool = True


@router.post("/decide")
def decide(body: DecisionIn, mod: User = Depends(moderator), db: Session = Depends(get_db)):
    tt, tid = body.target_type, body.target_id
    if tt == "user":
        target = db.get(User, tid)
        subject = target
    elif tt == "media":
        target = db.get(Media, tid)
        subject = db.get(User, target.owner_id) if target else None
    else:
        target = db.get(TARGETS[tt], tid)
        subject = db.get(User, author_of(target)) if target else None
    if target is None:
        raise HTTPException(404, "Not found.")
    if subject is not None and subject.id == mod.id:
        raise HTTPException(400, "You cannot moderate your own content.")

    action = body.action
    if tt == "user" and action in ("approve", "remove"):
        raise HTTPException(400, "For users choose warn, suspend or ban.")
    if tt != "user" and action in ("suspend", "ban"):
        raise HTTPException(400, "Suspend or ban the user directly.")

    if action == "approve":
        if tt == "media":
            target.status = "approved"
            # Posts that were only waiting for this media can now be shown.
            for p in db.scalars(select(Post).where(Post.media_id == target.id, Post.status == "held")):
                if screen_text(p.body).decision == "allow":
                    p.status = "visible"
        else:
            target.status = "valid" if tt == "entry" else "visible"
    elif action == "remove":
        if tt == "media":
            target.status = "rejected"
            db.execute(update(Post).where(Post.media_id == target.id).values(status="removed"))
        else:
            target.status = "removed"
    elif action == "suspend":
        target.suspended_until = datetime.now(timezone.utc) + timedelta(days=settings.suspension_days)
    elif action == "ban":
        target.banned = True

    strike = action in ("remove", "warn") and body.strike and subject is not None
    a = record(db, moderator_id=mod.id, target_type=tt, target_id=tid, subject_user_id=subject.id if subject else None,
               action=action, reason=body.reason)
    a.strike = strike
    if strike:
        add_strike(db, subject, mod.id, body.reason)
    # Close the reports about this item.
    db.execute(update(Report).where(Report.target_type == tt, Report.target_id == tid, Report.status == "open")
               .values(status="resolved"))
    db.commit()
    return {"status": "done", "action_id": a.id}


class AppealDecisionIn(BaseModel):
    decision: str = Field(pattern="^(uphold|overturn)$")
    response: str = Field(default="", max_length=500)


@router.post("/appeals/{appeal_id}")
def decide_appeal(appeal_id: int, body: AppealDecisionIn, mod: User = Depends(moderator), db: Session = Depends(get_db)):
    ap = db.get(Appeal, appeal_id)
    if ap is None or ap.status != "open":
        raise HTTPException(404, "Appeal not found.")
    act = db.get(ModerationAction, ap.action_id)
    if act.moderator_id == mod.id:
        raise HTTPException(403, "A different moderator must review this appeal.")
    ap.status = "upheld" if body.decision == "uphold" else "overturned"
    ap.response = body.response
    if body.decision == "overturn":
        user = db.get(User, ap.user_id)
        if act.target_type in TARGETS:
            t = db.get(TARGETS[act.target_type], act.target_id)
            if t is not None:
                t.status = "valid" if act.target_type == "entry" else "visible"
        elif act.target_type == "media":
            m = db.get(Media, act.target_id)
            if m is not None:
                m.status = "approved"
                db.execute(update(Post).where(Post.media_id == m.id, Post.status == "removed").values(status="visible"))
        if act.action == "suspend" and user:
            user.suspended_until = None
        if act.action == "ban" and user:
            user.banned = False
        if act.strike and user and user.strikes > 0:
            user.strikes -= 1
        record(db, moderator_id=mod.id, target_type=act.target_type, target_id=act.target_id,
               subject_user_id=ap.user_id, action="restore", reason=f"Appeal overturned: {body.response}")
    db.commit()
    return {"status": ap.status}


class StatsOut(BaseModel):
    open_reports: int
    high_priority_open: int
    held_items: int
    pending_media: int
    open_appeals: int
    appeals_overturned: int
    appeals_decided: int
    users_with_strikes: int


@router.get("/stats", response_model=StatsOut)
def stats(mod: User = Depends(moderator), db: Session = Depends(get_db)):
    """Community-safety metrics from the PRD (reports, appeal overturn rate, repeat offenders)."""
    held = sum(db.scalar(select(func.count(m.id)).where(m.status == "held")) or 0 for m in TARGETS.values())
    return StatsOut(
        open_reports=db.scalar(select(func.count(Report.id)).where(Report.status == "open")) or 0,
        high_priority_open=db.scalar(select(func.count(Report.id)).where(Report.status == "open", Report.priority == "high")) or 0,
        held_items=held,
        pending_media=db.scalar(select(func.count(Media.id)).where(Media.status == "pending")) or 0,
        open_appeals=db.scalar(select(func.count(Appeal.id)).where(Appeal.status == "open")) or 0,
        appeals_overturned=db.scalar(select(func.count(Appeal.id)).where(Appeal.status == "overturned")) or 0,
        appeals_decided=db.scalar(select(func.count(Appeal.id)).where(Appeal.status != "open")) or 0,
        users_with_strikes=db.scalar(select(func.count(User.id)).where(User.strikes > 0)) or 0,
    )
