"""Relationship rules shared by every social endpoint."""

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from .models import Block, Friendship, Post, User


def is_blocked_either_way(db: Session, a: int, b: int) -> bool:
    return db.scalar(
        select(Block.id).where(
            or_(and_(Block.blocker_id == a, Block.blocked_id == b), and_(Block.blocker_id == b, Block.blocked_id == a))
        )
    ) is not None


def blocked_ids(db: Session, user_id: int) -> set[int]:
    rows = db.execute(select(Block.blocker_id, Block.blocked_id).where(or_(Block.blocker_id == user_id, Block.blocked_id == user_id)))
    return {b if a == user_id else a for a, b in rows}


def friendship_between(db: Session, a: int, b: int) -> Friendship | None:
    return db.scalar(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == a, Friendship.addressee_id == b),
                and_(Friendship.requester_id == b, Friendship.addressee_id == a),
            )
        )
    )


def are_friends(db: Session, a: int, b: int) -> bool:
    f = friendship_between(db, a, b)
    return f is not None and f.status == "accepted"


def friend_ids(db: Session, user_id: int) -> set[int]:
    rows = db.execute(
        select(Friendship.requester_id, Friendship.addressee_id).where(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
        )
    )
    return {b if a == user_id else a for a, b in rows}


def can_view_profile(db: Session, viewer: User, target: User) -> bool:
    if viewer.id == target.id:
        return True
    if target.banned or is_blocked_either_way(db, viewer.id, target.id):
        return False
    return target.profile_visibility == "public" or are_friends(db, viewer.id, target.id)


def can_view_post(db: Session, viewer: User, post: Post) -> bool:
    if post.author_id == viewer.id:
        return post.status != "removed"
    if post.status != "visible" or is_blocked_either_way(db, viewer.id, post.author_id):
        return False
    if post.visibility == "public":
        return True
    if post.visibility == "friends":
        return are_friends(db, viewer.id, post.author_id)
    return False
