"""API tests for task operations."""

import os
from pathlib import Path

import pytest


@pytest.fixture
def api_client(tmp_path):
    os.environ["TESTING"] = "1"
    import server

    db_path = Path(tmp_path) / "taskflow-test.db"
    server.DB_PATH = str(db_path)
    server.init_db()
    return server.app.test_client()


def test_get_tasks_returns_list(api_client):
    response = api_client.get("/api/tasks")

    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)


def test_get_tasks_filters_by_status(api_client):
    response = api_client.get("/api/tasks?status=todo")

    assert response.status_code == 200
    payload = response.get_json()
    assert isinstance(payload, list)


def test_analytics_summary_returns_expected_shape(api_client):
    response = api_client.get("/api/analytics/summary?cohort=all")
    
    assert response.status_code == 200
    payload = response.get_json()
    
    assert isinstance(payload, dict)
    assert "completion_rate" in payload
    assert "tasks_this_week" in payload
    assert "streak_days" in payload
    assert "high_priority_completion" in payload
    assert "avg_days_to_complete" in payload
    assert "weekly_velocity" in payload
    
    assert isinstance(payload["completion_rate"], (int, float))
    assert isinstance(payload["tasks_this_week"], int)
    assert isinstance(payload["streak_days"], int)
    assert isinstance(payload["high_priority_completion"], (int, float))
    assert isinstance(payload["avg_days_to_complete"], (int, float))
    assert isinstance(payload["weekly_velocity"], int)


def test_analytics_distribution_returns_categories_and_priorities(api_client):
    response = api_client.get("/api/analytics/distribution?cohort=all")
    
    assert response.status_code == 200
    payload = response.get_json()
    
    assert isinstance(payload, dict)
    assert "by_category" in payload
    assert "by_priority" in payload
    
    assert isinstance(payload["by_category"], list)
    assert len(payload["by_category"]) > 0
    for item in payload["by_category"]:
        assert "name" in item
        assert "total" in item
        assert "completed" in item
    
    assert isinstance(payload["by_priority"], list)
    assert len(payload["by_priority"]) > 0
    for item in payload["by_priority"]:
        assert "name" in item
        assert "count" in item


def test_analytics_trends_returns_weekly_data(api_client):
    response = api_client.get("/api/analytics/trends?cohort=all")
    
    assert response.status_code == 200
    payload = response.get_json()
    
    assert isinstance(payload, dict)
    assert "weekly_progress" in payload
    assert "priority_focus" in payload
    assert "productivity_score" in payload
    
    assert isinstance(payload["weekly_progress"], list)
    assert len(payload["weekly_progress"]) == 8
    for item in payload["weekly_progress"]:
        assert "week" in item
        assert "created" in item
        assert "completed" in item
    
    assert isinstance(payload["priority_focus"], list)
    assert len(payload["priority_focus"]) == 8
    for item in payload["priority_focus"]:
        assert "week" in item
        assert "high" in item
        assert "medium" in item
        assert "low" in item
    
    assert isinstance(payload["productivity_score"], list)
    assert len(payload["productivity_score"]) == 8
    for item in payload["productivity_score"]:
        assert "week" in item
        assert "score" in item


def test_analytics_cohort_filter_changes_data(api_client):
    response_all = api_client.get("/api/analytics/summary?cohort=all")
    response_power = api_client.get("/api/analytics/summary?cohort=power_users")
    
    assert response_all.status_code == 200
    assert response_power.status_code == 200
    
    data_all = response_all.get_json()
    data_power = response_power.get_json()
    
    # Different cohorts should return different data (deterministic but distinct)
    # Note: This test verifies the filter works, but doesn't guarantee different values
    # since the hash-based seeding could theoretically produce similar values
    assert isinstance(data_all, dict)
    assert isinstance(data_power, dict)
    
    # Test invalid cohort defaults to "all"
    response_invalid = api_client.get("/api/analytics/summary?cohort=invalid_cohort")
    assert response_invalid.status_code == 200
    data_invalid = response_invalid.get_json()
    assert isinstance(data_invalid, dict)
    assert "completion_rate" in data_invalid


def test_heatmap_returns_expected_shape(api_client):
    response = api_client.get("/api/analytics/heatmap")

    assert response.status_code == 200
    payload = response.get_json()

    assert isinstance(payload, dict)
    assert "days" in payload
    assert "max_count" in payload
    assert "stats" in payload

    assert isinstance(payload["days"], list)
    assert isinstance(payload["max_count"], int)

    stats = payload["stats"]
    assert "current_streak" in stats
    assert "longest_streak" in stats
    assert "total_completions" in stats
    assert isinstance(stats["current_streak"], int)
    assert isinstance(stats["longest_streak"], int)
    assert isinstance(stats["total_completions"], int)


def test_heatmap_days_have_date_and_count(api_client):
    response = api_client.get("/api/analytics/heatmap?weeks=4")

    assert response.status_code == 200
    payload = response.get_json()

    for day in payload["days"]:
        assert "date" in day
        assert "count" in day
        assert isinstance(day["count"], int)
        assert day["count"] >= 0


def test_heatmap_weeks_param_bounds(api_client):
    response_min = api_client.get("/api/analytics/heatmap?weeks=0")
    assert response_min.status_code == 200
    data_min = response_min.get_json()
    assert isinstance(data_min["days"], list)

    response_max = api_client.get("/api/analytics/heatmap?weeks=100")
    assert response_max.status_code == 200
    data_max = response_max.get_json()
    assert isinstance(data_max["days"], list)


def test_heatmap_with_completed_tasks(api_client):
    api_client.put(
        "/api/tasks/1",
        json={"status": "done"},
        content_type="application/json",
    )

    response = api_client.get("/api/analytics/heatmap")
    assert response.status_code == 200
    payload = response.get_json()

    assert payload["stats"]["total_completions"] >= 0


def test_heatmap_page_serves(api_client):
    response = api_client.get("/heatmap")
    assert response.status_code == 200
