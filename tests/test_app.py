def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_build_delivery_timeline_forecasts_with_positive_velocity():
    import server

    daily_volume = [
        {"date": "2026-01-01", "todo": 8, "in_progress": 2, "done": 2},
        {"date": "2026-01-02", "todo": 7, "in_progress": 1, "done": 3},
        {"date": "2026-01-03", "todo": 6, "in_progress": 1, "done": 4},
    ]
    timeline = server._build_delivery_timeline(daily_volume, velocity_window_days=2, max_forecast_days=10)

    assert len(timeline["history"]) == 3
    assert timeline["velocity_basis"]["window_days"] == 2
    assert timeline["forecast"]
    assert timeline["estimated_delivery_date"] is not None
    assert timeline["forecast_truncated"] is False


def test_build_delivery_timeline_not_forecastable_when_velocity_zero():
    import server

    daily_volume = [
        {"date": "2026-01-01", "todo": 5, "in_progress": 2, "done": 0},
        {"date": "2026-01-02", "todo": 4, "in_progress": 3, "done": 0},
    ]
    timeline = server._build_delivery_timeline(daily_volume, velocity_window_days=7, max_forecast_days=20)

    assert timeline["forecast"] == []
    assert timeline["estimated_delivery_date"] is None
    assert timeline["forecast_truncated"] is False


def test_build_delivery_timeline_already_clear_uses_last_history_day():
    import server

    daily_volume = [
        {"date": "2026-01-01", "todo": 2, "in_progress": 1, "done": 4},
        {"date": "2026-01-02", "todo": 0, "in_progress": 0, "done": 3},
    ]
    timeline = server._build_delivery_timeline(daily_volume)

    assert timeline["forecast"] == []
    assert timeline["estimated_delivery_date"] == "2026-01-02"
    assert timeline["forecast_truncated"] is False


def test_trends_endpoint_includes_delivery_timeline_contract(client):
    resp = client.get("/api/analytics/trends?cohort=all")
    assert resp.status_code == 200

    data = resp.get_json()
    assert "delivery_timeline" in data
    timeline = data["delivery_timeline"]

    assert set(timeline.keys()) == {
        "history",
        "forecast",
        "estimated_delivery_date",
        "forecast_truncated",
        "velocity_basis",
    }
    assert timeline["velocity_basis"]["window_days"] == 7
    assert isinstance(timeline["velocity_basis"]["avg_completed_per_day"], (int, float))

    history_dates = [row["date"] for row in timeline["history"]]
    assert history_dates == sorted(history_dates)

    for row in timeline["history"]:
        assert set(row.keys()) == {"date", "completed", "backlog_remaining"}
        assert row["completed"] >= 0
        assert row["backlog_remaining"] >= 0

    for row in timeline["forecast"]:
        assert set(row.keys()) == {"date", "projected_completed", "projected_backlog_remaining"}
        assert row["projected_completed"] >= 0
        assert row["projected_backlog_remaining"] >= 0
