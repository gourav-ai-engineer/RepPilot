import os
import secrets
from dataclasses import dataclass, field


def _list(name: str) -> list[str]:
    return [v.strip() for v in os.getenv(name, "").split(",") if v.strip()]


@dataclass
class Settings:
    env: str = field(default_factory=lambda: os.getenv("REPPILOT_ENV", "development"))
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./reppilot.db"))
    jwt_secret: str = field(default_factory=lambda: os.getenv("JWT_SECRET", ""))
    jwt_ttl_hours: int = field(default_factory=lambda: int(os.getenv("JWT_TTL_HOURS", "720")))
    moderator_emails: list[str] = field(default_factory=lambda: [e.lower() for e in _list("MODERATOR_EMAILS")])
    cors_origins: list[str] = field(default_factory=lambda: _list("CORS_ORIGINS") or ["http://localhost:8081", "http://localhost:19006"])
    media_dir: str = field(default_factory=lambda: os.getenv("MEDIA_DIR", "./media"))
    max_image_bytes: int = 5 * 1024 * 1024
    max_video_bytes: int = 30 * 1024 * 1024
    min_age: int = 18
    # Strikes before automatic suspension / permanent ban (repeat offenders).
    suspend_after_strikes: int = 3
    ban_after_strikes: int = 5
    suspension_days: int = 7
    # Distinct reports that hide content until a moderator reviews it.
    auto_hide_reports: int = 3

    def __post_init__(self) -> None:
        if not self.jwt_secret:
            if self.env == "production":
                raise RuntimeError("JWT_SECRET must be set in production")
            # Development only: a per-process secret (tokens reset on restart).
            self.jwt_secret = secrets.token_urlsafe(48)


settings = Settings()
