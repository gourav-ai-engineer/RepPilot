import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import ratelimit
from ..config import settings
from ..db import get_db
from ..models import Media, Post, User
from ..security import active_user, current_user
from ..social import can_view_post

router = APIRouter(prefix="/media", tags=["community"])

# content type -> (kind, file extension, magic-byte check)
ALLOWED = {
    "image/jpeg": ("image", ".jpg", lambda b: b[:3] == b"\xff\xd8\xff"),
    "image/png": ("image", ".png", lambda b: b[:8] == b"\x89PNG\r\n\x1a\n"),
    "image/webp": ("image", ".webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
    "video/mp4": ("video", ".mp4", lambda b: b[4:8] == b"ftyp"),
    "video/quicktime": ("video", ".mov", lambda b: b[4:8] == b"ftyp" or b[4:8] == b"moov"),
}


class MediaOut(BaseModel):
    id: int
    kind: str
    status: str
    notice: str


@router.post("", response_model=MediaOut, status_code=201)
async def upload(file: UploadFile, user: User = Depends(active_user), db: Session = Depends(get_db)):
    spec = ALLOWED.get(file.content_type or "")
    if spec is None:
        raise HTTPException(415, "Please upload a JPG, PNG or WebP photo, or an MP4/MOV video.")
    kind, ext, check = spec
    limit = settings.max_image_bytes if kind == "image" else settings.max_video_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File is too large (max {limit // (1024 * 1024)} MB).")
    if not check(data[:16]):
        raise HTTPException(415, "That file does not look like a valid photo or video.")
    ratelimit.hit("upload", user.id)
    os.makedirs(settings.media_dir, exist_ok=True)
    path = os.path.join(settings.media_dir, secrets.token_hex(16) + ext)
    with open(path, "wb") as f:
        f.write(data)
    m = Media(owner_id=user.id, kind=kind, content_type=file.content_type, path=path, size=len(data), status="pending")
    db.add(m)
    db.commit()
    return MediaOut(id=m.id, kind=kind, status=m.status,
                    notice="Thanks! Photos and videos are checked by a person before anyone else can see them.")


@router.get("/{media_id}")
def download(media_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(Media, media_id)
    if m is None:
        raise HTTPException(404, "Not found.")
    allowed = m.owner_id == user.id or user.role == "moderator"
    if not allowed and m.status == "approved":
        posts = db.scalars(select(Post).where(Post.media_id == m.id))
        allowed = any(can_view_post(db, user, p) for p in posts)
    if not allowed or not os.path.exists(m.path):
        raise HTTPException(404, "Not found.")
    return FileResponse(m.path, media_type=m.content_type, headers={"Cache-Control": "private, max-age=300"})
