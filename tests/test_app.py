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


def test_heatmap_api_returns_expected_shape(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    data = resp.get_json()

    assert "summary" in data
    assert "month_labels" in data
    assert "rows" in data
    assert "legend_levels" in data
    assert "range" in data

    assert set(data["summary"].keys()) == {
        "current_streak_days",
        "longest_streak_days",
        "total_completions",
    }
    assert len(data["month_labels"]) == 12
    assert len(data["rows"]) == 7
    assert data["legend_levels"] == [0, 1, 2, 3, 4, 5]

    for row in data["rows"]:
        assert "label" in row
        assert "cells" in row
        assert len(row["cells"]) == 12
        for cell in row["cells"]:
            assert "date" in cell
            assert "count" in cell
            assert "level" in cell
            assert 0 <= cell["level"] <= 5


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_tasks_include_is_focus_field(client):
    resp = client.get("/api/tasks")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) > 0
    for row in data:
        assert "is_focus" in row
        assert row["is_focus"] in (0, 1)


def test_put_sets_is_focus(client):
    create = client.post(
        "/api/tasks",
        json={"title": "Focus test task", "category": "Planning", "priority": "medium"},
    )
    assert create.status_code == 201
    task_id = create.get_json()["id"]
    assert create.get_json().get("is_focus", 0) in (0, False)

    put_on = client.put(f"/api/tasks/{task_id}", json={"is_focus": True})
    assert put_on.status_code == 200
    assert put_on.get_json()["is_focus"] in (1, True)

    put_off = client.put(f"/api/tasks/{task_id}", json={"is_focus": False})
    assert put_off.status_code == 200
    assert put_off.get_json()["is_focus"] in (0, False)


def test_get_tasks_focus_filter(client):
    ids = []
    for i in range(3):
        r = client.post("/api/tasks", json={"title": f"Focus filter {i}", "category": "Design"})
        assert r.status_code == 201
        ids.append(r.get_json()["id"])

    client.put(f"/api/tasks/{ids[0]}", json={"is_focus": True})
    client.put(f"/api/tasks/{ids[1]}", json={"is_focus": True})

    resp = client.get("/api/tasks?focus=true")
    assert resp.status_code == 200
    focused = resp.get_json()
    focused_ids = {t["id"] for t in focused}
    assert ids[0] in focused_ids
    assert ids[1] in focused_ids
    assert ids[2] not in focused_ids
    assert all(t.get("is_focus") in (1, True) for t in focused)


def test_clear_focus_endpoint(client):
    ids = []
    for i in range(2):
        r = client.post("/api/tasks", json={"title": f"Clear focus {i}", "category": "Operations"})
        assert r.status_code == 201
        ids.append(r.get_json()["id"])
    client.put(f"/api/tasks/{ids[0]}", json={"is_focus": True})
    client.put(f"/api/tasks/{ids[1]}", json={"is_focus": True})

    clear = client.post("/api/tasks/clear-focus")
    assert clear.status_code == 204

    resp = client.get("/api/tasks")
    tasks = {t["id"]: t for t in resp.get_json()}
    assert tasks[ids[0]]["is_focus"] in (0, False)
    assert tasks[ids[1]]["is_focus"] in (0, False)
