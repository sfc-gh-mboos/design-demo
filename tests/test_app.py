def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_heatmap_endpoint_returns_grid_and_summary(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["weeks"] == 12
    assert data["day_labels"] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    assert len(data["cells"]) == 84

    summary = data["summary"]
    assert "current_streak" in summary
    assert "longest_streak" in summary
    assert "total_completions" in summary
    assert summary["current_streak"] >= 0
    assert summary["longest_streak"] >= 0
    assert summary["total_completions"] >= 0

    first_cell = data["cells"][0]
    assert set(first_cell.keys()) == {"date", "week_index", "day_index", "count", "intensity_level"}
    assert 0 <= first_cell["intensity_level"] <= 5


def test_heatmap_endpoint_respects_date_range(client):
    resp = client.get("/api/analytics/heatmap?start_date=2026-01-03&end_date=2026-01-09")
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["range_start"] == "2025-12-29"
    assert data["range_end"] == "2026-01-11"
    assert len(data["cells"]) % 7 == 0
    assert data["weeks"] == len(data["cells"]) // 7


def test_create_task_defaults_focus_today_false(client):
    resp = client.post("/api/tasks", json={"title": "Focus lane test task"})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["focus_today"] is False


def test_get_tasks_includes_focus_today(client):
    create_resp = client.post("/api/tasks", json={"title": "Pinned task"})
    assert create_resp.status_code == 201
    task_id = create_resp.get_json()["id"]

    update_resp = client.put(f"/api/tasks/{task_id}", json={"focus_today": True})
    assert update_resp.status_code == 200
    assert update_resp.get_json()["focus_today"] is True

    list_resp = client.get("/api/tasks")
    assert list_resp.status_code == 200
    tasks = list_resp.get_json()
    pinned = next(task for task in tasks if task["id"] == task_id)
    assert pinned["focus_today"] is True


def test_update_task_toggles_focus_today(client):
    create_resp = client.post("/api/tasks", json={"title": "Toggle focus task"})
    assert create_resp.status_code == 201
    task_id = create_resp.get_json()["id"]

    pin_resp = client.put(f"/api/tasks/{task_id}", json={"focus_today": True})
    assert pin_resp.status_code == 200
    assert pin_resp.get_json()["focus_today"] is True

    unpin_resp = client.put(f"/api/tasks/{task_id}", json={"focus_today": False})
    assert unpin_resp.status_code == 200
    assert unpin_resp.get_json()["focus_today"] is False


def test_update_task_rejects_invalid_focus_today(client):
    create_resp = client.post("/api/tasks", json={"title": "Invalid focus task"})
    assert create_resp.status_code == 201
    task_id = create_resp.get_json()["id"]

    resp = client.put(f"/api/tasks/{task_id}", json={"focus_today": "maybe"})
    assert resp.status_code == 400
    assert "focus_today" in resp.get_json()["error"]
