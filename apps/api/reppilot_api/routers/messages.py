from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from .. import ratelimit
from ..db import get_db
from ..models import Message, User
from ..screening import screen_text
from ..security import active_user, current_user
from ..social import blocked_ids, friend_ids
from .people import assert_can_message

router = APIRouter(tags=["messages"])


class MessageOut(BaseModel):
    id: int
    from_me: bool
    body: str
    status: str
    created_at: datetime


class ConversationOut(BaseModel):
    user_id: int
    display_name: str
    last_message: str | None
    last_at: datetime | None
    unread: int


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


def _between(a: int, b: int):
    return or_(and_(Message.sender_id == a, Message.recipient_id == b), and_(Message.sender_id == b, Message.recipient_id == a))


@router.get("/conversations", response_model=list[ConversationOut])
def conversations(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids = friend_ids(db, user.id) - blocked_ids(db, user.id)
    out = []
    for friend in db.scalars(select(User).where(User.id.in_(ids), User.banned.is_(False))):
        last = db.scalar(select(Message).where(_between(user.id, friend.id), or_(
            Message.status == "visible", Message.sender_id == user.id)).order_by(Message.id.desc()).limit(1))
        unread = db.scalar(select(func.count(Message.id)).where(
            Message.sender_id == friend.id, Message.recipient_id == user.id, Message.read.is_(False), Message.status == "visible"))
        out.append(ConversationOut(user_id=friend.id, display_name=friend.display_name,
                                   last_message=last.body if last else None, last_at=last.created_at if last else None,
                                   unread=unread or 0))
    return sorted(out, key=lambda c: (c.last_at is None, -(c.last_at.timestamp() if c.last_at else 0)))


@router.get("/messages/{user_id}", response_model=list[MessageOut])
def thread(user_id: int, before_id: int | None = None, limit: int = Query(default=50, ge=1, le=100),
           user: User = Depends(current_user), db: Session = Depends(get_db)):
    assert_can_message(db, user, user_id)
    q = select(Message).where(_between(user.id, user_id), Message.status != "removed",
                              or_(Message.status == "visible", Message.sender_id == user.id))
    if before_id:
        q = q.where(Message.id < before_id)
    msgs = list(db.scalars(q.order_by(Message.id.desc()).limit(limit)))
    db.execute(update(Message).where(Message.sender_id == user_id, Message.recipient_id == user.id,
                                      Message.read.is_(False)).values(read=True))
    db.commit()
    return [MessageOut(id=m.id, from_me=m.sender_id == user.id, body=m.body, status=m.status, created_at=m.created_at)
            for m in reversed(msgs)]


@router.post("/messages/{user_id}", response_model=MessageOut, status_code=201)
def send(user_id: int, body: MessageIn, user: User = Depends(active_user), db: Session = Depends(get_db)):
    assert_can_message(db, user, user_id)
    v = screen_text(body.body)
    if v.decision == "block":
        raise HTTPException(422, v.reason)
    ratelimit.hit("message", user.id)
    # Held messages are not delivered until a moderator reviews them.
    m = Message(sender_id=user.id, recipient_id=user_id, body=body.body.strip(),
                status="held" if v.decision == "review" else "visible")
    db.add(m)
    db.commit()
    return MessageOut(id=m.id, from_me=True, body=m.body, status=m.status, created_at=m.created_at)
