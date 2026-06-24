import json

import server


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


def test_heatmap_endpoint_respects_date_range(client):
    resp = client.get("/api/analytics/heatmap?start_date=2026-01-03&end_date=2026-01-09")
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["range_start"] == "2025-12-29"
    assert data["range_end"] == "2026-01-11"
    assert len(data["cells"]) % 7 == 0
    assert data["weeks"] == len(data["cells"]) // 7


def test_create_task_with_valid_due_date(client):
    today = server.today_iso()
    resp = client.post(
        "/api/tasks",
        data=json.dumps(
            {
                "title": "Due today task",
                "priority": "high",
                "due_date": today,
            }
        ),
        content_type="application/json",
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["due_date"] == today
    assert data["pinned_priority"] is False


def test_create_task_with_invalid_due_date(client):
    resp = client.post(
        "/api/tasks",
        data=json.dumps(
            {
                "title": "Bad date task",
                "due_date": "not-a-date",
            }
        ),
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "due_date" in resp.get_json()["error"]


def test_update_task_pins_when_eligible(client):
    today = server.today_iso()
    create_resp = client.post(
        "/api/tasks",
        data=json.dumps(
            {
                "title": "Pin me",
                "priority": "high",
                "due_date": today,
            }
        ),
        content_type="application/json",
    )
    task_id = create_resp.get_json()["id"]

    update_resp = client.put(
        f"/api/tasks/{task_id}",
        data=json.dumps({"pinned_priority": True}),
        content_type="application/json",
    )
    assert update_resp.status_code == 200
    data = update_resp.get_json()
    assert data["pinned_priority"] is True


def test_update_task_auto_unpins_when_not_high_priority(client):
    today = server.today_iso()
    create_resp = client.post(
        "/api/tasks",
        data=json.dumps(
            {
                "title": "Pinned then downgraded",
                "priority": "high",
                "due_date": today,
                "pinned_priority": True,
            }
        ),
        content_type="application/json",
    )
    task_id = create_resp.get_json()["id"]
    assert create_resp.get_json()["pinned_priority"] is True

    update_resp = client.put(
        f"/api/tasks/{task_id}",
        data=json.dumps({"priority": "medium"}),
        content_type="application/json",
    )
    assert update_resp.status_code == 200
    assert update_resp.get_json()["pinned_priority"] is False


def test_update_task_auto_unpins_when_due_date_not_today(client):
    today = server.today_iso()
    create_resp = client.post(
        "/api/tasks",
        data=json.dumps(
            {
                "title": "Pinned then rescheduled",
                "priority": "high",
                "due_date": today,
                "pinned_priority": True,
            }
        ),
        content_type="application/json",
    )
    task_id = create_resp.get_json()["id"]

    update_resp = client.put(
        f"/api/tasks/{task_id}",
        data=json.dumps({"due_date": "2099-01-01"}),
        content_type="application/json",
    )
    assert update_resp.status_code == 200
    data = update_resp.get_json()
    assert data["due_date"] == "2099-01-01"
    assert data["pinned_priority"] is False


def test_get_tasks_includes_due_date_and_pinned_priority(client):
    today = server.today_iso()
    client.post(
        "/api/tasks",
        data=json.dumps(
            {
                "title": "Listed task",
                "priority": "high",
                "due_date": today,
                "pinned_priority": True,
            }
        ),
        content_type="application/json",
    )

    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    tasks = resp.get_json()
    assert len(tasks) >= 1
    sample = next(task for task in tasks if task["title"] == "Listed task")
    assert sample["due_date"] == today
    assert sample["pinned_priority"] is True
