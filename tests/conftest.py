import pytest
import os
import sys
import tempfile
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import server


@pytest.fixture
def app():
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    server.DB_PATH = db_path
    server.app.config["TESTING"] = True
    server.init_db()
    yield server.app
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def bare_db(app):
    """Empty tasks table without demo seed data."""
    conn = server.get_db()
    conn.execute("DELETE FROM tasks")
    conn.commit()
    conn.close()
    return app


@pytest.fixture
def bare_client(bare_db):
    return bare_db.test_client()


def insert_task(conn, *, title, status, category, created_at, completed_at=None, priority="medium"):
    conn.execute(
        """
        INSERT INTO tasks (title, status, category, priority, created_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (title, status, category, priority, created_at, completed_at),
    )


@pytest.fixture
def recap_today():
    return date(2026, 6, 30)


@pytest.fixture
def seeded_recap_db(bare_db, recap_today):
    """Deterministic task set for weekly recap aggregation tests."""
    conn = server.get_db()
    insert_task(
        conn,
        title="Design task A",
        status="done",
        category="Design",
        created_at="2026-06-24 00:00:00",
        completed_at="2026-06-24 00:00:00",
    )
    insert_task(
        conn,
        title="Engineering task B",
        status="done",
        category="Engineering",
        created_at="2026-06-24 00:00:00",
        completed_at="2026-06-26 00:00:00",
    )
    insert_task(
        conn,
        title="Design task C",
        status="done",
        category="Design",
        created_at="2026-06-25 00:00:00",
        completed_at="2026-06-25 00:00:00",
    )
    insert_task(
        conn,
        title="Planning todo",
        status="todo",
        category="Planning",
        created_at="2026-06-30 00:00:00",
    )
    insert_task(
        conn,
        title="Design task D",
        status="done",
        category="Design",
        created_at="2026-06-27 00:00:00",
        completed_at="2026-06-27 00:00:00",
    )
    conn.commit()
    conn.close()
    return bare_db
