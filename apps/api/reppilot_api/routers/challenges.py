from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import ratelimit
from ..db import get_db
from ..models import Challenge, ChallengeEntry, ChallengeParticipant, User
from ..security import active_user, current_user
from ..social import blocked_ids, friend_ids

router = APIRouter(prefix="/challenges", tags=["challenges"])

SAFETY = (
    "Warm up first. Count only reps with full, controlled range of motion. Stop if you feel pain or dizziness. "
    "One attempt per day is plenty — rest days count too."
)

SEED_CHALLENGES = [
    dict(slug="pushups_max", title="Push-up challenge", unit="reps", plausible_max=120,
         description="Most push-ups in one set.",
         rules="Chest close to the floor and arms straight at the top on every rep. Knee push-ups go in the beginner division. " + SAFETY),
    dict(slug="pullups_max", title="Pull-up challenge", unit="reps", plausible_max=50,
         description="Most pull-ups in one set.",
         rules="Start from a full hang, chin over the bar, no swinging or kipping. " + SAFETY),
    dict(slug="plank_hold", title="Plank hold", unit="seconds", plausible_max=900,
         description="Longest forearm plank hold.",
         rules="Straight line from head to heels. The time stops when your hips sag or lift. " + SAFETY),
    dict(slug="squats_2min", title="2-minute squat challenge", unit="reps", plausible_max=150,
         description="Most bodyweight squats in 2 minutes.",
         rules="Thighs to at least parallel, stand fully upright each rep. " + SAFETY),
    dict(slug="bench_5rm", title="Bench press: best set of 5", unit="kg", plausible_max=250,
         description="Heaviest bench press for 5 clean reps — never a one-rep max.",
         rules="Only with a spotter or safety arms set. 5 full reps with the bar touching the chest. "
               "Do not attempt a weight you have not trained close to; add at most 2.5–5 kg from your last best. " + SAFETY),
    dict(slug="consistency_week", title="Consistency week", unit="workouts", plausible_max=6,
         description="Complete the workouts you planned this week.",
         rules="Log each completed workout. Ranked by workouts done, up to 6 — rest days are part of training. " + SAFETY),
]


def seed_challenges(db: Session) -> None:
    for c in SEED_CHALLENGES:
        if db.scalar(select(Challenge.id).where(Challenge.slug == c["slug"])) is None:
            db.add(Challenge(**c))
    db.commit()


class ChallengeOut(BaseModel):
    id: int
    slug: str
    title: str
    description: str
    unit: str
    rules: str
    joined: bool
    my_best: float | None
    participants: int


class JoinIn(BaseModel):
    show_on_leaderboard: bool = True


class EntryIn(BaseModel):
    value: float = Field(gt=0, le=100000)
    note: str = Field(default="", max_length=200)


class EntryOut(BaseModel):
    id: int
    value: float
    status: str
    notice: str | None = None


class BoardRow(BaseModel):
    rank: int
    user_id: int
    display_name: str
    experience: str
    value: float
    is_me: bool


class BoardOut(BaseModel):
    challenge_id: int
    unit: str
    mode: str
    rows: list[BoardRow]
    my_row: BoardRow | None


def _challenge(db: Session, cid: int) -> Challenge:
    c = db.get(Challenge, cid)
    if c is None or not c.active:
        raise HTTPException(404, "Challenge not found.")
    return c


def _best(db: Session, cid: int, uid: int) -> float | None:
    return db.scalar(select(func.max(ChallengeEntry.value)).where(
        ChallengeEntry.challenge_id == cid, ChallengeEntry.user_id == uid, ChallengeEntry.status == "valid"))


@router.get("", response_model=list[ChallengeOut])
def list_challenges(user: User = Depends(current_user), db: Session = Depends(get_db)):
    out = []
    for c in db.scalars(select(Challenge).where(Challenge.active.is_(True)).order_by(Challenge.id)):
        joined = db.scalar(select(ChallengeParticipant.id).where(
            ChallengeParticipant.challenge_id == c.id, ChallengeParticipant.user_id == user.id)) is not None
        count = db.scalar(select(func.count(ChallengeParticipant.id)).where(ChallengeParticipant.challenge_id == c.id))
        out.append(ChallengeOut(id=c.id, slug=c.slug, title=c.title, description=c.description, unit=c.unit, rules=c.rules,
                                joined=joined, my_best=_best(db, c.id, user.id), participants=count or 0))
    return out


@router.post("/{cid}/join")
def join(cid: int, body: JoinIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _challenge(db, cid)
    p = db.scalar(select(ChallengeParticipant).where(
        ChallengeParticipant.challenge_id == cid, ChallengeParticipant.user_id == user.id))
    if p is None:
        p = ChallengeParticipant(challenge_id=cid, user_id=user.id)
        db.add(p)
    p.show_on_leaderboard = body.show_on_leaderboard
    db.commit()
    return {"joined": True, "show_on_leaderboard": p.show_on_leaderboard}


@router.delete("/{cid}/join", status_code=204)
def leave(cid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = db.scalar(select(ChallengeParticipant).where(
        ChallengeParticipant.challenge_id == cid, ChallengeParticipant.user_id == user.id))
    if p:
        db.delete(p)
        db.commit()


@router.post("/{cid}/entries", response_model=EntryOut, status_code=201)
def submit(cid: int, body: EntryIn, user: User = Depends(active_user), db: Session = Depends(get_db)):
    c = _challenge(db, cid)
    if db.scalar(select(ChallengeParticipant.id).where(
            ChallengeParticipant.challenge_id == cid, ChallengeParticipant.user_id == user.id)) is None:
        raise HTTPException(400, "Join the challenge first.")
    since = datetime.now(timezone.utc) - timedelta(hours=20)
    recent = db.scalar(select(func.count(ChallengeEntry.id)).where(
        ChallengeEntry.challenge_id == cid, ChallengeEntry.user_id == user.id, ChallengeEntry.created_at >= since))
    # Fair and safe: one attempt a day, so nobody is rewarded for repeated max efforts.
    if recent:
        raise HTTPException(429, "One attempt per day. Rest and try again tomorrow!")
    ratelimit.hit("entry", user.id)
    notice = None
    status = "valid"
    if body.value > c.plausible_max:
        status = "held"
        notice = "That is an unusually high result, so a moderator will check it before it appears on the leaderboard."
    elif c.unit == "kg":
        prev = _best(db, cid, user.id)
        if prev is not None and body.value > prev + 10:
            status = "held"
            notice = "That is a big jump from your last best. A moderator will check it — please increase in small steps."
    e = ChallengeEntry(challenge_id=cid, user_id=user.id, value=body.value, note=body.note.strip(), status=status)
    db.add(e)
    db.commit()
    return EntryOut(id=e.id, value=e.value, status=e.status, notice=notice)


@router.get("/{cid}/leaderboard", response_model=BoardOut)
def leaderboard(
    cid: int,
    division: str = Query(default="all", pattern="^(all|beginner|intermediate|advanced)$"),
    scope: str = Query(default="everyone", pattern="^(everyone|friends)$"),
    mode: str = Query(default="best", pattern="^(best|improved)$"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    c = _challenge(db, cid)
    hidden = blocked_ids(db, user.id)
    allowed_ids = friend_ids(db, user.id) | {user.id} if scope == "friends" else None
    q = (
        select(User, ChallengeParticipant.show_on_leaderboard)
        .join(ChallengeParticipant, ChallengeParticipant.user_id == User.id)
        .where(ChallengeParticipant.challenge_id == cid, User.banned.is_(False))
    )
    if division != "all":
        q = q.where(User.experience == division)
    scored: list[tuple[User, float]] = []
    for u, visible in db.execute(q):
        if u.id in hidden or (allowed_ids is not None and u.id not in allowed_ids):
            continue
        if not visible and u.id != user.id:
            continue
        values = db.scalars(select(ChallengeEntry.value).where(
            ChallengeEntry.challenge_id == cid, ChallengeEntry.user_id == u.id, ChallengeEntry.status == "valid"
        ).order_by(ChallengeEntry.id)).all()
        if not values:
            continue
        # "improved" rewards personal progress, so beginners can top a board too.
        score = max(values) if mode == "best" else max(values) - values[0]
        scored.append((u, score))
    scored.sort(key=lambda t: -t[1])
    rows = [BoardRow(rank=i + 1, user_id=u.id, display_name=u.display_name, experience=u.experience, value=v, is_me=u.id == user.id)
            for i, (u, v) in enumerate(scored)]
    mine = next((r for r in rows if r.is_me), None)
    return BoardOut(challenge_id=c.id, unit=c.unit, mode=mode, rows=rows[:50], my_row=mine)
