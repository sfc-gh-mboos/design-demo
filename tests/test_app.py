def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_analytics_trends_excludes_delivery_timeline(client):
    resp = client.get("/api/analytics/trends?cohort=all")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "daily_volume" in data
    assert "delivery_timeline" not in data


def test_heatmap_api_removed(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 404


def test_heatmap_page_removed(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 404


def test_tasks_response_excludes_is_focus(client):
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) > 0
    expected_keys = {"id", "title", "status", "category", "priority", "created_at", "completed_at", "user_id"}
    for row in data:
        assert "is_focus" not in row
        assert expected_keys <= row.keys()


def test_clear_focus_endpoint_removed(client):
    r = client.post("/api/tasks/clear-focus")
    assert r.status_code == 405


def test_get_tasks_focus_query_param_no_longer_filters(client):
    """`?focus=true` used to narrow to focused tasks; it is ignored now."""
    r = client.post("/api/tasks", json={"title": "Focus query param task", "category": "Design"})
    assert r.status_code == 201
    all_tasks = client.get("/api/tasks").get_json()
    focused_query = client.get("/api/tasks?focus=true").get_json()
    assert len(focused_query) == len(all_tasks)


# --- Auth pages ---


def test_signup_page_returns_200(client):
    resp = client.get("/signup")
    assert resp.status_code == 200
    assert b"Create your profile" in resp.data


def test_login_page_returns_200(client):
    resp = client.get("/login")
    assert resp.status_code == 200
    assert b"Welcome back" in resp.data


def test_metrics_page_returns_200(client):
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert b"My Metrics" in resp.data


# --- Auth API: signup ---


def test_signup_creates_user_and_session(client):
    resp = client.post(
        "/api/auth/signup",
        json={"username": "alex.doe", "password": "hunter22", "display_name": "Alex Doe"},
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["username"] == "alex.doe"
    assert body["display_name"] == "Alex Doe"
    assert "id" in body
    assert "password_hash" not in body

    # Session was created; /me returns current user without further auth.
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["username"] == "alex.doe"


def test_signup_rejects_invalid_username(client):
    resp = client.post("/api/auth/signup", json={"username": "x", "password": "hunter22"})
    assert resp.status_code == 400
    assert "username" in resp.get_json()["error"].lower()


def test_signup_rejects_short_password(client):
    resp = client.post(
        "/api/auth/signup", json={"username": "newuser", "password": "abc"}
    )
    assert resp.status_code == 400
    assert "password" in resp.get_json()["error"].lower()


def test_signup_rejects_duplicate_username(client):
    client.post("/api/auth/signup", json={"username": "twin", "password": "hunter22"})
    resp = client.post("/api/auth/signup", json={"username": "twin", "password": "hunter22"})
    assert resp.status_code == 409


def test_signup_lowercases_username(client):
    resp = client.post(
        "/api/auth/signup", json={"username": "MixedCase", "password": "hunter22"}
    )
    assert resp.status_code == 201
    assert resp.get_json()["username"] == "mixedcase"


def test_signup_defaults_display_name_to_username(client):
    resp = client.post(
        "/api/auth/signup", json={"username": "anon", "password": "hunter22"}
    )
    assert resp.status_code == 201
    assert resp.get_json()["display_name"] == "anon"


# --- Auth API: login / logout / me ---


def _signup(client, username="alice", password="hunter22", display_name=None):
    body = {"username": username, "password": password}
    if display_name:
        body["display_name"] = display_name
    return client.post("/api/auth/signup", json=body)


def test_login_returns_user_and_creates_session(client):
    _signup(client, username="loginuser", password="goodpass1")
    client.post("/api/auth/logout")
    resp = client.post(
        "/api/auth/login", json={"username": "loginuser", "password": "goodpass1"}
    )
    assert resp.status_code == 200
    assert resp.get_json()["username"] == "loginuser"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["username"] == "loginuser"


def test_login_rejects_bad_password(client):
    _signup(client, username="alice", password="hunter22")
    client.post("/api/auth/logout")
    resp = client.post(
        "/api/auth/login", json={"username": "alice", "password": "wrong-password"}
    )
    assert resp.status_code == 401


def test_login_rejects_unknown_user(client):
    resp = client.post(
        "/api/auth/login", json={"username": "ghost", "password": "hunter22"}
    )
    assert resp.status_code == 401


def test_logout_clears_session(client):
    _signup(client, username="logout_user", password="hunter22")
    me_before = client.get("/api/auth/me")
    assert me_before.status_code == 200

    resp = client.post("/api/auth/logout")
    assert resp.status_code == 204

    me_after = client.get("/api/auth/me")
    assert me_after.status_code == 401


def test_me_returns_401_when_anonymous(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


# --- Tasks user_id integration ---


def test_create_task_attaches_user_id_when_authenticated(client):
    signup = _signup(client, username="taskowner", password="hunter22")
    user_id = signup.get_json()["id"]
    resp = client.post(
        "/api/tasks", json={"title": "Authed task", "category": "Engineering"}
    )
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["user_id"] == user_id


def test_create_task_user_id_null_when_anonymous(client):
    resp = client.post(
        "/api/tasks", json={"title": "Anon task", "category": "Engineering"}
    )
    assert resp.status_code == 201
    assert resp.get_json()["user_id"] is None


def test_tasks_mine_filter_returns_only_current_user_tasks(client):
    _signup(client, username="filterowner", password="hunter22")
    client.post("/api/tasks", json={"title": "Mine task", "category": "Planning"})
    all_tasks = client.get("/api/tasks").get_json()
    mine = client.get("/api/tasks?mine=true").get_json()
    assert len(mine) == 1
    assert all(t["user_id"] is not None for t in mine)
    assert len(mine) < len(all_tasks)  # demo seed rows are excluded


def test_tasks_mine_filter_requires_auth(client):
    resp = client.get("/api/tasks?mine=true")
    assert resp.status_code == 401


# --- Metrics API ---


def test_metrics_me_requires_auth(client):
    resp = client.get("/api/metrics/me")
    assert resp.status_code == 401


def test_metrics_me_returns_zeroes_for_new_user(client):
    _signup(client, username="newusermetrics", password="hunter22")
    resp = client.get("/api/metrics/me")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["user"]["username"] == "newusermetrics"
    assert body["metrics"]["total_tasks"] == 0
    assert body["metrics"]["completion_rate"] == 0
    assert body["metrics"]["streak_days"] == 0
    assert body["metrics"]["completed_last_7_days"] == 0
    assert body["metrics"]["by_status"]["todo"] == 0
    assert isinstance(body["metrics"]["daily_volume"], list)
    assert len(body["metrics"]["daily_volume"]) == 14


def test_metrics_me_reflects_user_tasks_and_completion(client):
    _signup(client, username="busybee", password="hunter22")
    # Create three tasks; complete two.
    created = []
    for title in ("First", "Second", "Third"):
        r = client.post("/api/tasks", json={"title": title, "category": "Planning"})
        assert r.status_code == 201
        created.append(r.get_json())
    for task in created[:2]:
        r = client.put(f"/api/tasks/{task['id']}", json={"status": "done"})
        assert r.status_code == 200

    resp = client.get("/api/metrics/me")
    assert resp.status_code == 200
    metrics = resp.get_json()["metrics"]
    assert metrics["total_tasks"] == 3
    assert metrics["by_status"]["done"] == 2
    assert metrics["completion_rate"] == 66.7
    assert metrics["streak_days"] >= 1  # both completions are today
    assert metrics["completed_last_7_days"] == 2


def test_metrics_me_isolated_per_user(client):
    # User A creates 2 tasks
    a = _signup(client, username="user_a", password="hunter22")
    assert a.status_code == 201, a.get_json()
    client.post("/api/tasks", json={"title": "A1", "category": "Planning"})
    client.post("/api/tasks", json={"title": "A2", "category": "Planning"})
    client.post("/api/auth/logout")

    # User B creates 1 task
    b = _signup(client, username="user_b", password="hunter22")
    assert b.status_code == 201, b.get_json()
    client.post("/api/tasks", json={"title": "B1", "category": "Planning"})

    metrics_b = client.get("/api/metrics/me").get_json()["metrics"]
    assert metrics_b["total_tasks"] == 1

    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "user_a", "password": "hunter22"})
    metrics_a = client.get("/api/metrics/me").get_json()["metrics"]
    assert metrics_a["total_tasks"] == 2
