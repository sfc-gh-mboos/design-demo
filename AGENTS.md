# Agents

## Cursor Cloud specific instructions

**Taskflow** is a single-service Flask + SQLite task management app. The entire application (API + frontend) runs from one process.

### Running the app

```
python3 server.py
```

Starts the dev server on port **8080** with debug mode enabled. The SQLite database (`taskflow.db`) is created automatically on first run with ~60 demo tasks.

### Running tests

```
python3 -m pytest tests/ -v
```

Tests use their own temporary databases and set `TESTING=1` to skip demo data seeding. The `conftest.py` `app` fixture imports from `data.demo_seed` which does not exist; however, the actual test files (`test_tasks_api.py`, `test_kanban_shell.py`) define their own fixtures and work correctly.

### Linting

No linter is configured in the project. You can run `python3 -m py_compile server.py` to check for syntax errors.

### Key gotchas

- Use `python3` (not `python`) — the environment does not alias `python` to `python3`.
- The `taskflow.db` file is git-ignored. Delete it to reset demo data.
- The server serves static frontend files (HTML/CSS/JS) from the repo root directory, so `server.py` must be run from `/workspace`.
