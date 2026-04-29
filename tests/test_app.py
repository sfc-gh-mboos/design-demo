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
    expected_keys = {"id", "title", "status", "category", "priority", "created_at", "completed_at"}
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
