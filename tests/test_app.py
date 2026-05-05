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
    assert "range" in payload
    assert "month_labels" in payload
    assert "weeks" in payload
    assert "legend_levels" in payload
    assert "day_labels" in payload

    assert isinstance(payload["weeks"], list)
    assert len(payload["weeks"]) == 12

    first_week = payload["weeks"][0]
    assert "week_start" in first_week
    assert "days" in first_week
    assert len(first_week["days"]) == 7

    first_day = first_week["days"][0]
    assert "date" in first_day
    assert "count" in first_day
    assert "level" in first_day
