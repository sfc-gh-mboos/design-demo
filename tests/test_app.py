def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_heatmap_api_contract(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200

    payload = resp.get_json()
    assert isinstance(payload, dict)
    assert "summary" in payload
    assert "range" in payload
    assert "month_labels" in payload
    assert "weeks" in payload
    assert "legend_levels" in payload
    assert "day_labels" in payload

    assert len(payload["weeks"]) == 12
    assert all(len(week["days"]) == 7 for week in payload["weeks"])
