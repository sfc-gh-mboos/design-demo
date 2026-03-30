def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200
    assert b"Activity Heatmap" in resp.data


def test_heatmap_api_returns_200(client):
    resp = client.get("/api/analytics/heatmap?weeks=12")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "current_streak" in data
    assert "longest_streak" in data
    assert "total_completions" in data
    assert "weeks" in data


def test_heatmap_api_returns_correct_weeks(client):
    resp = client.get("/api/analytics/heatmap?weeks=4")
    data = resp.get_json()
    assert len(data["weeks"]) == 4
    for week in data["weeks"]:
        assert "week_start" in week
        assert "days" in week
        assert len(week["days"]) == 7


def test_heatmap_api_day_structure(client):
    resp = client.get("/api/analytics/heatmap?weeks=1")
    data = resp.get_json()
    day = data["weeks"][0]["days"][0]
    assert "date" in day
    assert "count" in day
    assert "level" in day
    assert "future" in day


def test_heatmap_api_levels_in_range(client):
    resp = client.get("/api/analytics/heatmap?weeks=12")
    data = resp.get_json()
    for week in data["weeks"]:
        for day in week["days"]:
            assert day["level"] >= -1 and day["level"] <= 5


def test_heatmap_api_default_weeks(client):
    resp = client.get("/api/analytics/heatmap")
    data = resp.get_json()
    assert len(data["weeks"]) == 12


def test_heatmap_api_weeks_clamped(client):
    resp = client.get("/api/analytics/heatmap?weeks=100")
    data = resp.get_json()
    assert len(data["weeks"]) == 52

    resp = client.get("/api/analytics/heatmap?weeks=0")
    data = resp.get_json()
    assert len(data["weeks"]) == 1


def test_heatmap_api_streak_types(client):
    resp = client.get("/api/analytics/heatmap?weeks=4")
    data = resp.get_json()
    assert isinstance(data["current_streak"], int)
    assert isinstance(data["longest_streak"], int)
    assert isinstance(data["total_completions"], int)
    assert data["current_streak"] >= 0
    assert data["longest_streak"] >= 0
    assert data["total_completions"] >= 0


# --- POST /api/tasks tests ---


def test_create_task_success(client):
    resp = client.post("/api/tasks", json={
        "title": "Test task",
        "category": "Design",
        "priority": "high",
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["title"] == "Test task"
    assert data["category"] == "Design"
    assert data["priority"] == "high"
    assert data["status"] == "todo"
    assert data["id"] is not None


def test_create_task_defaults(client):
    resp = client.post("/api/tasks", json={"title": "Minimal task"})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["title"] == "Minimal task"
    assert data["category"] == "Planning"
    assert data["priority"] == "medium"
    assert data["status"] == "todo"


def test_create_task_missing_title(client):
    resp = client.post("/api/tasks", json={"category": "Design"})
    assert resp.status_code == 400
    assert "title" in resp.get_json()["error"].lower()


def test_create_task_empty_title(client):
    resp = client.post("/api/tasks", json={"title": "   "})
    assert resp.status_code == 400


def test_create_task_invalid_priority_falls_back(client):
    resp = client.post("/api/tasks", json={
        "title": "Priority fallback",
        "priority": "critical",
    })
    assert resp.status_code == 201
    assert resp.get_json()["priority"] == "medium"


def test_created_task_appears_in_list(client):
    client.post("/api/tasks", json={"title": "Findable task", "category": "Operations"})
    resp = client.get("/api/tasks")
    titles = [t["title"] for t in resp.get_json()]
    assert "Findable task" in titles
