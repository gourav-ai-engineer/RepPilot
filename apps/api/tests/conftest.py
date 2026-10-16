import os
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["MODERATOR_EMAILS"] = "mod@example.com,mod2@example.com"
os.environ["MEDIA_DIR"] = f"{_tmp}/media"
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-signing"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from reppilot_api import ratelimit  # noqa: E402
from reppilot_api.db import Base, engine  # noqa: E402
from reppilot_api.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    ratelimit.reset()
    with TestClient(app) as c:  # lifespan creates tables and seeds challenges
        yield c


class Person:
    def __init__(self, client: TestClient, email: str, name: str):
        r = client.post("/auth/register", json={
            "email": email, "password": "correct-horse-1", "display_name": name,
            "date_of_birth": "1995-05-05", "accept_community_standards": True,
        })
        assert r.status_code == 201, r.text
        self.c = client
        self.token = r.json()["token"]
        self.id = r.json()["user"]["id"]
        self.h = {"Authorization": f"Bearer {self.token}"}

    def get(self, url, **kw):
        return self.c.get(url, headers=self.h, **kw)

    def post(self, url, **kw):
        return self.c.post(url, headers=self.h, **kw)

    def put(self, url, **kw):
        return self.c.put(url, headers=self.h, **kw)

    def patch(self, url, **kw):
        return self.c.patch(url, headers=self.h, **kw)

    def delete(self, url, **kw):
        return self.c.delete(url, headers=self.h, **kw)


@pytest.fixture()
def people(client):
    def make(email: str, name: str) -> Person:
        return Person(client, email, name)
    return make


def befriend(a: Person, b: Person) -> None:
    a.post(f"/friends/requests/{b.id}")
    req = b.get("/friends/requests").json()[0]
    assert b.post(f"/friends/requests/{req['id']}/accept").status_code == 200
