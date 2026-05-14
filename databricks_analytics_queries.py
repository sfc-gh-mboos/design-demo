"""
Parameterized Databricks SQL for analytics.

Targets a Unity Catalog table or view (default: main.taskflow_analytics.tasks_fact)
with columns: cohort_segment, category, priority, status, created_at, completed_at.

Table name is injected by the caller after validation (see analytics_config.databricks_tasks_table_sql).
"""


def _cohort_params(cohort):
    return (cohort, cohort)


def sql_weekly_created(tasks_table):
    return f"""
SELECT date_trunc('week', created_at) AS week_start,
       count(*) AS created_cnt
FROM {tasks_table} AS t
WHERE created_at >= CAST(? AS TIMESTAMP)
  AND created_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
GROUP BY date_trunc('week', created_at)
ORDER BY week_start
"""


def sql_weekly_completed(tasks_table):
    return f"""
SELECT date_trunc('week', completed_at) AS week_start,
       count(*) AS completed_cnt
FROM {tasks_table} AS t
WHERE status = 'done'
  AND completed_at IS NOT NULL
  AND completed_at >= CAST(? AS TIMESTAMP)
  AND completed_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
GROUP BY date_trunc('week', completed_at)
ORDER BY week_start
"""


def sql_weekly_priority_focus(tasks_table):
    return f"""
SELECT date_trunc('week', created_at) AS week_start,
       sum(CASE WHEN lower(priority) = 'high' THEN 1 ELSE 0 END) AS high_cnt,
       sum(CASE WHEN lower(priority) = 'medium' THEN 1 ELSE 0 END) AS medium_cnt,
       sum(CASE WHEN lower(priority) = 'low' THEN 1 ELSE 0 END) AS low_cnt
FROM {tasks_table} AS t
WHERE created_at >= CAST(? AS TIMESTAMP)
  AND created_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
GROUP BY date_trunc('week', created_at)
ORDER BY week_start
"""


def sql_daily_volume(tasks_table):
    return f"""
SELECT CAST(created_at AS DATE) AS d,
       sum(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) AS todo_cnt,
       sum(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) AS in_progress_cnt,
       sum(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_cnt
FROM {tasks_table} AS t
WHERE created_at >= CAST(? AS TIMESTAMP)
  AND created_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
GROUP BY CAST(created_at AS DATE)
ORDER BY d
"""


def sql_distribution_category(tasks_table):
    return f"""
SELECT category AS name,
       count(*) AS total,
       sum(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed
FROM {tasks_table} AS t
WHERE created_at >= CAST(? AS TIMESTAMP)
  AND created_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
GROUP BY category
ORDER BY name
"""


def sql_distribution_priority(tasks_table):
    return f"""
SELECT lower(priority) AS name,
       count(*) AS cnt
FROM {tasks_table} AS t
WHERE created_at >= CAST(? AS TIMESTAMP)
  AND created_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
GROUP BY lower(priority)
ORDER BY name
"""


def sql_tasks_completed_this_week(tasks_table):
    return f"""
SELECT count(*) AS n
FROM {tasks_table} AS t
WHERE status = 'done'
  AND completed_at IS NOT NULL
  AND completed_at >= CAST(? AS TIMESTAMP)
  AND completed_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
"""


def sql_high_priority_completion(tasks_table):
    return f"""
SELECT sum(CASE WHEN status = 'done' THEN 1 ELSE 0 END) * 100.0 / NULLIF(count(*), 0) AS pct
FROM {tasks_table} AS t
WHERE lower(priority) = 'high'
  AND created_at >= CAST(? AS TIMESTAMP)
  AND created_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
"""


def sql_avg_days_to_complete(tasks_table):
    return f"""
SELECT avg(datediff(to_date(completed_at), to_date(created_at))) AS avg_days
FROM {tasks_table} AS t
WHERE status = 'done'
  AND completed_at IS NOT NULL
  AND created_at IS NOT NULL
  AND completed_at >= CAST(? AS TIMESTAMP)
  AND completed_at < CAST(? AS TIMESTAMP)
  AND (? = 'all' OR cohort_segment = ?)
"""


def sql_completion_days_for_streak(tasks_table):
    return f"""
SELECT DISTINCT CAST(completed_at AS DATE) AS d
FROM {tasks_table} AS t
WHERE status = 'done'
  AND completed_at IS NOT NULL
  AND (? = 'all' OR cohort_segment = ?)
  AND CAST(completed_at AS DATE) <= CURRENT_DATE()
ORDER BY 1 DESC
LIMIT 4000
"""
