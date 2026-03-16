"""API tests for task operations."""

from datetime import datetime, timedelta, timezone
import os
from pathlib import Path

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


def test_heatmap_returns_12_week_window(api_client):
    response = api_client.get("/api/analytics/heatmap")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["start_date"]
    assert payload["end_date"]
    assert payload["today"]
    assert isinstance(payload["daily_counts"], list)
    assert len(payload["daily_counts"]) == 84
    assert payload["summary"] == {
        "current_streak": 0,
        "longest_streak": 0,
        "total_completions": 0,
    }


def test_heatmap_groups_daily_completions_and_streaks(api_client):
    import server

    _, _, today = server.get_heatmap_window()
    yesterday = today - timedelta(days=1)
    three_days_ago = today - timedelta(days=3)

    conn = server.get_db()
    rows = [
        ("Task A", "done", "Engineering", "medium", today, today),
        ("Task B", "done", "Engineering", "medium", today, today),
        ("Task C", "done", "Engineering", "medium", yesterday, yesterday),
        ("Task D", "done", "Engineering", "medium", three_days_ago, three_days_ago),
        ("Task E", "todo", "Planning", "low", today, None),
    ]
    for title, status, category, priority, created_date, completed_date in rows:
        created_at = f"{created_date.isoformat()} 09:00:00"
        completed_at = (
            f"{completed_date.isoformat()} 12:00:00" if completed_date is not None else None
        )
        conn.execute(
            """
            INSERT INTO tasks (title, status, category, priority, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (title, status, category, priority, created_at, completed_at),
        )
    conn.commit()
    conn.close()

    response = api_client.get("/api/analytics/heatmap")

    assert response.status_code == 200
    payload = response.get_json()
    counts = {entry["date"]: entry["count"] for entry in payload["daily_counts"]}
    assert counts[today.isoformat()] == 2
    assert counts[yesterday.isoformat()] == 1
    assert counts[three_days_ago.isoformat()] == 1
    assert payload["summary"]["total_completions"] == 4
    assert payload["summary"]["current_streak"] == 2
    assert payload["summary"]["longest_streak"] == 2
