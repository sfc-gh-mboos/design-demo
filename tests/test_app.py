def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_analytics_heatmap_uses_task_completions(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "summary" in data
    s = data["summary"]
    assert "current_streak_days" in s
    assert "longest_streak_days" in s
    assert "total_completions" in s
    assert s["total_completions"] >= 0
    assert "range" in data
    assert "start" in data["range"] and "end" in data["range"]
    assert "month_labels" in data
    assert "weeks" in data
    assert len(data["weeks"]) == 12
    assert len(data["weeks"][0]["days"]) == 7
    assert "max_daily_count" in data
    assert data["day_labels"] == [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun",
    ]
