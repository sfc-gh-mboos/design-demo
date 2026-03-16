"""Tests for initial Kanban board shell UI markup."""

import os

import pytest


@pytest.fixture
def ui_client(tmp_path):
    os.environ["TESTING"] = "1"
    import server

    server.DB_PATH = str(tmp_path / "taskflow-ui.db")
    server.init_db()
    return server.app.test_client()


def test_index_includes_list_board_toggle(ui_client):
    response = ui_client.get("/")

    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'id="viewToggle"' in html
    assert 'data-view="list"' in html
    assert 'data-view="board"' in html


def test_index_includes_board_shell_columns(ui_client):
    response = ui_client.get("/")

    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'id="boardView"' in html
    assert 'data-board-column="todo"' in html
    assert 'data-board-column="in-progress"' in html
    assert 'data-board-column="done"' in html


def test_index_includes_analytics_nav_and_heatmap_shell(ui_client):
    response = ui_client.get("/")

    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'data-page-link="tasks"' in html
    assert 'data-page-link="analytics"' in html
    assert 'id="analyticsPage"' in html
    assert 'id="heatmapGrid"' in html
    assert 'id="heatmapMonthLabels"' in html
    assert 'id="currentStreak"' in html
    assert 'id="longestStreak"' in html
    assert 'id="totalCompletions"' in html
