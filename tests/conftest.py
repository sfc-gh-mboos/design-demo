"""Pytest fixtures for design-demo tests."""
import os
import sys
import tempfile
from pathlib import Path

import pytest

# Ensure tests can import top-level modules (e.g. `server.py`) in
# environments that don't automatically add the project root to sys.path.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


@pytest.fixture(scope="session")
def test_db_path():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    try:
        os.unlink(path)
    except OSError:
        pass


@pytest.fixture
def app(test_db_path):
    """Flask app with test DB seeded with deterministic demo data."""
    os.environ["TESTING"] = "1"
    import server

    server.DB_PATH = test_db_path

    server.init_db()
    conn = server.get_db()
    server.generate_demo_data(conn)
    conn.commit()
    conn.close()

    return server.app


@pytest.fixture
def client(app):
    return app.test_client()
