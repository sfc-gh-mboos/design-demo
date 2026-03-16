# Implementation Plan: KAN-146 Add activity heatmap

## Scope
- In scope:
  - Add backend endpoint `GET /api/analytics/heatmap` that returns daily completion counts from `tasks.completed_at` for the last 12 weeks.
  - Add summary metrics for total completions, current streak, and longest streak.
  - Add a new Analytics navigation entry and an Activity Heatmap UI section.
  - Render a 7xN (Mon-Sun x weeks) contribution-style grid with month/day labels and cell tooltips.
  - Style the heatmap using existing CSS variables (`--accent`, `--card`, etc.).
  - Add/extend tests for endpoint behavior and shell markup.
- Out of scope:
  - Adding external charting libraries.
  - Multi-page routing framework changes.
  - Data model migrations beyond current `tasks.completed_at` usage.

## Approach
- Backend:
  - Query `tasks.completed_at` grouped by date (`DATE(completed_at)`), constrained to the 12-week window.
  - Build a normalized date-keyed map for all days in range and merge grouped counts into it.
  - Compute streaks from the daily series:
    - current streak: consecutive completion days ending at today.
    - longest streak: max run of consecutive completion days.
- Frontend:
  - Add top-nav tabs for Tasks and Analytics (no framework; in-page tab switching).
  - Keep existing list/board task views under Tasks tab.
  - Render heatmap cells via DOM from endpoint payload, with opacity-based accent color scale.
  - Show summary stat cards above grid and cell tooltips on hover.
- Tests:
  - API tests for response schema and completion counting behavior.
  - Shell tests for nav and analytics container hooks.

## File Changes
- `server.py` - add heatmap endpoint, date window aggregation, streak stats helper.
- `index.html` - add analytics nav link, analytics panel, and heatmap containers.
- `app.js` - add analytics API call, nav switching, heatmap rendering and labels/tooltips.
- `styles.css` - add analytics/heatmap styles following existing variables and card patterns.
- `tests/test_tasks_api.py` - add endpoint tests and deterministic insert assertions.
- `tests/test_kanban_shell.py` - add markup assertions for analytics tab and heatmap section.

## Steps
1. Implement backend heatmap endpoint and summary computation.
2. Add analytics section markup and nav controls in HTML.
3. Implement frontend analytics state and heatmap renderer.
4. Add CSS for summary cards, grid, labels, and heatmap cells.
5. Add/expand tests for API and shell.
6. Run test suite and fix regressions.
7. Commit and push changes.

## Edge Cases
- No completed tasks in range should still return full date window with zero counts and zero streaks.
- Multiple completions on same date should aggregate into one day count.
- Null `completed_at` values must be ignored.
- Heatmap should remain stable with partial current week.

## Test Plan
- [ ] Unit/API tests for `GET /api/analytics/heatmap` response and counting logic.
- [ ] Shell test coverage for Analytics nav and heatmap container markup.
- [ ] Full pytest run passes.

## Risks
- Existing `PUT /api/tasks/<id>` logic resets `completed_at` whenever status is `done`, which can affect historical fidelity.
  - Mitigation: keep behavior unchanged for this ticket and query directly from stored timestamps; note follow-up if needed.
- Date parsing/timezone differences can skew day boundaries.
  - Mitigation: consistently use date strings (`YYYY-MM-DD`) in backend response and client rendering.
