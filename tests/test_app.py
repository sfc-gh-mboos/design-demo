def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def signup(client, email="ada@example.com", name="Ada Lovelace", password="correct horse battery staple"):
    return client.post(
        "/api/auth/signup",
        json={"name": name, "email": email, "password": password},
    )


def test_signup_creates_profile_and_session(client):
    resp = signup(client)

    assert resp.status_code == 201
    payload = resp.get_json()
    assert payload["user"]["name"] == "Ada Lovelace"
    assert payload["user"]["email"] == "ada@example.com"
    assert "password" not in payload["user"]

    profile = client.get("/api/profile")
    assert profile.status_code == 200
    assert profile.get_json()["user"]["email"] == "ada@example.com"


def test_login_rejects_invalid_password_and_accepts_valid_password(client):
    signup(client, email="grace@example.com", name="Grace Hopper", password="s3cret-pass")
    client.post("/api/auth/logout")

    rejected = client.post(
        "/api/auth/login",
        json={"email": "grace@example.com", "password": "wrong-pass"},
    )
    assert rejected.status_code == 401

    accepted = client.post(
        "/api/auth/login",
        json={"email": "grace@example.com", "password": "s3cret-pass"},
    )
    assert accepted.status_code == 200
    assert accepted.get_json()["user"]["name"] == "Grace Hopper"


def test_tasks_require_login_and_are_scoped_to_profile(client):
    unauthenticated = client.get("/api/tasks")
    assert unauthenticated.status_code == 401

    signup(client, email="one@example.com", name="One User")
    created = client.post("/api/tasks", json={"title": "One user's private task"})
    assert created.status_code == 201
    first_user_task_id = created.get_json()["id"]
    assert len(client.get("/api/tasks").get_json()) == 1

    client.post("/api/auth/logout")
    signup(client, email="two@example.com", name="Two User")
    assert client.get("/api/tasks").get_json() == []

    forbidden_update = client.put(
        f"/api/tasks/{first_user_task_id}",
        json={"status": "done"},
    )
    assert forbidden_update.status_code == 404


def test_profile_stats_only_include_current_users_tasks(client):
    signup(client)
    todo = client.post("/api/tasks", json={"title": "Plan launch", "priority": "high"}).get_json()
    in_progress = client.post("/api/tasks", json={"title": "Build auth", "priority": "medium"}).get_json()
    done = client.post("/api/tasks", json={"title": "Ship stats", "priority": "low"}).get_json()
    client.put(f"/api/tasks/{in_progress['id']}", json={"status": "in-progress"})
    client.put(f"/api/tasks/{done['id']}", json={"status": "done"})

    client.post("/api/auth/logout")
    signup(client, email="other@example.com", name="Other User")
    client.post("/api/tasks", json={"title": "Other task"})
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/login",
        json={"email": "ada@example.com", "password": "correct horse battery staple"},
    )

    stats = client.get("/api/profile/stats")

    assert stats.status_code == 200
    assert stats.get_json() == {
        "total_tasks": 3,
        "todo_tasks": 1,
        "in_progress_tasks": 1,
        "completed_tasks": 1,
        "completion_rate": 33.3,
        "high_priority_tasks": 1,
    }


def test_rejects_invalid_task_status(client):
    signup(client)
    task = client.post("/api/tasks", json={"title": "Validate status"}).get_json()

    resp = client.put(f"/api/tasks/{task['id']}", json={"status": "blocked"})

    assert resp.status_code == 400
    assert resp.get_json()["error"] == "status must be one of: todo, in-progress, done"


def test_heatmap_requires_login_and_only_includes_current_user(client):
    unauthenticated = client.get("/api/analytics/heatmap")
    assert unauthenticated.status_code == 401

    signup(client, email="heatmap-one@example.com", name="Heatmap One")
    first = client.post("/api/tasks", json={"title": "First completion"}).get_json()
    client.put(f"/api/tasks/{first['id']}", json={"status": "done"})
    client.post("/api/auth/logout")

    signup(client, email="heatmap-two@example.com", name="Heatmap Two")
    second = client.post("/api/tasks", json={"title": "Second completion"}).get_json()
    client.put(f"/api/tasks/{second['id']}", json={"status": "done"})

    heatmap = client.get("/api/analytics/heatmap")

    assert heatmap.status_code == 200
    assert heatmap.get_json()["summary"]["total_completions"] == 1
