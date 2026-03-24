import pytest
import os
import sys
import tempfile

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
