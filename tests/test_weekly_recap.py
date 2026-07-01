from datetime import date, timedelta

import pytest

import server
from tests.conftest import insert_task


SUMMARY_KEYS = ("completed", "created", "completion_rate", "avg_days_to_complete", "top_category")


def get_recap(conn, today):
    return server._get_weekly_recap(conn, today=today)


class TestWeeklyRecapPage:
    def test_recap_page_returns_200(self, client):
        resp = client.get("/recap")
        assert resp.status_code == 200

    def test_recap_page_serves_html_with_expected_assets(self, client):
        resp = client.get("/recap")
        html = resp.get_data(as_text=True)

        assert "Weekly Recap" in html
        assert 'src="recap.js"' in html
        assert 'href="/recap"' in html
        assert 'id="recapSummary"' in html
        assert 'id="recapDailyRow"' in html
        assert 'id="recapEmptyState"' in html


class TestWeeklyRecapApi:
    def test_api_returns_200_and_json(self, client):
        resp = client.get("/api/analytics/weekly-recap")
        assert resp.status_code == 200
        assert resp.is_json

    def test_api_payload_shape(self, client):
        data = client.get("/api/analytics/weekly-recap").get_json()

        assert set(data.keys()) == {"summary", "daily", "range"}
        assert set(data["summary"].keys()) == set(SUMMARY_KEYS)
        assert set(data["range"].keys()) == {"start", "end"}

        assert isinstance(data["daily"], list)
        assert len(data["daily"]) == 7
        for day in data["daily"]:
            assert set(day.keys()) == {"date", "completed"}

    def test_api_summary_field_types(self, client):
        summary = client.get("/api/analytics/weekly-recap").get_json()["summary"]

        assert isinstance(summary["completed"], int)
        assert isinstance(summary["created"], int)
        assert isinstance(summary["completion_rate"], (int, float))
        assert isinstance(summary["avg_days_to_complete"], (int, float))
        assert summary["top_category"] is None or isinstance(summary["top_category"], str)


class TestWeeklyRecapAggregation:
    def test_empty_database_returns_zeroed_summary(self, bare_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"] == {
            "completed": 0,
            "created": 0,
            "completion_rate": 0.0,
            "avg_days_to_complete": 0.0,
            "top_category": None,
        }
        assert all(day["completed"] == 0 for day in recap["daily"])

    def test_range_covers_seven_calendar_days_inclusive(self, bare_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        expected_start = (recap_today - timedelta(days=6)).isoformat()
        expected_end = recap_today.isoformat()

        assert recap["range"] == {"start": expected_start, "end": expected_end}
        assert recap["daily"][0]["date"] == expected_start
        assert recap["daily"][-1]["date"] == expected_end

    def test_daily_entries_are_chronological(self, seeded_recap_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        dates = [day["date"] for day in recap["daily"]]
        assert dates == sorted(dates)

    def test_seeded_counts_created_and_completed(self, seeded_recap_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["created"] == 5
        assert recap["summary"]["completed"] == 4

    def test_seeded_completion_rate(self, seeded_recap_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["completion_rate"] == 80.0

    def test_seeded_top_category(self, seeded_recap_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["top_category"] == "Design"

    def test_seeded_avg_days_to_complete(self, seeded_recap_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["avg_days_to_complete"] == 0.5

    def test_seeded_daily_breakdown(self, seeded_recap_db, recap_today):
        conn = server.get_db()
        recap = get_recap(conn, recap_today)
        conn.close()

        daily = {day["date"]: day["completed"] for day in recap["daily"]}
        assert daily["2026-06-24"] == 1
        assert daily["2026-06-25"] == 1
        assert daily["2026-06-26"] == 1
        assert daily["2026-06-27"] == 1
        assert daily["2026-06-28"] == 0
        assert daily["2026-06-29"] == 0
        assert daily["2026-06-30"] == 0

    def test_created_outside_window_not_counted(self, bare_db, recap_today):
        conn = server.get_db()
        insert_task(
            conn,
            title="Old task",
            status="todo",
            category="Planning",
            created_at="2026-06-01 09:00:00",
        )
        conn.commit()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["created"] == 0

    def test_completed_outside_window_not_counted(self, bare_db, recap_today):
        conn = server.get_db()
        insert_task(
            conn,
            title="Old completion",
            status="done",
            category="Planning",
            created_at="2026-06-01 09:00:00",
            completed_at="2026-06-10 09:00:00",
        )
        conn.commit()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["completed"] == 0

    def test_completion_before_window_excluded_even_if_created_inside(self, bare_db, recap_today):
        conn = server.get_db()
        insert_task(
            conn,
            title="Early completion",
            status="done",
            category="Operations",
            created_at="2026-06-24 09:00:00",
            completed_at="2026-06-23 09:00:00",
        )
        conn.commit()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["created"] == 1
        assert recap["summary"]["completed"] == 0

    def test_in_progress_tasks_count_as_created_not_completed(self, bare_db, recap_today):
        conn = server.get_db()
        insert_task(
            conn,
            title="Still working",
            status="in-progress",
            category="Engineering",
            created_at="2026-06-28 09:00:00",
        )
        conn.commit()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["created"] == 1
        assert recap["summary"]["completed"] == 0

    def test_done_without_completed_at_not_counted_as_completed(self, bare_db, recap_today):
        conn = server.get_db()
        insert_task(
            conn,
            title="Missing completion timestamp",
            status="done",
            category="Engineering",
            created_at="2026-06-28 09:00:00",
            completed_at=None,
        )
        conn.commit()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["created"] == 1
        assert recap["summary"]["completed"] == 0
        assert recap["summary"]["top_category"] is None

    def test_completion_can_count_when_created_before_window(self, bare_db, recap_today):
        conn = server.get_db()
        insert_task(
            conn,
            title="Cross-window completion",
            status="done",
            category="Operations",
            created_at="2026-06-01 09:00:00",
            completed_at="2026-06-26 09:00:00",
        )
        conn.commit()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["created"] == 0
        assert recap["summary"]["completed"] == 1
        assert recap["summary"]["completion_rate"] == 0.0
        assert recap["summary"]["top_category"] == "Operations"

    @pytest.mark.parametrize(
        "created_count,completed_count,expected_rate",
        [
            (0, 0, 0.0),
            (4, 2, 50.0),
            (3, 3, 100.0),
        ],
    )
    def test_completion_rate_calculation(
        self, bare_db, recap_today, created_count, completed_count, expected_rate
    ):
        conn = server.get_db()
        for i in range(created_count):
            status = "done" if i < completed_count else "todo"
            completed_at = "2026-06-28 12:00:00" if status == "done" else None
            insert_task(
                conn,
                title=f"Task {i}",
                status=status,
                category="Planning",
                created_at=f"2026-06-2{4 + (i % 3)} 09:00:00",
                completed_at=completed_at,
            )
        conn.commit()
        recap = get_recap(conn, recap_today)
        conn.close()

        assert recap["summary"]["completion_rate"] == expected_rate
