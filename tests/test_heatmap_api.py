import json


def test_heatmap_returns_200(client):
    resp = client.get("/api/analytics/heatmap?weeks=12")
    assert resp.status_code == 200


def test_heatmap_response_shape(client):
    resp = client.get("/api/analytics/heatmap?weeks=12")
    data = json.loads(resp.data)
    assert "daily_counts" in data
    assert "current_streak" in data
    assert "longest_streak" in data
    assert "total_completions" in data
    assert "start_date" in data
    assert "end_date" in data


def test_heatmap_daily_counts_are_positive(client):
    resp = client.get("/api/analytics/heatmap?weeks=12")
    data = json.loads(resp.data)
    for date_str, count in data["daily_counts"].items():
        assert count > 0, f"Count for {date_str} should be positive"


def test_heatmap_streak_non_negative(client):
    resp = client.get("/api/analytics/heatmap?weeks=12")
    data = json.loads(resp.data)
    assert data["current_streak"] >= 0
    assert data["longest_streak"] >= 0
    assert data["total_completions"] >= 0


def test_heatmap_weeks_param_clamped(client):
    resp = client.get("/api/analytics/heatmap?weeks=0")
    assert resp.status_code == 200

    resp = client.get("/api/analytics/heatmap?weeks=100")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["start_date"] is not None


def test_heatmap_default_weeks(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    data = json.loads(resp.data)
    assert data["start_date"] is not None


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200
