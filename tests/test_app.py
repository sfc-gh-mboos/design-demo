from datetime import datetime


def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_heatmap_api_returns_expected_shape(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    payload = resp.get_json()

    assert "summary" in payload
    assert "weeks" in payload
    assert "month_labels" in payload
    assert "day_labels" in payload
    assert len(payload["weeks"]) == 12
    assert payload["day_labels"] == ["Mon", "Wed", "Fri", "Sun"]

    summary = payload["summary"]
    assert isinstance(summary["current_streak_days"], int)
    assert isinstance(summary["longest_streak_days"], int)
    assert isinstance(summary["total_completions"], int)

    for week in payload["weeks"]:
        assert "week_start" in week
        assert len(week["days"]) == 7
        for day in week["days"]:
            assert {"date", "count", "level"} <= day.keys()
            assert isinstance(day["count"], int)
            assert 0 <= day["level"] <= 5


def test_heatmap_api_range_matches_returned_dates(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    payload = resp.get_json()

    start = datetime.strptime(payload["range"]["start"], "%Y-%m-%d").date()
    end = datetime.strptime(payload["range"]["end"], "%Y-%m-%d").date()
    assert start <= end

    all_dates = []
    for week in payload["weeks"]:
        for day in week["days"]:
            all_dates.append(datetime.strptime(day["date"], "%Y-%m-%d").date())

    assert all_dates[0] == start
    assert all_dates[-1] == end
    assert len(all_dates) == 84
