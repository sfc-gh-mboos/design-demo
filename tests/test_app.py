def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_heatmap_endpoint_returns_grid_and_summary(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200

    payload = resp.get_json()
    assert payload["weeks"] == 12
    assert len(payload["cells"]) == 84
    assert payload["day_labels"] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    summary = payload["summary"]
    assert summary["current_streak"] >= 0
    assert summary["longest_streak"] >= summary["current_streak"]
    assert summary["total_completions"] >= 0

    first_cell = payload["cells"][0]
    assert set(first_cell.keys()) == {
        "date",
        "week_index",
        "day_index",
        "count",
        "intensity_level",
    }
    assert first_cell["week_index"] == 0
    assert 0 <= first_cell["day_index"] <= 6
    assert 0 <= first_cell["intensity_level"] <= 5


def test_heatmap_endpoint_respects_date_range(client):
    resp = client.get("/api/analytics/heatmap?start_date=2026-01-01&end_date=2026-01-31")
    assert resp.status_code == 200

    payload = resp.get_json()
    assert payload["range_start"] <= payload["range_end"]
    assert len(payload["cells"]) % 7 == 0
    assert payload["weeks"] == len(payload["cells"]) // 7
