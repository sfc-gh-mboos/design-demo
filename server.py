from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
import random
from datetime import datetime, timedelta, timezone

app = Flask(__name__, static_folder=".", static_url_path="")
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "taskflow.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrate_add_columns(conn):
    """Add created_at and completed_at if they don't exist."""
    cursor = conn.execute("PRAGMA table_info(tasks)")
    cols = [row[1] for row in cursor.fetchall()]
    if "created_at" not in cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP")
    if "completed_at" not in cols:
        conn.execute("ALTER TABLE tasks ADD COLUMN completed_at TEXT")
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
    completed_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S") if new_status == "done" else None
    conn.execute(
        "UPDATE tasks SET title=?, status=?, category=?, priority=?, completed_at=? WHERE id=?",
        (
            new_title,
            new_status,
            data.get("category", existing["category"]),
            new_priority,
            completed_at,
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


# --- Analytics API ---


def _parse_date(s):
    """Parse YYYY-MM-DD string to date, return None if invalid."""
    if not s or not isinstance(s, str):
        return None
    try:
        return datetime.strptime(s.strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _generate_analytics_data(cohort, start_date=None, end_date=None):
    """
    Generate deterministic dummy analytics data for a given cohort.
    Uses hash-based seeding so each cohort gets consistent but distinct data.
    This function is the swap-point for future Databricks integration.
    Optional start_date and end_date (YYYY-MM-DD) filter the date range.
    """
    # Use hash of cohort string as seed for deterministic randomness
    cohort_hash = hash(cohort) % (2**31)
    random.seed(cohort_hash)

    categories = ["Planning", "Design", "Engineering", "Operations"]
    priorities = ["high", "medium", "low"]

    base = datetime.now(timezone.utc)
    base_dt = base.replace(hour=0, minute=0, second=0, microsecond=0)

    # Default range: 8 weeks back for weekly, 14 days for daily (matches original behavior)
    if start_date is None:
        start_dt = base_dt - timedelta(weeks=7)  # 8 weeks: 7,6,5,4,3,2,1,0 weeks ago
        start_dt_daily = base_dt - timedelta(days=13)  # 14 days
    else:
        start_dt = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        start_dt_daily = start_dt
    if end_date is None:
        end_dt = base_dt + timedelta(days=1)
        end_dt_daily = end_dt
    else:
        end_dt = datetime.combine(end_date, datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(days=1)
        end_dt_daily = end_dt

    # Base values vary by cohort
    base_completion = 0.65 + (cohort_hash % 30) / 100  # 65-95%
    base_tasks_week = 15 + (cohort_hash % 20)  # 15-35 tasks
    base_streak = 3 + (cohort_hash % 8)  # 3-10 days

    # Distribution by category (aggregate, not date-dependent)
    by_category = []
    total_category_tasks = base_tasks_week * 4
    category_weights = [0.25, 0.20, 0.35, 0.20]
    for i, cat in enumerate(categories):
        total = int(total_category_tasks * category_weights[i])
        completed = int(total * (base_completion + random.uniform(-0.1, 0.1)))
        by_category.append({
            "name": cat,
            "total": max(1, total),
            "completed": max(0, min(completed, total))
        })

    # Distribution by priority
    by_priority = []
    priority_weights = [0.30, 0.45, 0.25]
    for i, pri in enumerate(priorities):
        count = int(total_category_tasks * priority_weights[i])
        by_priority.append({
            "name": pri,
            "count": max(1, count)
        })

    # Weekly trends - only weeks within [start_dt, end_dt)
    weekly_progress = []
    priority_focus = []
    productivity_score = []

    week_offset = 0
    while week_offset <= 52:
        week_start = base_dt - timedelta(weeks=week_offset)
        week_end = week_start + timedelta(weeks=1)
        if week_end <= start_dt:
            break  # Past the start of range
        if week_start < end_dt:  # Week overlaps range
            week_label = week_start.strftime("%Y-%m-%d")
            trend_factor = 1.0 + (7 - min(week_offset, 7)) * 0.05
            created = int(base_tasks_week * trend_factor)
            completed = int(created * (base_completion + (7 - min(week_offset, 7)) * 0.02))
            weekly_progress.append({
                "week": week_label,
                "created": max(1, created),
                "completed": max(0, min(completed, created))
            })
            high_pct = 0.25 + (week_offset % 3) * 0.05
            medium_pct = 0.50 - (week_offset % 2) * 0.03
            low_pct = 1.0 - high_pct - medium_pct
            priority_focus.append({
                "week": week_label,
                "high": int(created * high_pct),
                "medium": int(created * medium_pct),
                "low": int(created * low_pct)
            })
            score = min(100, (base_completion * 100) + (7 - min(week_offset, 7)) * 2 + random.uniform(-3, 3))
            productivity_score.append({
                "week": week_label,
                "score": round(score, 1)
            })
        week_offset += 1

    # Daily volume - only days within [start_dt_daily, end_dt_daily)
    daily_volume = []
    day_offset = 0
    while day_offset <= 365:
        day = base_dt - timedelta(days=day_offset)
        day_dt = datetime.combine(day.date(), datetime.min.time()).replace(tzinfo=timezone.utc)
        if day_dt + timedelta(days=1) <= start_dt_daily:
            break  # Past the start of range
        if day_dt >= end_dt_daily:
            day_offset += 1
            continue
        day_label = day.strftime("%Y-%m-%d")

        day_total = random.randint(3, 12)
        done_pct = base_completion + (13 - min(day_offset, 13)) * 0.01
        done_count = int(day_total * done_pct)
        remaining = day_total - done_count
        in_progress_count = int(remaining * random.uniform(0.3, 0.6))
        todo_count = remaining - in_progress_count
        daily_volume.append({
            "date": day_label,
            "todo": max(0, todo_count),
            "in_progress": max(0, in_progress_count),
            "done": max(0, done_count),
        })

        day_offset += 1

    # Chronological order: oldest first (for chart display)
    weekly_progress.reverse()
    priority_focus.reverse()
    productivity_score.reverse()
    daily_volume.sort(key=lambda d: d["date"])

    # Recompute summary KPIs from filtered data
    total_created = sum(w["created"] for w in weekly_progress)
    total_completed = sum(w["completed"] for w in weekly_progress)
    completion_rate = round((total_completed / total_created * 100), 1) if total_created else 0
    tasks_this_week = total_completed if weekly_progress else base_tasks_week
    high_priority_completion = round(min(95, base_completion * 100 + 10), 1)
    avg_days_to_complete = round(2.5 + (cohort_hash % 10) / 5, 1)
    weekly_velocity = round(tasks_this_week * base_completion) if tasks_this_week else 0

    return {
        "summary": {
            "completion_rate": completion_rate,
            "tasks_this_week": tasks_this_week,
            "streak_days": base_streak,
            "high_priority_completion": high_priority_completion,
            "avg_days_to_complete": avg_days_to_complete,
            "weekly_velocity": weekly_velocity
        },
        "distribution": {
            "by_category": by_category,
            "by_priority": by_priority
        },
        "trends": {
            "weekly_progress": weekly_progress,
            "priority_focus": priority_focus,
            "productivity_score": productivity_score,
            "daily_volume": daily_volume
        }
    }


def _get_analytics_date_params():
    """Parse and validate start_date/end_date from request. Returns (start_date, end_date) or (None, None)."""
    start_s = request.args.get("start_date")
    end_s = request.args.get("end_date")
    start_date = _parse_date(start_s) if start_s else None
    end_date = _parse_date(end_s) if end_s else None
    return start_date, end_date


@app.route("/api/analytics/summary", methods=["GET"])
def analytics_summary():
    cohort = request.args.get("cohort", "all")
    valid_cohorts = ["all", "power_users", "new_users", "enterprise", "team_alpha", "team_beta"]
    if cohort not in valid_cohorts:
        cohort = "all"
    start_date, end_date = _get_analytics_date_params()

    data = _generate_analytics_data(cohort, start_date, end_date)
    return jsonify(data["summary"])


@app.route("/api/analytics/distribution", methods=["GET"])
def analytics_distribution():
    cohort = request.args.get("cohort", "all")
    valid_cohorts = ["all", "power_users", "new_users", "enterprise", "team_alpha", "team_beta"]
    if cohort not in valid_cohorts:
        cohort = "all"
    start_date, end_date = _get_analytics_date_params()

    data = _generate_analytics_data(cohort, start_date, end_date)
    return jsonify(data["distribution"])


@app.route("/api/analytics/trends", methods=["GET"])
def analytics_trends():
    cohort = request.args.get("cohort", "all")
    valid_cohorts = ["all", "power_users", "new_users", "enterprise", "team_alpha", "team_beta"]
    if cohort not in valid_cohorts:
        cohort = "all"
    start_date, end_date = _get_analytics_date_params()

    data = _generate_analytics_data(cohort, start_date, end_date)
    return jsonify(data["trends"])


@app.route("/analytics")
def analytics_page():
    return send_from_directory(".", "analytics.html")


@app.route("/heatmap")
def heatmap_page():
    return send_from_directory(".", "heatmap.html")


@app.route("/api/analytics/heatmap", methods=["GET"])
def analytics_heatmap():
    weeks = request.args.get("weeks", 12, type=int)
    weeks = max(1, min(52, weeks))

    conn = get_db()
    today = datetime.now(timezone.utc).date()

    start_of_week = today - timedelta(days=today.weekday())
    start_date = start_of_week - timedelta(weeks=weeks - 1)

    rows = conn.execute(
        "SELECT DATE(completed_at) as date, COUNT(*) as count "
        "FROM tasks WHERE completed_at IS NOT NULL "
        "AND DATE(completed_at) >= ? AND DATE(completed_at) <= ? "
        "GROUP BY DATE(completed_at) ORDER BY date",
        (start_date.isoformat(), today.isoformat()),
    ).fetchall()
    daily_counts = {row["date"]: row["count"] for row in rows}

    all_rows = conn.execute(
        "SELECT DISTINCT DATE(completed_at) as date FROM tasks "
        "WHERE completed_at IS NOT NULL ORDER BY date DESC"
    ).fetchall()
    all_dates = set(row["date"] for row in all_rows)

    current_streak = 0
    d = today
    while d.isoformat() in all_dates:
        current_streak += 1
        d -= timedelta(days=1)

    longest_streak = 0
    if all_dates:
        sorted_dates = sorted(all_dates)
        streak = 1
        for i in range(1, len(sorted_dates)):
            prev = datetime.strptime(sorted_dates[i - 1], "%Y-%m-%d").date()
            curr = datetime.strptime(sorted_dates[i], "%Y-%m-%d").date()
            if (curr - prev).days == 1:
                streak += 1
            else:
                longest_streak = max(longest_streak, streak)
                streak = 1
        longest_streak = max(longest_streak, streak)

    total = conn.execute(
        "SELECT COUNT(*) as count FROM tasks WHERE completed_at IS NOT NULL"
    ).fetchone()["count"]

    conn.close()

    result = []
    d = start_date
    while d <= today:
        result.append({"date": d.isoformat(), "count": daily_counts.get(d.isoformat(), 0)})
        d += timedelta(days=1)

    return jsonify({
        "daily_counts": result,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "total_completions": total,
    })


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=8080)
