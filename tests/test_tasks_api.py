"""API tests for task operations and weekly planner endpoints."""

import os
import sqlite3
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


def test_init_db_migrates_planner_columns(api_client):
    import server

    conn = sqlite3.connect(server.DB_PATH)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()}
    conn.close()

    assert "planned_date" in columns
    assert "planned_order" in columns


def test_put_task_sets_and_clears_planner_fields(api_client):
    import server

    conn = sqlite3.connect(server.DB_PATH)
    cursor = conn.execute(
        """
        INSERT INTO tasks (title, status, category, priority, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        """,
        ("Plan sprint", "todo", "Planning", "high"),
    )
    task_id = cursor.lastrowid
    conn.commit()
    conn.close()

    set_response = api_client.put(
        f"/api/tasks/{task_id}",
        json={"planned_date": "2026-04-20", "planned_order": 2},
    )
    assert set_response.status_code == 200
    set_payload = set_response.get_json()
    assert set_payload["planned_date"] == "2026-04-20"
    assert set_payload["planned_order"] == 2

    clear_response = api_client.put(
        f"/api/tasks/{task_id}",
        json={"planned_date": None, "planned_order": None},
    )
    assert clear_response.status_code == 200
    clear_payload = clear_response.get_json()
    assert clear_payload["planned_date"] is None
    assert clear_payload["planned_order"] is None


def test_auto_plan_schedules_by_priority_with_capacity(api_client):
    import server

    conn = sqlite3.connect(server.DB_PATH)
    conn.executemany(
        """
        INSERT INTO tasks (title, status, category, priority, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            ("High A", "todo", "Planning", "high", "2026-04-01 10:00:00"),
            ("High B", "todo", "Planning", "high", "2026-04-01 10:01:00"),
            ("Medium A", "todo", "Planning", "medium", "2026-04-01 10:02:00"),
            ("Low A", "todo", "Planning", "low", "2026-04-01 10:03:00"),
        ],
    )
    conn.commit()
    conn.close()

    response = api_client.post(
        "/api/planner/auto-plan",
        json={"week_start": "2026-04-20", "capacity_per_day": 1},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["scheduled_count"] == 4
    assert payload["week_start"] == "2026-04-20"

    conn = sqlite3.connect(server.DB_PATH)
    rows = conn.execute(
        """
        SELECT title, planned_date, planned_order
        FROM tasks
        WHERE planned_date IS NOT NULL
        ORDER BY planned_date ASC, planned_order ASC
        """
    ).fetchall()
    conn.close()

    assert [row[0] for row in rows] == ["High A", "High B", "Medium A", "Low A"]
    assert [row[1] for row in rows] == ["2026-04-20", "2026-04-21", "2026-04-22", "2026-04-23"]
    assert all(row[2] == 0 for row in rows)


def test_reset_week_clears_only_selected_week_assignments(api_client):
    import server

    conn = sqlite3.connect(server.DB_PATH)
    conn.executemany(
        """
        INSERT INTO tasks (title, status, category, priority, created_at, planned_date, planned_order)
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
        """,
        [
            ("Week task", "todo", "Planning", "high", "2026-04-20", 0),
            ("Same week", "todo", "Planning", "medium", "2026-04-23", 1),
            ("Other week", "todo", "Planning", "low", "2026-04-28", 0),
        ],
    )
    conn.commit()
    conn.close()

    response = api_client.post("/api/planner/reset-week", json={"week_start": "2026-04-20"})
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["cleared_count"] == 2

    conn = sqlite3.connect(server.DB_PATH)
    rows = conn.execute(
        "SELECT title, planned_date, planned_order FROM tasks ORDER BY title ASC"
    ).fetchall()
    conn.close()

    by_title = {row[0]: (row[1], row[2]) for row in rows}
    assert by_title["Other week"] == ("2026-04-28", 0)
    assert by_title["Same week"] == (None, None)
    assert by_title["Week task"] == (None, None)
