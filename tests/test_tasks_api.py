"""API tests for task operations."""

import os
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest


@pytest.fixture
def api_client(tmp_path):
    os.environ["TESTING"] = "1"
    import server

    db_path = Path(tmp_path) / "taskflow-test.db"
    server.DB_PATH = str(db_path)
    server.init_db()
    return server.app.test_client()


def test_get_tasks_returns_list(api_client):
    response = api_client.get("/api/tasks")

    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)


def test_get_tasks_filters_by_status(api_client):
    response = api_client.get("/api/tasks?status=todo")

    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)


def test_heatmap_endpoint_returns_dense_84_day_series(api_client):
    response = api_client.get("/api/analytics/heatmap")

    assert response.status_code == 200
    payload = response.get_json()

    assert payload["start_date"]
    assert payload["end_date"]
    assert isinstance(payload["days"], list)
    assert len(payload["days"]) == 84
    assert payload["days"][0]["date"] == payload["start_date"]
    assert payload["days"][-1]["date"] == payload["end_date"]
    assert {"current_streak", "longest_streak", "total_completions"} <= set(payload["summary"].keys())


def test_heatmap_endpoint_aggregates_counts_and_streaks(api_client):
    import server

    now = datetime.now(timezone.utc)
    today = now.date()
    fmt = "%Y-%m-%d %H:%M:%S"

    done_rows = [
        ("Today done #1", "done", "Engineering", "high", now.strftime(fmt), now.strftime(fmt)),
        ("Today done #2", "done", "Engineering", "medium", now.strftime(fmt), now.strftime(fmt)),
        (
            "Yesterday done",
            "done",
            "Engineering",
            "low",
            (now - timedelta(days=1)).strftime(fmt),
            (now - timedelta(days=1)).strftime(fmt),
        ),
        (
            "Three days ago done",
            "done",
            "Planning",
            "medium",
            (now - timedelta(days=3)).strftime(fmt),
            (now - timedelta(days=3)).strftime(fmt),
        ),
        (
            "Four days ago done",
            "done",
            "Planning",
            "medium",
            (now - timedelta(days=4)).strftime(fmt),
            (now - timedelta(days=4)).strftime(fmt),
        ),
        (
            "Five days ago done",
            "done",
            "Planning",
            "medium",
            (now - timedelta(days=5)).strftime(fmt),
            (now - timedelta(days=5)).strftime(fmt),
        ),
    ]

    conn = server.get_db()
    for row in done_rows:
        conn.execute(
            "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
            row,
        )
    conn.commit()
    conn.close()

    response = api_client.get("/api/analytics/heatmap")
    assert response.status_code == 200
    payload = response.get_json()

    by_date = {entry["date"]: entry["count"] for entry in payload["days"]}
    assert by_date[today.isoformat()] == 2
    assert by_date[(today - timedelta(days=1)).isoformat()] == 1
    assert by_date[(today - timedelta(days=2)).isoformat()] == 0
    assert by_date[(today - timedelta(days=3)).isoformat()] == 1
    assert by_date[(today - timedelta(days=4)).isoformat()] == 1
    assert by_date[(today - timedelta(days=5)).isoformat()] == 1

    summary = payload["summary"]
    assert summary["current_streak"] == 2
    assert summary["longest_streak"] == 3
    assert summary["total_completions"] == len(done_rows)
