from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
from datetime import datetime, timedelta, timezone

app = Flask(__name__, static_folder=".", static_url_path="")
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "taskflow.db")
VALID_STATUSES = {"todo", "in-progress", "done"}
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrate_add_columns(conn):
    """Add task columns required by evolving UI features."""
    cursor = conn.execute("PRAGMA table_info(tasks)")
    cols = [row[1] for row in cursor.fetchall()]
    if "created_at" not in cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP")
    if "completed_at" not in cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN completed_at TEXT")
    if "planned_date" not in cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN planned_date TEXT")
    if "planned_order" not in cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN planned_order INTEGER")
    # Backfill existing rows
    conn.execute(
        "UPDATE tasks SET created_at = datetime('now') WHERE created_at IS NULL OR created_at = ''"
    )
    conn.execute(
        "UPDATE tasks SET completed_at = datetime('now') WHERE status = 'done' AND (completed_at IS NULL OR completed_at = '')"
    )


def init_db():
    conn = get_db()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'todo',
            category TEXT NOT NULL DEFAULT 'Planning',
            priority TEXT NOT NULL DEFAULT 'medium',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT
        )"""
    )
    migrate_add_columns(conn)
    count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    if count == 0 and not os.environ.get("TESTING"):
        generate_demo_data(conn)
    conn.commit()
    conn.close()


def row_to_dict(row):
    return {key: row[key] for key in row.keys()}


def normalize_title(title):
    if not title or not str(title).strip():
        return None
    return str(title).strip()


def normalize_priority(priority):
    valid = {"high", "medium", "low"}
    if priority and str(priority).strip().lower() in valid:
        return str(priority).strip().lower()
    return None


def normalize_planned_date(planned_date):
    if planned_date is None:
        return None
    value = str(planned_date).strip()
    if value == "":
        return None
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return "__invalid__"
    return value


def normalize_planned_order(planned_order):
    if planned_order is None or planned_order == "":
        return None
    try:
        value = int(planned_order)
    except (TypeError, ValueError):
        return "__invalid__"
    if value < 0:
        return "__invalid__"
    return value


def normalize_week_start(raw_week_start):
    if raw_week_start is None or str(raw_week_start).strip() == "":
        today = datetime.now(timezone.utc).date()
        return today - timedelta(days=today.weekday())
    try:
        parsed = datetime.strptime(str(raw_week_start), "%Y-%m-%d").date()
    except ValueError:
        return None
    return parsed - timedelta(days=parsed.weekday())


def week_bounds(week_start):
    week_end = week_start + timedelta(days=6)
    return week_start.strftime("%Y-%m-%d"), week_end.strftime("%Y-%m-%d")


def generate_demo_data(conn):
    """Create ~60 tasks spanning the past 8 weeks with realistic patterns."""
    import random
    categories = ["Planning", "Design", "Engineering", "Operations"]
    priorities = ["high", "medium", "low"]
    titles = [
        "Define Q1 product roadmap", "Update component library tokens", "Deploy auth service hotfix",
        "Review onboarding flow mocks", "Migrate user table to new schema", "Schedule team retrospective",
        "Write integration tests for payments API", "Draft hiring plan for frontend team",
        "Refactor API error handling", "Design checkout flow", "Set up CI pipeline",
        "Document API endpoints", "Create design system tokens", "Fix login redirect bug",
        "Plan sprint 42", "User research synthesis", "Optimize DB queries",
        "Incident postmortem", "Budget review Q2", "Accessibility audit",
        "Implement rate limiting", "Vendor evaluation", "Update README",
        "Security scan", "Capacity planning", "A/B test analysis",
    ]
    base = datetime.now(timezone.utc)
    cursor = conn.cursor()
    task_id = 1
    # More tasks in recent weeks; improving completion trend
    for week_offset in range(7, -1, -1):
        week_start = base - timedelta(weeks=week_offset)
        n_tasks = random.randint(6, 10) if week_offset > 0 else random.randint(8, 12)
        completion_pct = min(0.95, 0.5 + 0.05 * (7 - week_offset))
        for _ in range(n_tasks):
            day_offset = random.randint(0, 6)
            created = week_start + timedelta(days=day_offset)
            status = "done" if random.random() < completion_pct else (
                "in-progress" if random.random() < 0.5 else "todo"
            )
            completed_at = None
            if status == "done":
                days_to_complete = random.randint(1, 5)
                completed = created + timedelta(days=days_to_complete)
                completed_at = completed.strftime("%Y-%m-%d %H:%M:%S")
            created_at = created.strftime("%Y-%m-%d %H:%M:%S")
            title = random.choice(titles)
            category = random.choice(categories)
            priority = random.choice(priorities)
            cursor.execute(
                "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
                (title, status, category, priority, created_at, completed_at),
            )
            task_id += 1
    # Ensure streak: add completions for last 5 days including today
    today = base.replace(hour=12, minute=0, second=0, microsecond=0)
    for day_offset in range(4, -1, -1):
        d = today - timedelta(days=day_offset)
        cursor.execute(
            "INSERT INTO tasks (title, status, category, priority, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
            (
                "Daily completion",
                "done",
                "Operations",
                "medium",
                d.strftime("%Y-%m-%d %H:%M:%S"),
                (d + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )


# --- Static files ---

@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/planner")
def planner():
    return send_from_directory(".", "planner.html")


# --- API ---

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    conn = get_db()
    status = request.args.get("status")
    if status and status != "all":
        rows = conn.execute(
            "SELECT * FROM tasks WHERE status = ?", (status,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM tasks").fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    conn = get_db()
    existing = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "task not found"}), 404
    if "title" in data:
        new_title = normalize_title(data.get("title"))
        if not new_title:
            conn.close()
            return jsonify({"error": "title is required"}), 400
    else:
        new_title = existing["title"]
    if "priority" in data:
        new_priority = normalize_priority(data.get("priority"))
        if not new_priority:
            conn.close()
            return jsonify({"error": "priority must be one of: high, medium, low"}), 400
    else:
        new_priority = existing["priority"]
    new_status = data.get("status", existing["status"])
    if new_status not in VALID_STATUSES:
        conn.close()
        return jsonify({"error": "status must be one of: todo, in-progress, done"}), 400
    if "planned_date" in data:
        new_planned_date = normalize_planned_date(data.get("planned_date"))
        if new_planned_date == "__invalid__":
            conn.close()
            return jsonify({"error": "planned_date must be YYYY-MM-DD or null"}), 400
    else:
        new_planned_date = existing["planned_date"]
    if "planned_order" in data:
        new_planned_order = normalize_planned_order(data.get("planned_order"))
        if new_planned_order == "__invalid__":
            conn.close()
            return jsonify({"error": "planned_order must be a non-negative integer or null"}), 400
    else:
        new_planned_order = existing["planned_order"]
    if new_planned_date is None:
        new_planned_order = None
    completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if new_status == "done" else None
    conn.execute(
        "UPDATE tasks SET title=?, status=?, category=?, priority=?, completed_at=?, planned_date=?, planned_order=? WHERE id=?",
        (
            new_title,
            new_status,
            data.get("category", existing["category"]),
            new_priority,
            completed_at,
            new_planned_date,
            new_planned_order,
            task_id,
        ),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row))


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "task not found"}), 404
    conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return "", 204


@app.route("/api/planner/auto-plan", methods=["POST"])
def planner_auto_plan():
    data = request.get_json(silent=True) or {}
    week_start = normalize_week_start(data.get("week_start"))
    if week_start is None:
        return jsonify({"error": "week_start must be YYYY-MM-DD"}), 400
    capacity_per_day_raw = data.get("capacity_per_day", 4)
    try:
        capacity_per_day = int(capacity_per_day_raw)
    except (TypeError, ValueError):
        return jsonify({"error": "capacity_per_day must be a positive integer"}), 400
    if capacity_per_day <= 0:
        return jsonify({"error": "capacity_per_day must be a positive integer"}), 400

    start_str, end_str = week_bounds(week_start)
    week_days = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    conn = get_db()

    day_counts = {day: 0 for day in week_days}
    for row in conn.execute(
        """
        SELECT planned_date, COUNT(*) AS task_count
        FROM tasks
        WHERE planned_date BETWEEN ? AND ?
        GROUP BY planned_date
        """,
        (start_str, end_str),
    ).fetchall():
        day_counts[row["planned_date"]] = row["task_count"]

    max_orders = {day: -1 for day in week_days}
    for row in conn.execute(
        """
        SELECT planned_date, COALESCE(MAX(planned_order), -1) AS max_order
        FROM tasks
        WHERE planned_date BETWEEN ? AND ?
        GROUP BY planned_date
        """,
        (start_str, end_str),
    ).fetchall():
        max_orders[row["planned_date"]] = row["max_order"]

    unscheduled = conn.execute(
        """
        SELECT id, priority, created_at
        FROM tasks
        WHERE (planned_date IS NULL OR planned_date = '')
          AND status != 'done'
        ORDER BY
            CASE priority
                WHEN 'high' THEN 0
                WHEN 'medium' THEN 1
                ELSE 2
            END,
            datetime(created_at) ASC,
            id ASC
        """
    ).fetchall()

    scheduled_task_ids = []
    for task in unscheduled:
        target_day = next((day for day in week_days if day_counts[day] < capacity_per_day), None)
        if target_day is None:
            break
        max_orders[target_day] += 1
        conn.execute(
            "UPDATE tasks SET planned_date = ?, planned_order = ? WHERE id = ?",
            (target_day, max_orders[target_day], task["id"]),
        )
        day_counts[target_day] += 1
        scheduled_task_ids.append(task["id"])

    conn.commit()
    conn.close()
    return jsonify(
        {
            "week_start": start_str,
            "capacity_per_day": capacity_per_day,
            "scheduled_task_ids": scheduled_task_ids,
            "scheduled_count": len(scheduled_task_ids),
        }
    )


@app.route("/api/planner/reset-week", methods=["POST"])
def planner_reset_week():
    data = request.get_json(silent=True) or {}
    week_start = normalize_week_start(data.get("week_start"))
    if week_start is None:
        return jsonify({"error": "week_start must be YYYY-MM-DD"}), 400
    start_str, end_str = week_bounds(week_start)

    conn = get_db()
    cursor = conn.execute(
        """
        UPDATE tasks
        SET planned_date = NULL, planned_order = NULL
        WHERE planned_date BETWEEN ? AND ?
        """,
        (start_str, end_str),
    )
    conn.commit()
    cleared_count = cursor.rowcount
    conn.close()
    return jsonify({"week_start": start_str, "cleared_count": cleared_count})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=8080)
