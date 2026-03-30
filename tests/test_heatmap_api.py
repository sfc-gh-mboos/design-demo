import json
from datetime import datetime, timedelta, timezone


def test_heatmap_endpoint_returns_200(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200


def test_heatmap_response_structure(client):
    resp = client.get("/api/analytics/heatmap")
    data = json.loads(resp.data)

    assert "start_date" in data
    assert "end_date" in data
    assert "daily_counts" in data
    assert "current_streak" in data
    assert "longest_streak" in data
    assert "total_completions" in data


def test_heatmap_default_weeks(client):
    resp = client.get("/api/analytics/heatmap")
    data = json.loads(resp.data)

    start = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
    end = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
    diff = (end - start).days
    assert 77 <= diff <= 90


def test_heatmap_custom_weeks(client):
    resp = client.get("/api/analytics/heatmap?weeks=4")
    data = json.loads(resp.data)

    start = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
    end = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
    diff = (end - start).days
    assert 21 <= diff <= 35


def test_heatmap_weeks_clamped(client):
    resp = client.get("/api/analytics/heatmap?weeks=0")
    assert resp.status_code == 200

    resp = client.get("/api/analytics/heatmap?weeks=100")
    data = json.loads(resp.data)
    start = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
    end = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
    diff = (end - start).days
    assert diff <= 370


def test_heatmap_daily_counts_are_nonnegative(client):
    resp = client.get("/api/analytics/heatmap")
    data = json.loads(resp.data)
    for count in data["daily_counts"].values():
        assert count >= 0


def test_heatmap_total_matches_sum(client):
    resp = client.get("/api/analytics/heatmap")
    data = json.loads(resp.data)
    assert data["total_completions"] == sum(data["daily_counts"].values())


def test_heatmap_streaks_are_nonnegative(client):
    resp = client.get("/api/analytics/heatmap")
    data = json.loads(resp.data)
    assert data["current_streak"] >= 0
    assert data["longest_streak"] >= 0
    assert data["longest_streak"] >= data["current_streak"]


def test_heatmap_page_serves(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200
    assert b"Activity Heatmap" in resp.data
