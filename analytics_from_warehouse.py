"""Load analytics payloads from Databricks to match _generate_analytics_data shape."""

from datetime import date, datetime, timedelta, timezone

from analytics_config import databricks_config_ok, databricks_tasks_table_sql
from analytics_dates import resolve_analytics_window
import databricks_analytics_queries as q
from databricks_client import DatabricksQueryError, run_query


class AnalyticsWarehouseError(Exception):
    """Misconfiguration or warehouse failure for analytics."""


def _ts(d):
    return d.strftime("%Y-%m-%d %H:%M:%S")


def _as_date(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, str):
        return date.fromisoformat(v[:10])
    return v


def _week_key(row, col="week_start"):
    v = row.get(col)
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, str):
        return v[:10]
    return str(v)


def _current_week_bounds(now_utc=None):
    now = now_utc or datetime.now(timezone.utc)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    return week_start, week_end


def _streak_days(completion_rows, today):
    day_set = set()
    for row in completion_rows:
        d = _as_date(row.get("d"))
        if d:
            day_set.add(d)
    streak = 0
    probe = today
    while probe in day_set:
        streak += 1
        probe -= timedelta(days=1)
    return streak


def _num(v, default=0):
    if v is None:
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return default


def _float(v, default=0.0):
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def fetch_analytics_bundle(cohort, start_date, end_date):
    """
    Run warehouse queries and return the same top-level keys as _generate_analytics_data:
    summary, distribution, trends.
    """
    if not databricks_config_ok():
        raise AnalyticsWarehouseError(
            "TASKFLOW_ANALYTICS_SOURCE=databricks but DATABRICKS_SERVER_HOSTNAME, "
            "DATABRICKS_HTTP_PATH, and DATABRICKS_TOKEN must be set, and catalog/schema/table "
            "names must be valid identifiers."
        )

    table = databricks_tasks_table_sql()
    now = datetime.now(timezone.utc)
    start_dt, end_dt, start_dt_daily, end_dt_daily = resolve_analytics_window(start_date, end_date, now)
    ts_week_start = _ts(start_dt)
    ts_week_end = _ts(end_dt)
    ts_daily_start = _ts(start_dt_daily)
    ts_daily_end = _ts(end_dt_daily)
    cohort_params = (cohort, cohort)
    range_params = (ts_week_start, ts_week_end) + cohort_params
    daily_params = (ts_daily_start, ts_daily_end) + cohort_params

    try:
        rows_created = run_query(q.sql_weekly_created(table), range_params)
        rows_completed = run_query(q.sql_weekly_completed(table), range_params)
        rows_priority = run_query(q.sql_weekly_priority_focus(table), range_params)
        rows_daily = run_query(q.sql_daily_volume(table), daily_params)
        rows_cat = run_query(q.sql_distribution_category(table), range_params)
        rows_prio = run_query(q.sql_distribution_priority(table), range_params)
        week_start, week_end = _current_week_bounds(now)
        this_week_params = (_ts(week_start), _ts(week_end)) + cohort_params
        row_this_week = run_query(q.sql_tasks_completed_this_week(table), this_week_params)
        row_hi = run_query(q.sql_high_priority_completion(table), range_params)
        row_avg = run_query(q.sql_avg_days_to_complete(table), range_params)
        rows_streak_days = run_query(q.sql_completion_days_for_streak(table), cohort_params)
    except DatabricksQueryError as e:
        raise AnalyticsWarehouseError(str(e)) from e

    by_week = {}
    for r in rows_created:
        k = _week_key(r)
        slot = by_week.setdefault(k, {"created": 0, "completed": 0, "high": 0, "medium": 0, "low": 0})
        slot["created"] = _num(r.get("created_cnt"))
    for r in rows_completed:
        k = _week_key(r)
        slot = by_week.setdefault(k, {"created": 0, "completed": 0, "high": 0, "medium": 0, "low": 0})
        slot["completed"] = _num(r.get("completed_cnt"))
    for r in rows_priority:
        k = _week_key(r)
        slot = by_week.setdefault(k, {"created": 0, "completed": 0, "high": 0, "medium": 0, "low": 0})
        slot["high"] = _num(r.get("high_cnt"))
        slot["medium"] = _num(r.get("medium_cnt"))
        slot["low"] = _num(r.get("low_cnt"))

    week_keys = sorted(by_week.keys())
    weekly_progress = [
        {"week": k, "created": by_week[k]["created"], "completed": by_week[k]["completed"]} for k in week_keys
    ]
    priority_focus = [
        {"week": k, "high": by_week[k]["high"], "medium": by_week[k]["medium"], "low": by_week[k]["low"]}
        for k in week_keys
    ]
    productivity_score = []
    for k in week_keys:
        c = by_week[k]["created"]
        d = by_week[k]["completed"]
        score = min(100.0, (d / c * 100.0)) if c else 0.0
        productivity_score.append({"week": k, "score": round(score, 1)})

    daily_volume = []
    for r in rows_daily:
        dkey = _as_date(r.get("d"))
        if dkey:
            daily_volume.append(
                {
                    "date": dkey.isoformat(),
                    "todo": _num(r.get("todo_cnt")),
                    "in_progress": _num(r.get("in_progress_cnt")),
                    "done": _num(r.get("done_cnt")),
                }
            )
    daily_volume.sort(key=lambda x: x["date"])

    by_category = []
    for r in rows_cat:
        name = r.get("name")
        if name is None or str(name).strip() == "":
            name = "Unknown"
        by_category.append(
            {
                "name": str(name),
                "total": max(0, _num(r.get("total"))),
                "completed": max(0, _num(r.get("completed"))),
            }
        )

    prio_map = {}
    for r in rows_prio:
        name = (r.get("name") or "").strip().lower()
        if name:
            prio_map[name] = _num(r.get("cnt"))
    by_priority = [{"name": n, "count": prio_map.get(n, 0)} for n in ("high", "medium", "low")]

    tasks_this_week = _num(row_this_week[0].get("n")) if row_this_week else 0
    hi_pct = _float(row_hi[0].get("pct")) if row_hi else 0.0
    high_priority_completion = round(hi_pct, 1)
    avg_days = _float(row_avg[0].get("avg_days")) if row_avg else 0.0
    avg_days_to_complete = round(avg_days, 1)

    total_created = sum(w["created"] for w in weekly_progress)
    total_completed = sum(w["completed"] for w in weekly_progress)
    completion_rate = round((total_completed / total_created * 100.0), 1) if total_created else 0.0

    today = now.date()
    streak_days = _streak_days(rows_streak_days, today)

    return {
        "summary": {
            "completion_rate": completion_rate,
            "tasks_this_week": tasks_this_week,
            "streak_days": streak_days,
            "high_priority_completion": high_priority_completion,
            "avg_days_to_complete": avg_days_to_complete,
        },
        "distribution": {"by_category": by_category, "by_priority": by_priority},
        "trends": {
            "weekly_progress": weekly_progress,
            "priority_focus": priority_focus,
            "productivity_score": productivity_score,
            "daily_volume": daily_volume,
        },
    }
