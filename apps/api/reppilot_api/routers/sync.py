import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import SyncDoc, User
from ..security import current_user

router = APIRouter(prefix="/sync", tags=["sync"])
MAX_SYNC_BYTES = 2 * 1024 * 1024


class SyncOut(BaseModel):
    version: int
    data: dict
    updated_at: datetime | None


class SyncIn(BaseModel):
    # The version the client last saw. A mismatch means another device saved
    # in between; the client must merge and retry, so no update is lost.
    base_version: int = Field(ge=0)
    data: dict


@router.get("", response_model=SyncOut)
def get_sync(user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = db.get(SyncDoc, user.id)
    if doc is None:
        return SyncOut(version=0, data={}, updated_at=None)
    return SyncOut(version=doc.version, data=json.loads(doc.data), updated_at=doc.updated_at)


@router.put("", response_model=SyncOut)
def put_sync(body: SyncIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    raw = json.dumps(body.data, separators=(",", ":"))
    if len(raw.encode()) > MAX_SYNC_BYTES:
        raise HTTPException(413, "Your data is too large to sync. Please contact support.")
    now = datetime.now(timezone.utc)
    new_version = body.base_version + 1
    if body.base_version == 0:
        db.add(SyncDoc(user_id=user.id, version=1, data=raw, updated_at=now))
        try:
            db.commit()
        except IntegrityError:  # another device created it first
            db.rollback()
            _conflict(db, user.id)
    else:
        # Compare-and-swap on the version, so two devices saving at once
        # cannot silently overwrite each other.
        res = db.execute(
            update(SyncDoc)
            .where(SyncDoc.user_id == user.id, SyncDoc.version == body.base_version)
            .values(version=new_version, data=raw, updated_at=now)
        )
        if res.rowcount != 1:
            db.rollback()
            _conflict(db, user.id)
        db.commit()
    return SyncOut(version=new_version, data=body.data, updated_at=now)


def _conflict(db: Session, user_id: int) -> None:
    doc = db.get(SyncDoc, user_id)
    raise HTTPException(409, {"message": "Data changed on another device.", "version": doc.version if doc else 0,
                              "data": json.loads(doc.data) if doc else {}})
