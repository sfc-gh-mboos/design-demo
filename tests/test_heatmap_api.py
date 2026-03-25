import json


def test_heatmap_page_serves(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200
    assert b"Activity Heatmap" in resp.data


def test_heatmap_api_returns_200(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "days" in data
    assert "stats" in data
    assert "weeks" in data


def test_heatmap_api_default_weeks(client):
    resp = client.get("/api/analytics/heatmap")
    data = resp.get_json()
    assert data["weeks"] == 12


def test_heatmap_api_custom_weeks(client):
    resp = client.get("/api/analytics/heatmap?weeks=4")
    data = resp.get_json()
    assert data["weeks"] == 4
    assert len(data["days"]) > 0


def test_heatmap_api_weeks_clamped(client):
    resp = client.get("/api/analytics/heatmap?weeks=100")
    data = resp.get_json()
    assert data["weeks"] == 52

    resp = client.get("/api/analytics/heatmap?weeks=0")
    data = resp.get_json()
    assert data["weeks"] == 1


def test_heatmap_api_stats_shape(client):
    resp = client.get("/api/analytics/heatmap")
    stats = resp.get_json()["stats"]
    assert "current_streak" in stats
    assert "longest_streak" in stats
    assert "total_completions" in stats
    assert isinstance(stats["current_streak"], int)
    assert isinstance(stats["longest_streak"], int)
    assert isinstance(stats["total_completions"], int)


def test_heatmap_api_days_shape(client):
    resp = client.get("/api/analytics/heatmap")
    days = resp.get_json()["days"]
    assert isinstance(days, list)
    assert len(days) > 0
    day = days[0]
    assert "date" in day
    assert "count" in day
    assert isinstance(day["count"], int)


def test_heatmap_api_has_completions(client):
    resp = client.get("/api/analytics/heatmap")
    data = resp.get_json()
    total = sum(d["count"] for d in data["days"])
    assert total > 0
    assert data["stats"]["total_completions"] == total


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
