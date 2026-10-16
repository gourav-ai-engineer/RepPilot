from conftest import befriend


def _cid(p, slug):
    return next(c["id"] for c in p.get("/challenges").json() if c["slug"] == slug)


def test_join_submit_and_leaderboard(people):
    a, b = people("a@x.com", "A"), people("b@x.com", "B")
    cid = _cid(a, "pushups_max")
    assert a.post(f"/challenges/{cid}/entries", json={"value": 20}).status_code == 400
    a.post(f"/challenges/{cid}/join", json={})
    b.post(f"/challenges/{cid}/join", json={})
    assert a.post(f"/challenges/{cid}/entries", json={"value": 20}).status_code == 201
    assert a.post(f"/challenges/{cid}/entries", json={"value": 25}).status_code == 429  # one a day
    assert b.post(f"/challenges/{cid}/entries", json={"value": 30}).status_code == 201
    board = a.get(f"/challenges/{cid}/leaderboard").json()
    assert [r["value"] for r in board["rows"]] == [30, 20]
    assert board["my_row"]["rank"] == 2
    assert a.get(f"/challenges/{cid}/leaderboard?scope=friends").json()["rows"][0]["user_id"] == a.id
    befriend(a, b)
    assert len(a.get(f"/challenges/{cid}/leaderboard?scope=friends").json()["rows"]) == 2


def test_implausible_entries_are_held(people):
    a = people("a@x.com", "A")
    cid = _cid(a, "pushups_max")
    a.post(f"/challenges/{cid}/join", json={})
    r = a.post(f"/challenges/{cid}/entries", json={"value": 900})
    assert r.json()["status"] == "held" and r.json()["notice"]
    assert a.get(f"/challenges/{cid}/leaderboard").json()["rows"] == []


def test_leaderboard_privacy_and_blocks(people):
    a, b = people("a@x.com", "A"), people("b@x.com", "B")
    cid = _cid(a, "plank_hold")
    a.post(f"/challenges/{cid}/join", json={"show_on_leaderboard": False})
    b.post(f"/challenges/{cid}/join", json={})
    a.post(f"/challenges/{cid}/entries", json={"value": 60})
    b.post(f"/challenges/{cid}/entries", json={"value": 90})
    assert [r["user_id"] for r in b.get(f"/challenges/{cid}/leaderboard").json()["rows"]] == [b.id]
    assert {r["user_id"] for r in a.get(f"/challenges/{cid}/leaderboard").json()["rows"]} == {a.id, b.id}
    a.post(f"/blocks/{b.id}")
    assert [r["user_id"] for r in a.get(f"/challenges/{cid}/leaderboard").json()["rows"]] == [a.id]


def test_heavy_lift_challenge_rules(people):
    a = people("a@x.com", "A")
    c = next(c for c in a.get("/challenges").json() if c["slug"] == "bench_5rm")
    assert "never a one-rep max" in c["description"]
    assert "spotter" in c["rules"]
