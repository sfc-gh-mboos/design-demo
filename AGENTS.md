## Cursor Cloud specific instructions

**Taskflow** is a single-page Kanban task management app: Flask backend + vanilla JS/HTML/CSS frontend, SQLite database.

### Running the app

```
python3 server.py
```

Starts on port **8080**. The SQLite database (`taskflow.db`) is auto-created and seeded with ~60 demo tasks on first run. The frontend is served as static files — no build step required.

### Running tests

```
python3 -m pytest tests/ -v
```

Note: `tests/conftest.py` contains an `app` fixture that references `from data.demo_seed import generate_demo_data` which does not exist. The tests that work (`test_tasks_api.py`, `test_kanban_shell.py`) use their own independent fixtures and do not depend on `conftest.py`.

### Linting

No linter is configured in the repository.

### Key caveats

- The server must be stopped and restarted to pick up Python code changes (Flask debug mode auto-reloads, but only if started via `python3 server.py`).
- Set `TESTING=1` environment variable when running tests to prevent demo data seeding.
- The `taskflow.db` file is gitignored and ephemeral.
