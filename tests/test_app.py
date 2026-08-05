from datetime import datetime, timezone


def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_analytics_heatmap_returns_expected_shape(client):
    resp = client.get("/api/analytics/heatmap")
    assert resp.status_code == 200
    data = resp.get_json()
    assert set(data.keys()) == {
        "summary",
        "range",
        "month_labels",
        "weeks",
        "legend_levels",
        "day_labels",
    }
    assert set(data["summary"].keys()) == {
        "current_streak_days",
        "longest_streak_days",
        "total_completions",
    }
    assert data["legend_levels"] == [0, 1, 2, 3, 4, 5]
    assert data["day_labels"] == ["Mon", "Wed", "Fri", "Sun"]


def test_analytics_heatmap_grid_spans_twelve_weeks(client):
    data = client.get("/api/analytics/heatmap").get_json()
    assert len(data["weeks"]) == 12
    for week in data["weeks"]:
        assert len(week["days"]) == 7
        for day in week["days"]:
            assert set(day.keys()) == {"date", "count", "level"}
            assert 0 <= day["level"] <= 5
    assert data["weeks"][0]["days"][0]["date"] == data["range"]["start"]
    assert data["weeks"][-1]["days"][-1]["date"] == data["range"]["end"]


def test_analytics_heatmap_month_labels_reference_valid_columns(client):
    data = client.get("/api/analytics/heatmap").get_json()
    assert data["month_labels"]
    columns = [label["column"] for label in data["month_labels"]]
    assert columns == sorted(columns)
    assert all(0 <= column < len(data["weeks"]) for column in columns)


def _day_cell(data, iso_date):
    for week in data["weeks"]:
        for day in week["days"]:
            if day["date"] == iso_date:
                return day
    raise AssertionError(f"{iso_date} is not in the heatmap range")


def test_analytics_heatmap_counts_completed_tasks(client):
    today = datetime.now(timezone.utc).date().isoformat()
    before = client.get("/api/analytics/heatmap").get_json()

    created = client.post("/api/tasks", json={"title": "Heatmap fixture task"}).get_json()
    client.put(f"/api/tasks/{created['id']}", json={"status": "done"})

    after = client.get("/api/analytics/heatmap").get_json()
    assert after["summary"]["total_completions"] == before["summary"]["total_completions"] + 1
    assert after["summary"]["current_streak_days"] >= 1
    assert _day_cell(after, today)["count"] == _day_cell(before, today)["count"] + 1
    assert _day_cell(after, today)["level"] >= 1
