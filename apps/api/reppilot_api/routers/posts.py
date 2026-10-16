from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .. import ratelimit
from ..db import get_db
from ..models import Comment, Like, Media, Post, User
from ..screening import screen_text
from ..security import active_user, current_user
from ..social import blocked_ids, can_view_post, friend_ids

router = APIRouter(prefix="/posts", tags=["community"])
feed_router = APIRouter(tags=["community"])

KINDS = "^(text|workout|progress|meal|achievement)$"
VIS = "^(public|friends|private)$"


class Author(BaseModel):
    id: int
    display_name: str


class MediaRef(BaseModel):
    id: int
    kind: str
    status: str


class PostOut(BaseModel):
    id: int
    author: Author
    kind: str
    body: str
    visibility: str
    status: str
    media: MediaRef | None
    like_count: int
    liked_by_me: bool
    comment_count: int
    created_at: datetime
    edited: bool
    notice: str | None = None


class PostIn(BaseModel):
    kind: str = Field(default="text", pattern=KINDS)
    body: str = Field(min_length=1, max_length=2000)
    visibility: str = Field(default="friends", pattern=VIS)
    media_id: int | None = None


class PostUpdate(BaseModel):
    body: str | None = Field(default=None, min_length=1, max_length=2000)
    visibility: str | None = Field(default=None, pattern=VIS)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: int
    author: Author
    body: str
    status: str
    created_at: datetime


def post_out(db: Session, viewer: User, p: Post, notice: str | None = None) -> PostOut:
    author = db.get(User, p.author_id)
    media = db.get(Media, p.media_id) if p.media_id else None
    mine = viewer.id == p.author_id
    hidden = blocked_ids(db, viewer.id)
    comment_q = select(func.count(Comment.id)).where(Comment.post_id == p.id, Comment.status == "visible")
    if hidden:
        comment_q = comment_q.where(Comment.author_id.not_in(hidden))
    return PostOut(
        id=p.id,
        author=Author(id=author.id, display_name=author.display_name),
        kind=p.kind,
        body=p.body,
        visibility=p.visibility,
        status=p.status,
        # Others only ever see approved media.
        media=MediaRef(id=media.id, kind=media.kind, status=media.status) if media and (mine or media.status == "approved") else None,
        like_count=db.scalar(select(func.count(Like.id)).where(Like.post_id == p.id)) or 0,
        liked_by_me=db.scalar(select(Like.id).where(Like.post_id == p.id, Like.user_id == viewer.id)) is not None,
        comment_count=db.scalar(comment_q) or 0,
        created_at=p.created_at,
        edited=p.edited_at is not None,
        notice=notice,
    )


def _visible_post(db: Session, viewer: User, post_id: int) -> Post:
    p = db.get(Post, post_id)
    if p is None or not can_view_post(db, viewer, p):
        raise HTTPException(404, "Post not found.")
    return p


def _screen_or_raise(text: str) -> str:
    v = screen_text(text)
    if v.decision == "block":
        raise HTTPException(422, v.reason)
    return v.decision


@feed_router.get("/feed", response_model=list[PostOut])
def feed(
    scope: str = Query(default="friends", pattern="^(friends|everyone|mine)$"),
    before_id: int | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    friends = friend_ids(db, user.id)
    hidden = blocked_ids(db, user.id)
    mine = (Post.author_id == user.id) & (Post.status != "removed")
    from_friends = (Post.status == "visible") & Post.author_id.in_(friends) & Post.visibility.in_(["public", "friends"])
    public = (Post.status == "visible") & (Post.visibility == "public")
    cond = {"mine": mine, "friends": or_(mine, from_friends), "everyone": or_(mine, from_friends, public)}[scope]
    q = (
        select(Post)
        .join(User, User.id == Post.author_id)
        .where(cond, User.banned.is_(False))
        .order_by(Post.id.desc())
        .limit(limit)
    )
    if before_id:
        q = q.where(Post.id < before_id)
    if hidden:
        q = q.where(Post.author_id.not_in(hidden))
    return [post_out(db, user, p) for p in db.scalars(q)]


@router.post("", response_model=PostOut, status_code=201)
def create_post(body: PostIn, user: User = Depends(active_user), db: Session = Depends(get_db)):
    decision = _screen_or_raise(body.body)
    ratelimit.hit("post", user.id)
    media = None
    if body.media_id is not None:
        media = db.get(Media, body.media_id)
        if media is None or media.owner_id != user.id or media.status == "rejected":
            raise HTTPException(400, "That photo or video cannot be used.")
    held = decision == "review" or (media is not None and media.status != "approved")
    p = Post(author_id=user.id, kind=body.kind, body=body.body.strip(), visibility=body.visibility,
             media_id=body.media_id, status="held" if held else "visible")
    db.add(p)
    db.commit()
    notice = None
    if held:
        notice = ("Your photo or video will appear after a quick safety review." if media and media.status != "approved"
                  else "Your post will appear after a quick review by a moderator.")
    return post_out(db, user, p, notice)


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return post_out(db, user, _visible_post(db, user, post_id))


@router.patch("/{post_id}", response_model=PostOut)
def edit_post(post_id: int, body: PostUpdate, user: User = Depends(active_user), db: Session = Depends(get_db)):
    p = db.get(Post, post_id)
    if p is None or p.author_id != user.id or p.status == "removed":
        raise HTTPException(404, "Post not found.")
    notice = None
    if body.body is not None:
        if _screen_or_raise(body.body) == "review":
            p.status = "held"
            notice = "Your post will appear after a quick review by a moderator."
        p.body = body.body.strip()
    if body.visibility is not None:
        p.visibility = body.visibility
    p.edited_at = datetime.now(timezone.utc)
    db.commit()
    return post_out(db, user, p, notice)


@router.delete("/{post_id}", status_code=204)
def delete_post(post_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.get(Post, post_id)
    if p is None or p.author_id != user.id:
        raise HTTPException(404, "Post not found.")
    db.delete(p)
    db.commit()


@router.post("/{post_id}/like", status_code=204)
def like(post_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _visible_post(db, user, post_id)
    if db.scalar(select(Like.id).where(Like.post_id == post_id, Like.user_id == user.id)) is None:
        db.add(Like(post_id=post_id, user_id=user.id))
        db.commit()


@router.delete("/{post_id}/like", status_code=204)
def unlike(post_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    like = db.scalar(select(Like).where(Like.post_id == post_id, Like.user_id == user.id))
    if like:
        db.delete(like)
        db.commit()


@router.get("/{post_id}/comments", response_model=list[CommentOut])
def comments(post_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _visible_post(db, user, post_id)
    hidden = blocked_ids(db, user.id)
    out = []
    for c in db.scalars(select(Comment).where(Comment.post_id == post_id).order_by(Comment.id)):
        if c.author_id in hidden or (c.status != "visible" and c.author_id != user.id) or c.status == "removed":
            continue
        a = db.get(User, c.author_id)
        if a is None or a.banned:
            continue
        out.append(CommentOut(id=c.id, author=Author(id=a.id, display_name=a.display_name), body=c.body,
                              status=c.status, created_at=c.created_at))
    return out


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(post_id: int, body: CommentIn, user: User = Depends(active_user), db: Session = Depends(get_db)):
    _visible_post(db, user, post_id)
    decision = _screen_or_raise(body.body)
    ratelimit.hit("comment", user.id)
    c = Comment(post_id=post_id, author_id=user.id, body=body.body.strip(), status="held" if decision == "review" else "visible")
    db.add(c)
    db.commit()
    return CommentOut(id=c.id, author=Author(id=user.id, display_name=user.display_name), body=c.body,
                      status=c.status, created_at=c.created_at)


@router.delete("/{post_id}/comments/{comment_id}", status_code=204)
def delete_comment(post_id: int, comment_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(Comment, comment_id)
    p = db.get(Post, post_id)
    # Comment authors and post owners can delete comments.
    if c is None or c.post_id != post_id or p is None or user.id not in (c.author_id, p.author_id):
        raise HTTPException(404, "Comment not found.")
    db.delete(c)
    db.commit()
