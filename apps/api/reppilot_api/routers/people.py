from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from .. import ratelimit
from ..db import get_db
from ..models import Block, Friendship, User
from ..security import active_user, current_user
from ..social import are_friends, blocked_ids, can_view_profile, friend_ids, friendship_between, is_blocked_either_way

router = APIRouter(tags=["people"])


class PersonOut(BaseModel):
    id: int
    display_name: str
    bio: str
    experience: str
    relationship: str  # self | friend | request_sent | request_received | none


class FriendRequestOut(BaseModel):
    id: int
    from_user: PersonOut


def _relationship(db: Session, viewer_id: int, other_id: int) -> str:
    if viewer_id == other_id:
        return "self"
    f = friendship_between(db, viewer_id, other_id)
    if f is None:
        return "none"
    if f.status == "accepted":
        return "friend"
    return "request_sent" if f.requester_id == viewer_id else "request_received"


def person(db: Session, viewer_id: int, u: User) -> PersonOut:
    return PersonOut(id=u.id, display_name=u.display_name, bio=u.bio, experience=u.experience,
                     relationship=_relationship(db, viewer_id, u.id))


def _get_user(db: Session, user_id: int) -> User:
    u = db.get(User, user_id)
    if u is None or u.banned:
        raise HTTPException(404, "User not found.")
    return u


@router.get("/users/search", response_model=list[PersonOut])
def search(q: str = Query(min_length=2, max_length=40), user: User = Depends(current_user), db: Session = Depends(get_db)):
    hidden = blocked_ids(db, user.id)
    friends = friend_ids(db, user.id)
    pattern = f"%{q.strip().replace('%', '').replace('_', '')}%"
    rows = db.scalars(
        select(User).where(User.display_name.ilike(pattern), User.banned.is_(False), User.id != user.id).limit(50)
    )
    # Only public profiles and existing friends appear in search.
    return [person(db, user.id, u) for u in rows
            if u.id not in hidden and (u.profile_visibility == "public" or u.id in friends)][:20]


@router.get("/users/{user_id}", response_model=PersonOut)
def profile(user_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    target = _get_user(db, user_id)
    if not can_view_profile(db, user, target):
        raise HTTPException(404, "User not found.")
    return person(db, user.id, target)


@router.get("/friends", response_model=list[PersonOut])
def list_friends(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids = friend_ids(db, user.id) - blocked_ids(db, user.id)
    return [person(db, user.id, u) for u in db.scalars(select(User).where(User.id.in_(ids), User.banned.is_(False)))]


@router.get("/friends/requests", response_model=list[FriendRequestOut])
def incoming_requests(user: User = Depends(current_user), db: Session = Depends(get_db)):
    reqs = db.scalars(select(Friendship).where(Friendship.addressee_id == user.id, Friendship.status == "pending"))
    out = []
    for r in reqs:
        sender = db.get(User, r.requester_id)
        if sender and not sender.banned and not is_blocked_either_way(db, user.id, sender.id):
            out.append(FriendRequestOut(id=r.id, from_user=person(db, user.id, sender)))
    return out


@router.post("/friends/requests/{user_id}", status_code=201)
def send_request(user_id: int, user: User = Depends(active_user), db: Session = Depends(get_db)):
    if user_id == user.id:
        raise HTTPException(400, "You cannot add yourself.")
    target = _get_user(db, user_id)
    # Do not reveal blocks: a blocked request just looks like "not found".
    if is_blocked_either_way(db, user.id, target.id):
        raise HTTPException(404, "User not found.")
    ratelimit.hit("friend_request", user.id)
    existing = friendship_between(db, user.id, target.id)
    if existing:
        if existing.status == "pending" and existing.addressee_id == user.id:
            existing.status = "accepted"  # they already asked you: accept
            db.commit()
            return {"status": "accepted"}
        return {"status": existing.status}
    db.add(Friendship(requester_id=user.id, addressee_id=target.id))
    db.commit()
    return {"status": "pending"}


def _own_request(db: Session, request_id: int, user: User) -> Friendship:
    r = db.get(Friendship, request_id)
    if r is None or r.addressee_id != user.id or r.status != "pending":
        raise HTTPException(404, "Request not found.")
    return r


@router.post("/friends/requests/{request_id}/accept")
def accept(request_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _own_request(db, request_id, user)
    r.status = "accepted"
    db.commit()
    return {"status": "accepted"}


@router.post("/friends/requests/{request_id}/reject", status_code=204)
def reject(request_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own_request(db, request_id, user))
    db.commit()


@router.delete("/friends/{user_id}", status_code=204)
def remove_friend(user_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Removes a friend, or cancels a request you sent."""
    f = friendship_between(db, user.id, user_id)
    if f:
        db.delete(f)
        db.commit()


@router.get("/blocks", response_model=list[PersonOut])
def list_blocks(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ids = db.scalars(select(Block.blocked_id).where(Block.blocker_id == user.id)).all()
    return [PersonOut(id=u.id, display_name=u.display_name, bio="", experience=u.experience, relationship="blocked")
            for u in db.scalars(select(User).where(User.id.in_(ids)))]


@router.post("/blocks/{user_id}", status_code=204)
def block(user_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user_id == user.id:
        raise HTTPException(400, "You cannot block yourself.")
    _get_user(db, user_id)
    if db.scalar(select(Block.id).where(Block.blocker_id == user.id, Block.blocked_id == user_id)) is None:
        db.add(Block(blocker_id=user.id, blocked_id=user_id))
    # Blocking also ends any friendship or pending request.
    db.execute(delete(Friendship).where(or_(
        (Friendship.requester_id == user.id) & (Friendship.addressee_id == user_id),
        (Friendship.requester_id == user_id) & (Friendship.addressee_id == user.id),
    )))
    db.commit()


@router.delete("/blocks/{user_id}", status_code=204)
def unblock(user_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(Block).where(Block.blocker_id == user.id, Block.blocked_id == user_id))
    db.commit()


def assert_can_message(db: Session, a: User, b_id: int) -> User:
    b = _get_user(db, b_id)
    if is_blocked_either_way(db, a.id, b.id) or not are_friends(db, a.id, b.id):
        raise HTTPException(403, "You can only message friends.")
    return b
