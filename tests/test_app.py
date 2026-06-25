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
    data = resp.get_json()

    assert data["weeks"] == 12
    assert data["day_labels"] == ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    assert len(data["cells"]) == 84

    summary = data["summary"]
    assert "current_streak" in summary
    assert "longest_streak" in summary
    assert "total_completions" in summary
    assert summary["current_streak"] >= 0
    assert summary["longest_streak"] >= 0
    assert summary["total_completions"] >= 0


def test_heatmap_endpoint_respects_date_range(client):
    resp = client.get("/api/analytics/heatmap?start_date=2026-01-03&end_date=2026-01-09")
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["range_start"] == "2025-12-29"
    assert data["range_end"] == "2026-01-11"
    assert len(data["cells"]) % 7 == 0
    assert data["weeks"] == len(data["cells"]) // 7
