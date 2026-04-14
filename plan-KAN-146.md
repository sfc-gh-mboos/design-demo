# Implementation Plan: KAN-146 Add activity heatmap

## Scope
In scope:
- Add a dedicated Heatmap page accessible from top navigation.
- Add `GET /api/analytics/heatmap` endpoint backed by real task completion data.
- Render a 12-week GitHub-style grid with tooltips and summary stats.
- Match the provided Figma mock as closely as possible while preserving dynamic data behavior.
- Add/update tests for the new page and API endpoint.

Out of scope:
- Refactoring existing analytics chart architecture.
- Introducing external charting libraries for heatmap rendering.
- Cohort-based filtering for heatmap data.

## Design Reference
Figma: https://www.figma.com/design/oTsNM9L38fv9uDNLwK0K9l/Task--Management--Web-App-Design--Community-?node-id=3457-32&m=dev

Design intent summary:
- Page title and summary metrics at top.
- Large rounded card containing day labels, month labels, and a weekly-column heatmap grid.
- Accent color (`#f54e00`) used with progressive opacity levels.
- Small "Less -> More" legend with six intensity steps.

## Approach
- Keep existing analytics dashboard intact and add a dedicated `/heatmap` page.
- Build a server-side SQL aggregation query over `tasks.completed_at` to return daily completion counts for the last 12 weeks.
- Compute streak metrics and intensity levels on the backend so frontend rendering stays simple and consistent.
- Implement the heatmap with semantic HTML + CSS Grid and client-side rendering in `heatmap.js`.
- Reuse existing design tokens from `styles.css` and add focused heatmap-specific styles to match Figma spacing, borders, and typography.

## File Changes
- `server.py` - Add `/heatmap` page route and new heatmap analytics API endpoint with DB aggregation and streak summary.
- `index.html` - Add Heatmap link in top nav.
- `analytics.html` - Add Heatmap link in top nav.
- `heatmap.html` - New page shell and heatmap UI structure.
- `heatmap.js` - New script to fetch API data, render cells, labels, legend, and tooltips.
- `styles.css` - Add heatmap page and component styles; ensure responsive behavior.
- `tests/test_app.py` - Add tests for `/heatmap` page and `/api/analytics/heatmap` response shape/behavior.

## Steps
1. Add backend endpoint and helper logic for 12-week completion grid + streak stats.
2. Create `heatmap.html` and wire page route/script.
3. Implement client rendering in `heatmap.js` with tooltip behavior and month/day labeling.
4. Update shared top nav across existing pages.
5. Add/extend tests for new page and API endpoint.
6. Run tests and fix any regressions.
7. Commit logically grouped changes and create a PR.

## Edge Cases
- No completed tasks in range should still return full 12-week grid with zeroed counts.
- Completed tasks outside the 12-week window should not affect the grid but may still impact lifetime totals only if explicitly required.
- Mixed timestamp formats should be normalized through SQLite `date()` extraction.
- Partial first/last week alignment must still keep a Monday-first, 7-row layout.

## Test Plan
- [ ] Page route test for `GET /heatmap`.
- [ ] Endpoint test for `GET /api/analytics/heatmap` basic shape.
- [ ] Endpoint test ensuring all returned dates are within expected 12-week range.
- [ ] Endpoint test ensuring summary metrics exist and are numeric.
- [ ] Manual check for tooltip content and month/day labels in browser.

## Risks
- Existing repo has prior in-progress edits and deleted heatmap files; changes must avoid reverting user work.
- Exact pixel parity across all viewport sizes may require iterative CSS tuning.
- UTC/local date handling can affect streak calculations near day boundaries.
