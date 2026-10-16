from conftest import befriend


def test_friend_requests_and_visibility(people):
    a, b, c = people("a@x.com", "Asha"), people("b@x.com", "Bhavesh"), people("c@x.com", "Chitra")
    pid = a.post("/posts", json={"body": "Finished my first week!", "visibility": "friends"}).json()["id"]
    pub = a.post("/posts", json={"body": "Public PR post", "visibility": "public"}).json()["id"]
    priv = a.post("/posts", json={"body": "Note to self", "visibility": "private"}).json()["id"]
    assert b.get(f"/posts/{pid}").status_code == 404
    befriend(a, b)
    assert b.get(f"/posts/{pid}").status_code == 200
    assert b.get(f"/posts/{priv}").status_code == 404
    assert c.get(f"/posts/{pub}").status_code == 200
    assert {p["id"] for p in b.get("/feed").json()} == {pid, pub}
    assert {p["id"] for p in c.get("/feed?scope=everyone").json()} == {pub}


def test_likes_and_comments(people):
    a, b = people("a@x.com", "A"), people("b@x.com", "B")
    befriend(a, b)
    pid = a.post("/posts", json={"body": "Squats today"}).json()["id"]
    assert b.post(f"/posts/{pid}/like").status_code == 204
    b.post(f"/posts/{pid}/like")
    assert a.get(f"/posts/{pid}").json()["like_count"] == 1
    cid = b.post(f"/posts/{pid}/comments", json={"body": "Great work!"}).json()["id"]
    assert a.get(f"/posts/{pid}").json()["comment_count"] == 1
    # Post owner can remove comments on their post.
    assert a.delete(f"/posts/{pid}/comments/{cid}").status_code == 204


def test_block_hides_everything_and_ends_friendship(people):
    a, b = people("a@x.com", "Asha"), people("b@x.com", "Bhavesh")
    a.patch("/me", json={"profile_visibility": "public"})
    assert len(b.get("/users/search?q=As").json()) == 1
    befriend(a, b)
    pid = a.post("/posts", json={"body": "Hello", "visibility": "public"}).json()["id"]
    assert b.post(f"/blocks/{a.id}").status_code == 204
    assert a.get(f"/posts/{pid}").status_code == 200
    assert b.get(f"/posts/{pid}").status_code == 404
    assert b.get("/friends").json() == []
    assert a.post(f"/messages/{b.id}", json={"body": "hi"}).status_code == 403
    assert a.post(f"/friends/requests/{b.id}").status_code == 404
    assert b.get("/users/search?q=As").json() == []


def test_search_shows_only_public_profiles(people):
    a, b = people("a@x.com", "Gourav"), people("b@x.com", "Gourav Two")
    assert a.get("/users/search?q=gourav").json() == []
    b.patch("/me", json={"profile_visibility": "public"})
    assert [p["id"] for p in a.get("/users/search?q=gourav").json()] == [b.id]


def test_messages_only_between_friends(people):
    a, b = people("a@x.com", "A"), people("b@x.com", "B")
    assert a.post(f"/messages/{b.id}", json={"body": "hi"}).status_code == 403
    befriend(a, b)
    assert a.post(f"/messages/{b.id}", json={"body": "Gym at 6?"}).status_code == 201
    conv = b.get("/conversations").json()
    assert conv[0]["unread"] == 1
    assert [m["body"] for m in b.get(f"/messages/{a.id}").json()] == ["Gym at 6?"]
    assert b.get("/conversations").json()[0]["unread"] == 0


def test_edit_and_delete_own_post_only(people):
    a, b = people("a@x.com", "A"), people("b@x.com", "B")
    pid = a.post("/posts", json={"body": "v1", "visibility": "public"}).json()["id"]
    assert b.patch(f"/posts/{pid}", json={"body": "hacked"}).status_code == 404
    assert b.delete(f"/posts/{pid}").status_code == 404
    r = a.patch(f"/posts/{pid}", json={"body": "v2"})
    assert r.json()["body"] == "v2" and r.json()["edited"] is True
    assert a.delete(f"/posts/{pid}").status_code == 204
