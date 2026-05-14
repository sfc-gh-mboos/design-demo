"""Shared date-window logic for analytics (demo generator and Databricks queries)."""

from datetime import datetime, timedelta, timezone


def resolve_analytics_window(start_date, end_date, now_utc=None):
    """
    Match server._generate_analytics_data window semantics.
    start_date/end_date are date objects or None.
    Returns (start_dt, end_dt, start_dt_daily, end_dt_daily) as UTC-aware datetimes.
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)
    base_dt = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    if start_date is None:
        start_dt = base_dt - timedelta(weeks=7)
        start_dt_daily = base_dt - timedelta(days=13)
    else:
        start_dt = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        start_dt_daily = start_dt
    if end_date is None:
        end_dt = base_dt + timedelta(days=1)
        end_dt_daily = end_dt
    else:
        end_dt = datetime.combine(end_date, datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(days=1)
        end_dt_daily = end_dt
    return start_dt, end_dt, start_dt_daily, end_dt_daily
