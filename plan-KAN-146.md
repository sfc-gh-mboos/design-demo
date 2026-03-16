# Implementation Plan: KAN-146 Add activity heatmap

## Scope
- In scope:
  - Add a new Analytics page in the top nav.
  - Add backend endpoint `GET /api/analytics/heatmap`.
  - Render a 12-week GitHub-style activity heatmap with day/month labels.
  - Show summary stats: current streak, longest streak, total completions.
  - Add tests for API and shell markup updates.
- Out of scope:
  - External chart libraries.
  - Changes to task CRUD behavior.

## Approach
- Build a dense 84-day (12x7) backend series anchored to Monday-based weeks.
- Aggregate completion counts from `tasks.completed_at` where `status = 'done'`.
- Compute streak stats server-side for consistency.
- Add client-side page toggle (Tasks/Analytics), fetch analytics data, and render
  heatmap cells with accent-opacity intensity levels and native title tooltips.

## File Changes
- `server.py` - add analytics endpoint and streak helpers.
- `index.html` - add nav item and analytics page shell.
- `app.js` - add page routing/toggle and heatmap rendering.
- `styles.css` - add heatmap and analytics styles.
- `tests/test_tasks_api.py` - add endpoint aggregation/shape tests.
- `tests/test_kanban_shell.py` - add analytics nav/page shell tests.

## Steps
1. Add API response contract and dense date aggregation in backend.
2. Add analytics page markup and nav link in HTML.
3. Add client logic for fetching and rendering heatmap.
4. Add heatmap CSS based on existing design variables.
5. Add tests for API and UI shell.
6. Commit + push.
7. Run tests and demo verification commands.

## Edge Cases
- Empty completion history (all-zero heatmap and zero streaks).
- Sparse completion history (gaps across weeks/month boundaries).
- Same-day multiple completions (single cell with higher count).

## Test Plan
- [ ] Endpoint returns dense 84-day payload.
- [ ] Endpoint returns expected counts and streak stats for controlled fixtures.
- [ ] Index shell includes Analytics nav and heatmap containers.
- [ ] Existing task list/board shell tests continue passing.

## Risks
- Date boundary and timezone handling could cause off-by-one day issues.
  - Mitigation: use UTC dates and deterministic test timestamps.
