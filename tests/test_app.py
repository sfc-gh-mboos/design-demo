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


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_analytics_heatmap_uses_task_completions(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "summary" in data
    summary = data["summary"]
    assert "current_streak_days" in summary
    assert "longest_streak_days" in summary
    assert "total_completions" in summary
    assert summary["total_completions"] >= 0
    assert "range" in data
    assert "start" in data["range"] and "end" in data["range"]
    assert "month_labels" in data
    assert "weeks" in data
    assert len(data["weeks"]) == 12
    assert len(data["weeks"][0]["days"]) == 7
    assert data["day_labels"] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def test_create_task_defaults_is_focus(client):
    resp = client.post("/api/tasks", json={"title": "Focus default"})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data.get("is_focus") in (0, False)


def test_create_task_accepts_is_focus(client):
    resp = client.post("/api/tasks", json={"title": "Pinned", "is_focus": True})
    assert resp.status_code == 201
    assert resp.get_json().get("is_focus") == 1


def test_put_is_focus_and_clear_on_done(client):
    resp = client.post("/api/tasks", json={"title": "Toggle me"})
    assert resp.status_code == 201
    tid = resp.get_json()["id"]

    r = client.put(f"/api/tasks/{tid}", json={"is_focus": True})
    assert r.status_code == 200
    assert r.get_json().get("is_focus") == 1

    r2 = client.put(f"/api/tasks/{tid}", json={"status": "done"})
    assert r2.status_code == 200
    assert r2.get_json().get("status") == "done"
    assert r2.get_json().get("is_focus") == 0


def test_get_tasks_includes_is_focus(client):
    client.post("/api/tasks", json={"title": "Listed", "is_focus": True})
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    rows = resp.get_json()
    assert any(r.get("title") == "Listed" and r.get("is_focus") == 1 for r in rows)
