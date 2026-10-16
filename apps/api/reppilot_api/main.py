import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, SessionLocal, engine
from .routers import auth, challenges, media, messages, moderation, people, posts, reports, sync

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fine for the pilot. Use migrations (e.g. Alembic) before schema changes in production.
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        challenges.seed_challenges(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="RepPilot API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )
    for r in (auth.router, auth.me_router, sync.router, people.router, posts.feed_router, posts.router,
              media.router, reports.router, messages.router, challenges.router, moderation.router):
        app.include_router(r)

    @app.get("/health", tags=["meta"])
    def health():
        return {"ok": True}

    return app


app = create_app()
