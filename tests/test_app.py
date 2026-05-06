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
    assert set(payload.keys()) == {"summary", "range", "month_labels", "weeks", "legend_levels", "day_labels"}

    summary = payload["summary"]
    assert summary["current_streak_days"] >= 0
    assert summary["longest_streak_days"] >= 0
    assert summary["total_completions"] >= 0

    weeks = payload["weeks"]
    assert len(weeks) == 12
    assert all(len(week["days"]) == 7 for week in weeks)
