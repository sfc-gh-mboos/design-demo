# Implementation Plan: KAN-146 Add activity heatmap

## Scope
- Add a new analytics page reachable from top navigation.
- Add API endpoint `GET /api/analytics/heatmap` for daily completion counts.
- Render a GitHub-style contribution heatmap for the last 12 weeks.
- Display summary stats above the grid: current streak, longest streak, total completions.
- Add test coverage for the new endpoint and updated shell markup.

## Approach
- Keep the existing app as a single-page frontend and add hash-based page switching between `#tasks` and `#analytics`.
- Extend the backend with one analytics route that aggregates `completed_at` timestamps by date.
- Return dense daily data for the window so frontend rendering stays straightforward.
- Compute streak and total metrics from the same window to keep summary and chart aligned.

## File Changes
- `server.py` - add analytics endpoint and helper functions for date window/streak calculations.
- `index.html` - add top-nav analytics link and analytics page shell.
- `app.js` - add analytics API call, page routing, heatmap rendering, and tooltip text.
- `styles.css` - add analytics page and contribution grid styles using existing design tokens.
- `tests/test_tasks_api.py` - add endpoint response and aggregation tests.
- `tests/test_kanban_shell.py` - assert analytics nav link and analytics section shell.

## Steps
1. Implement backend analytics endpoint and JSON response shape.
2. Add analytics markup and page containers to HTML.
3. Add frontend analytics state, fetch, and render logic.
4. Add heatmap and summary styling.
5. Add/adjust tests for API + shell.
6. Commit and push implementation.
7. Run tests and demo verification.

## Edge Cases
- No completed tasks in window should still render empty grid and zero stats.
- Sparse completion dates should still align correctly in week/day grid.
- Invalid/missing timestamp values should not break aggregation.

## Test Plan
- [ ] Unit/API tests for `/api/analytics/heatmap` response shape and counts.
- [ ] Shell tests assert nav contains Tasks and Analytics and analytics section exists.
- [ ] Manual demo: open analytics page, verify grid rendering and hover tooltips.

## Risks
- Date alignment mismatch between backend window and frontend grid.
  - Mitigation: backend returns explicit `start_date` and `end_date`; frontend builds grid from those bounds.
