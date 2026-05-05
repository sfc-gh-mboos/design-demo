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
    assert "month_labels" in payload
    assert "weeks" in payload
    assert "legend_levels" in payload
    assert "day_labels" in payload

    summary = payload["summary"]
    assert "current_streak_days" in summary
    assert "longest_streak_days" in summary
    assert "total_completions" in summary

    weeks = payload["weeks"]
    assert len(weeks) == 12
    for week in weeks:
        assert "days" in week
        assert len(week["days"]) == 7
