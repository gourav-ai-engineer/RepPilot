"""Automated text screening.

This is a first line of defence, not a complete moderation system: it blocks
clearly prohibited text, holds borderline text for human review, and lets
ordinary fitness talk ("chest day", "hip thrust", "breast stroke") through.
Every automated decision can be reported, reviewed and appealed.
"""

import re
import unicodedata
from dataclasses import dataclass

# Clearly prohibited: explicit sexual content or solicitation, and telling
# someone to hurt themselves. Rejected before saving.
_BLOCK = [
    r"\bnudes?\b", r"\bnudity\b", r"\bnaked pics?\b", r"\bsend (me )?pics\b", r"\bsexting\b", r"\bporn\w*\b", r"\bxxx\b",
    r"\bonlyfans\b", r"\bhorny\b", r"\bblow ?job\b", r"\bhand ?job\b", r"\bdick pics?\b", r"\bboobs\b",
    r"\bsex chat\b", r"\bescort\w*\b", r"\bkill (yo)?urself\b", r"\bkys\b", r"\bgo die\b",
]
# Borderline: insults, body shaming or self-harm language. Saved but hidden
# until a moderator looks at it.
_REVIEW = [
    r"\bidiots?\b", r"\bstupid\b", r"\blosers?\b", r"\bugly\b", r"\bmorons?\b", r"\bfat (pig|cow|slob)\b", r"\bdisgusting\b",
    r"\bworthless\b", r"\bpathetic\b", r"\bshut up\b", r"\bsexy\b", r"\bhot body\b", r"\bdate me\b",
    r"\bwant to die\b", r"\bkill myself\b", r"\bsuicid\w*\b", r"\bself.?harm\b", r"\bsteroids? for sale\b",
    r"\bbuy (steroids|sarms)\b",
]
_URL = re.compile(r"(https?://|www\.)\S+", re.I)
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s"})

_BLOCK_RE = [re.compile(p) for p in _BLOCK]
_REVIEW_RE = [re.compile(p) for p in _REVIEW]


@dataclass
class Verdict:
    decision: str  # allow | review | block
    reason: str = ""


def normalise(text: str) -> str:
    t = unicodedata.normalize("NFKC", text).lower().translate(_LEET)
    t = re.sub(r"(.)\1{2,}", r"\1\1", t)  # "sooooo" -> "soo"
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def screen_text(text: str) -> Verdict:
    t = normalise(text)
    for r in _BLOCK_RE:
        if r.search(t):
            return Verdict("block", "This breaks the community standards (sexual content or encouraging self-harm).")
    if len(_URL.findall(text)) > 2:
        return Verdict("review", "Many links — held to check for spam.")
    for r in _REVIEW_RE:
        if r.search(t):
            return Verdict("review", "Held for a quick review by a moderator.")
    return Verdict("allow")
