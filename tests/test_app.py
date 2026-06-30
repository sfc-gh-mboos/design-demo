def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_recap_page_returns_200(client):
    resp = client.get("/recap")
    assert resp.status_code == 200


def test_weekly_recap_api_payload_shape(client):
    resp = client.get("/api/analytics/weekly-recap")
    assert resp.status_code == 200
    data = resp.get_json()

    assert "summary" in data
    assert "daily" in data
    assert "range" in data

    summary = data["summary"]
    for key in ("completed", "created", "completion_rate", "avg_days_to_complete", "top_category"):
        assert key in summary

    assert isinstance(data["daily"], list)
    assert len(data["daily"]) == 7
    for day in data["daily"]:
        assert "date" in day
        assert "completed" in day

    assert data["range"]["start"]
    assert data["range"]["end"]
