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


def test_get_heatmap_returns_expected_shape(api_client):
    response = api_client.get("/api/analytics/heatmap")

    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, dict)
    assert "start_date" in payload
    assert "end_date" in payload
    assert "daily_counts" in payload
    assert "summary" in payload
    assert isinstance(payload["daily_counts"], list)
    assert isinstance(payload["summary"], dict)


def test_get_heatmap_aggregates_completed_tasks_by_day(api_client):
    import server

    now = datetime.now(timezone.utc)
    today_key = now.strftime("%Y-%m-%d")
    yesterday_key = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    old_key = (now - timedelta(days=120)).strftime("%Y-%m-%d")

    conn = server.get_db()
    conn.execute(
        "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("Done today one", "done", "Engineering", "medium", f"{today_key} 09:00:00", f"{today_key} 09:30:00"),
    )
    conn.execute(
        "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("Done today two", "done", "Engineering", "high", f"{today_key} 12:00:00", f"{today_key} 12:20:00"),
    )
    conn.execute(
        "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("Done yesterday", "done", "Planning", "low", f"{yesterday_key} 13:00:00", f"{yesterday_key} 14:00:00"),
    )
    conn.execute(
        "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("Done too old", "done", "Planning", "low", f"{old_key} 11:00:00", f"{old_key} 11:15:00"),
    )
    conn.execute(
        "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("Not done", "todo", "Design", "medium", f"{today_key} 10:00:00", None),
    )
    conn.commit()
    conn.close()

    response = api_client.get("/api/analytics/heatmap")

    assert response.status_code == 200
    payload = response.get_json()
    counts = {entry["date"]: entry["count"] for entry in payload["daily_counts"]}

    assert counts[today_key] == 2
    assert counts[yesterday_key] == 1
    assert old_key not in counts
    assert payload["summary"]["total_completions"] == 3
