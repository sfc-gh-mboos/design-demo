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


def test_get_heatmap_returns_dense_daily_counts_and_summary(api_client):
    import server

    today = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    conn = server.get_db()

    completions = [
        today,
        today - timedelta(days=1),
        today - timedelta(days=1),
        today - timedelta(days=3),
    ]

    for index, completed in enumerate(completions):
        conn.execute(
            """
            INSERT INTO tasks (title, status, category, priority, created_at, completed_at)
            VALUES (?, 'done', 'Engineering', 'medium', ?, ?)
            """,
            (
                f"Completed task {index}",
                (completed - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                completed.strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )

    conn.execute(
        """
        INSERT INTO tasks (title, status, category, priority, created_at, completed_at)
        VALUES ('Incomplete task', 'todo', 'Engineering', 'low', ?, ?)
        """,
        (
            today.strftime("%Y-%m-%d %H:%M:%S"),
            today.strftime("%Y-%m-%d %H:%M:%S"),
        ),
    )
    conn.commit()
    conn.close()

    response = api_client.get("/api/analytics/heatmap")
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["start_date"] <= payload["end_date"]
    assert len(payload["days"]) == 84
    assert payload["total_completions"] == 4
    assert payload["current_streak"] == 2
    assert payload["longest_streak"] == 2

    counts_by_date = {day["date"]: day["count"] for day in payload["days"]}
    assert counts_by_date[today.date().isoformat()] == 1
    assert counts_by_date[(today.date() - timedelta(days=1)).isoformat()] == 2
    assert counts_by_date[(today.date() - timedelta(days=3)).isoformat()] == 1


def test_get_heatmap_returns_empty_series_when_no_completions(api_client):
    response = api_client.get("/api/analytics/heatmap")
    assert response.status_code == 200

    payload = response.get_json()
    assert len(payload["days"]) == 84
    assert payload["total_completions"] == 0
    assert payload["current_streak"] == 0
    assert payload["longest_streak"] == 0
    assert all(day["count"] == 0 for day in payload["days"])
