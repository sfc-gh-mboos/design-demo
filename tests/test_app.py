from datetime import date, datetime, timedelta

import server


def test_index_returns_200(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_analytics_page_returns_200(client):
    resp = client.get("/analytics")
    assert resp.status_code == 200


def test_heatmap_page_returns_200(client):
    resp = client.get("/heatmap")
    assert resp.status_code == 200


def test_heatmap_api_returns_full_grid(client):
    payload = client.get("/api/analytics/heatmap").get_json()

    assert len(payload["weeks"]) == server.HEATMAP_WEEKS
    assert all(len(week["days"]) == 7 for week in payload["weeks"])


def test_heatmap_api_grid_covers_reported_range(client):
    payload = client.get("/api/analytics/heatmap").get_json()

    start = date.fromisoformat(payload["range"]["start"])
    end = date.fromisoformat(payload["range"]["end"])
    days = [day for week in payload["weeks"] for day in week["days"]]
    dates = [date.fromisoformat(day["date"]) for day in days]

    assert start.weekday() == 0
    assert end.weekday() == 6
    assert dates == sorted(dates)
    assert dates[0] == start
    assert dates[-1] == end
    assert (end - start).days + 1 == len(dates)


def test_heatmap_api_levels_and_counts_are_bounded(client):
    payload = client.get("/api/analytics/heatmap").get_json()

    days = [day for week in payload["weeks"] for day in week["days"]]
    assert all(0 <= day["level"] <= 5 for day in days)
    assert all(day["count"] >= 0 for day in days)
    assert all(day["count"] == 0 or day["level"] > 0 for day in days)
    assert payload["legend_levels"] == [0, 1, 2, 3, 4, 5]
    assert payload["day_labels"] == ["Mon", "Wed", "Fri", "Sun"]


def test_heatmap_api_month_labels_reference_valid_columns(client):
    payload = client.get("/api/analytics/heatmap").get_json()

    labels = payload["month_labels"]
    columns = [label["column"] for label in labels]

    assert labels
    assert columns == sorted(columns)
    assert all(0 <= column < server.HEATMAP_WEEKS for column in columns)
    assert all(label["month"] for label in labels)


def test_heatmap_api_summary_is_integral(client):
    summary = client.get("/api/analytics/heatmap").get_json()["summary"]

    for field in ("current_streak_days", "longest_streak_days", "total_completions"):
        assert isinstance(summary[field], int)
        assert summary[field] >= 0
    assert summary["longest_streak_days"] >= summary["current_streak_days"]


def test_heatmap_api_counts_completions_per_day(client):
    conn = server.get_db()
    conn.execute("DELETE FROM tasks")
    completed_on = datetime.now(server.timezone.utc).date() - timedelta(days=1)
    for _ in range(3):
        conn.execute(
            "INSERT INTO tasks (title, status, category, priority, created_at, completed_at)"
            " VALUES (?, 'done', 'Planning', 'medium', ?, ?)",
            ("Ship it", f"{completed_on} 09:00:00", f"{completed_on} 17:00:00"),
        )
    conn.commit()
    conn.close()

    payload = client.get("/api/analytics/heatmap").get_json()
    days = {day["date"]: day for week in payload["weeks"] for day in week["days"]}

    assert days[completed_on.isoformat()]["count"] == 3
    assert days[completed_on.isoformat()]["level"] == 5
    assert payload["summary"]["total_completions"] == 3
    assert payload["summary"]["longest_streak_days"] == 1


def test_heatmap_api_handles_empty_database(client):
    conn = server.get_db()
    conn.execute("DELETE FROM tasks")
    conn.commit()
    conn.close()

    payload = client.get("/api/analytics/heatmap").get_json()
    days = [day for week in payload["weeks"] for day in week["days"]]

    assert len(days) == server.HEATMAP_WEEKS * 7
    assert all(day["count"] == 0 and day["level"] == 0 for day in days)
    assert payload["summary"] == {
        "current_streak_days": 0,
        "longest_streak_days": 0,
        "total_completions": 0,
    }
