# Implementation Plan: KAN-146 Add activity heatmap

## Scope
In scope:
- Re-introduce a dedicated `Heatmap` page linked in the top navigation with visual styling aligned to the provided Figma node.
- Add and expose `GET /api/analytics/heatmap` backed by task completion timestamps in `tasks.completed_at`.
- Render a 12-week, 7-row heatmap grid with month/day labels, summary KPIs, and tooltips.
- Update tests to validate the restored endpoint and page.

Out of scope:
- Reworking existing analytics chart endpoints.
- Adding external charting libraries.

## Design Reference
- Figma: https://www.figma.com/design/oTsNM9L38fv9uDNLwK0K9l/Task--Management--Web-App-Design--Community-?node-id=3457-32&m=dev
- Key intent: large white card, subtle borders, accent-based intensity scale, and top summary stats (`Current Streak`, `Longest Streak`, `Total Completions`).

## Approach
Implement server-side aggregation from SQLite `tasks` data for the last 12 calendar weeks (Monday-first), compute streak metrics, and return a compact data model for front-end rendering. Recreate heatmap HTML/JS/CSS using existing layout conventions while matching Figma spacing, typography hierarchy, and color intensities.

## File Changes
- `server.py` - restore heatmap aggregation helpers, API endpoint, and `heatmap.html` route.
- `index.html` - add `Heatmap` nav item.
- `analytics.html` - add `Heatmap` nav item.
- `heatmap.html` - create page shell and heatmap structure.
- `heatmap.js` - fetch endpoint, render grid, wire summary stats and tooltips.
- `styles.css` - add heatmap-specific styling (summary, board, labels, legend, responsive behavior).
- `tests/test_app.py` - replace removal assertions with endpoint/page coverage.

## Steps
1. Re-add backend heatmap aggregation functions and endpoint contract.
2. Re-add `Heatmap` page route and top-nav links.
3. Build the heatmap page structure and data rendering script.
4. Implement styling tuned to the Figma mock.
5. Update tests to assert the restored behavior.
6. Run test suite and validate endpoint/page behavior.

## Edge Cases
- No completed tasks in range should still render a full 12-week grid with zero-intensity cells.
- Streak logic should return `0` when there are no consecutive completions ending today.

## Test Plan
- [ ] `pytest` passes for `tests/test_app.py`
- [ ] `GET /api/analytics/heatmap` returns valid summary and 12x7 grid shape
- [ ] `GET /heatmap` returns HTTP 200

## Risks
- Existing unrelated local changes may also touch heatmap files; avoid clobbering intent by keeping edits scoped to ticket requirements.
- Pixel-perfect expectations can vary by browser font rendering; layout and spacing are matched to Figma proportions with existing project fonts.
