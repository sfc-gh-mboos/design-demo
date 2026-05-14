def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_analytics_trends_includes_delivery_timeline(client):
    resp = client.get("/api/analytics/trends?cohort=all")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "weekly_progress" in data
    assert "daily_volume" in data
    assert "delivery_timeline" in data
    dt = data["delivery_timeline"]
    assert set(dt.keys()) >= {
        "history",
        "forecast",
        "estimated_delivery_date",
        "forecast_truncated",
        "velocity_basis",
    }
    vb = dt["velocity_basis"]
    assert vb["window_days"] == 7
    assert isinstance(vb["avg_completed_per_day"], (int, float))


def test_delivery_timeline_history_row_shape(client):
    resp = client.get("/api/analytics/trends")
    assert resp.status_code == 200
    hist = resp.get_json()["delivery_timeline"]["history"]
    assert isinstance(hist, list)
    assert len(hist) > 0
    row = hist[0]
    assert set(row.keys()) >= {"date", "completed", "backlog_remaining"}


def test_delivery_timeline_forecast_row_shape(client):
    resp = client.get("/api/analytics/trends?max_forecast_days=5")
    assert resp.status_code == 200
    fc = resp.get_json()["delivery_timeline"]["forecast"]
    assert isinstance(fc, list)
    assert len(fc) <= 5
    if fc:
        row = fc[0]
        assert set(row.keys()) >= {"date", "projected_completed", "projected_backlog_remaining"}


def test_delivery_timeline_empty_when_range_has_no_demo_days(client):
    resp = client.get(
        "/api/analytics/trends?cohort=all&start_date=2099-01-01&end_date=2099-01-05"
    )
    assert resp.status_code == 200
    dt = resp.get_json()["delivery_timeline"]
    assert dt["history"] == []
    assert dt["forecast"] == []
    assert dt["estimated_delivery_date"] is None
    assert dt["forecast_truncated"] is False


def test_velocity_window_and_max_forecast_query_params(client):
    resp = client.get("/api/analytics/trends?velocity_window_days=14&max_forecast_days=30")
    assert resp.status_code == 200
    dt = resp.get_json()["delivery_timeline"]
    assert dt["velocity_basis"]["window_days"] == 14
    assert len(dt["forecast"]) <= 30


def test_invalid_forecast_query_params_fallback_and_clamp(client):
    resp = client.get("/api/analytics/trends?velocity_window_days=bad&max_forecast_days=also_bad")
    assert resp.status_code == 200
    dt = resp.get_json()["delivery_timeline"]
    assert dt["velocity_basis"]["window_days"] == 7
    assert len(dt["forecast"]) <= 120

    resp2 = client.get("/api/analytics/trends?max_forecast_days=9999")
    assert resp2.status_code == 200
    assert len(resp2.get_json()["delivery_timeline"]["forecast"]) <= 365


def test_forecast_truncation_respects_max_forecast_days(client):
    resp = client.get("/api/analytics/trends?max_forecast_days=1")
    assert resp.status_code == 200
    dt = resp.get_json()["delivery_timeline"]
    assert len(dt["forecast"]) <= 1
    if dt["forecast_truncated"]:
        assert dt["estimated_delivery_date"] is None
        assert dt["forecast"][-1]["projected_backlog_remaining"] >= 0
