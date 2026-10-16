from datetime import date


def test_register_requires_adult_and_standards(client):
    base = {"email": "a@x.com", "password": "longenough1", "display_name": "A", "accept_community_standards": True}
    teen = date.today().replace(year=date.today().year - 16).isoformat()
    assert client.post("/auth/register", json={**base, "date_of_birth": teen}).status_code == 403
    assert client.post("/auth/register", json={**base, "date_of_birth": "1990-01-01", "accept_community_standards": False}).status_code == 400
    assert client.post("/auth/register", json={**base, "date_of_birth": "1990-01-01"}).status_code == 201
    assert client.post("/auth/register", json={**base, "date_of_birth": "1990-01-01"}).status_code == 409


def test_login_and_me(client, people):
    p = people("me@x.com", "Me")
    assert client.post("/auth/login", json={"email": "ME@x.com", "password": "wrong-password"}).status_code == 401
    r = client.post("/auth/login", json={"email": "ME@x.com", "password": "correct-horse-1"})
    assert r.status_code == 200
    assert p.get("/me").json()["display_name"] == "Me"
    assert client.get("/me").status_code == 401
    assert client.get("/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401


def test_moderator_role_from_config(people):
    assert people("mod@example.com", "Mod").get("/me").json()["role"] == "moderator"
    assert people("u@x.com", "U").get("/me").json()["role"] == "member"


def test_sync_versioning_prevents_lost_updates(people):
    p = people("s@x.com", "S")
    assert p.get("/sync").json()["version"] == 0
    r1 = p.put("/sync", json={"base_version": 0, "data": {"logs": [1]}})
    assert r1.json()["version"] == 1
    # A second device still on version 0 must not overwrite.
    stale = p.put("/sync", json={"base_version": 0, "data": {"logs": [2]}})
    assert stale.status_code == 409
    assert stale.json()["detail"]["data"] == {"logs": [1]}
    assert p.put("/sync", json={"base_version": 1, "data": {"logs": [1, 2]}}).json()["version"] == 2
    assert p.get("/sync").json()["data"] == {"logs": [1, 2]}


def test_delete_account_removes_everything(client, people):
    p = people("d@x.com", "D")
    p.post("/posts", json={"body": "Leg day done"})
    assert p.delete("/me").status_code == 204
    assert client.post("/auth/login", json={"email": "d@x.com", "password": "correct-horse-1"}).status_code == 401
