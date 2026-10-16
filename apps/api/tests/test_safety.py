from conftest import befriend
from reppilot_api.screening import screen_text

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100


def test_screening_blocks_sexual_and_allows_fitness_language():
    assert screen_text("send nudes").decision == "block"
    assert screen_text("s3nd nud3s").decision == "block"
    assert screen_text("kys loser").decision == "block"
    assert screen_text("you are so stupid").decision == "review"
    assert screen_text("you are all losers").decision == "review"
    for ok in ["Chest day: incline bench and hip thrusts", "Breast stroke laps after leg day", "New squat PR!"]:
        assert screen_text(ok).decision == "allow", ok


def test_blocked_text_is_rejected_and_borderline_is_held(people):
    a, b = people("a@x.com", "A"), people("b@x.com", "B")
    befriend(a, b)
    assert a.post("/posts", json={"body": "dm me for nudes"}).status_code == 422
    r = a.post("/posts", json={"body": "you are all losers lol", "visibility": "friends"})
    assert r.status_code == 201 and r.json()["status"] == "held" and r.json()["notice"]
    assert b.get(f"/posts/{r.json()['id']}").status_code == 404
    assert a.post(f"/messages/{b.id}", json={"body": "send nudes"}).status_code == 422


def test_media_is_never_visible_before_review(people):
    a, b, mod = people("a@x.com", "A"), people("b@x.com", "B"), people("mod@example.com", "Mod")
    befriend(a, b)
    assert a.post("/media", files={"file": ("x.png", b"not an image", "image/png")}).status_code == 415
    assert a.post("/media", files={"file": ("x.exe", b"MZ", "application/octet-stream")}).status_code == 415
    mid = a.post("/media", files={"file": ("x.png", PNG, "image/png")}).json()["id"]
    pid = a.post("/posts", json={"body": "Progress pic", "media_id": mid}).json()["id"]
    assert b.get(f"/posts/{pid}").status_code == 404
    assert b.get(f"/media/{mid}").status_code == 404
    assert a.get(f"/media/{mid}").status_code == 200
    assert b.post("/media", files={"file": ("y.png", PNG, "image/png")}).status_code == 201
    # Someone else's media cannot be attached.
    assert b.post("/posts", json={"body": "stolen", "media_id": mid}).status_code == 400
    assert mod.post("/moderation/decide", json={"target_type": "media", "target_id": mid, "action": "approve"}).status_code == 200
    assert b.get(f"/posts/{pid}").status_code == 200
    assert b.get(f"/media/{mid}").status_code == 200


def test_reports_auto_hide_and_moderation_flow(people):
    a = people("a@x.com", "A")
    pid = a.post("/posts", json={"body": "Buy my program", "visibility": "public"}).json()["id"]
    reporters = [people(f"r{i}@x.com", f"R{i}") for i in range(3)]
    assert a.post("/reports", json={"target_type": "post", "target_id": pid, "reason": "spam"}).status_code == 400
    for r in reporters:
        assert r.post("/reports", json={"target_type": "post", "target_id": pid, "reason": "spam"}).status_code == 201
    assert reporters[0].post("/reports", json={"target_type": "post", "target_id": pid, "reason": "spam"}).json()["status"] == "already_reported"
    assert reporters[0].get(f"/posts/{pid}").status_code == 404  # hidden pending review

    mod = people("mod@example.com", "Mod")
    assert a.get("/moderation/queue").status_code == 403
    q = mod.get("/moderation/queue").json()
    item = next(i for i in q["items"] if i["target_type"] == "post" and i["target_id"] == pid)
    assert item["report_count"] == 3
    assert mod.post("/moderation/decide", json={"target_type": "post", "target_id": pid, "action": "remove", "reason": "Spam"}).status_code == 200
    assert a.get("/me").json()["strikes"] == 1
    assert mod.get("/moderation/stats").json()["open_reports"] == 0


def test_repeat_offenders_are_suspended_and_can_appeal(people):
    a, mod, mod2 = people("a@x.com", "A"), people("mod@example.com", "Mod"), people("mod2@example.com", "Mod2")
    for i in range(3):
        pid = a.post("/posts", json={"body": f"spam {i}", "visibility": "public"}).json()["id"]
        mod.post("/moderation/decide", json={"target_type": "post", "target_id": pid, "action": "remove", "reason": "Spam"})
    me = a.get("/me").json()
    assert me["strikes"] == 3 and me["suspended"] is True
    assert a.post("/posts", json={"body": "hello"}).status_code == 403
    assert a.get("/feed").status_code == 200  # can still read and use workouts

    actions = a.get("/moderation/actions/mine").json()
    suspend = next(x for x in actions if x["action"] == "suspend")
    assert a.post("/appeals", json={"action_id": suspend["id"], "message": "Those were mistakes, sorry."}).status_code == 201
    assert a.post("/appeals", json={"action_id": suspend["id"], "message": "again please"}).status_code == 409
    # The deciding moderator for the suspension was "mod"; appeals go to someone else.
    appeal = mod2.get("/moderation/queue").json()["appeals"][0]
    assert mod.post(f"/moderation/appeals/{appeal['id']}", json={"decision": "overturn"}).status_code == 403
    assert mod2.post(f"/moderation/appeals/{appeal['id']}", json={"decision": "overturn", "response": "OK"}).json()["status"] == "overturned"
    assert a.get("/me").json()["suspended"] is False
    assert a.post("/posts", json={"body": "back to training"}).status_code == 201


def test_rate_limit_on_posts(people):
    a = people("a@x.com", "A")
    codes = [a.post("/posts", json={"body": f"post {i}"}).status_code for i in range(12)]
    assert codes.count(201) == 10 and codes[-1] == 429
