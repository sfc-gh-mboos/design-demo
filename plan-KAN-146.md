# Implementation Plan: KAN-146 Add activity heatmap

## Scope
In scope:
- Add a new analytics API endpoint for heatmap data.
- Add an Analytics page in the UI and expose it via top navigation.
- Render a GitHub-style contribution heatmap for the last 12 weeks.
- Show summary stats above the heatmap.
- Add tests for endpoint and analytics shell markup.

Out of scope:
- External charting libraries.
- Non-task analytics beyond completion counts and streak stats.

## Approach
- Build a dense date series server-side (84 days) and left-join completion counts.
- Compute streak stats from the daily series.
- Keep the existing single-page app structure and add a lightweight page switcher for Tasks vs Analytics.
- Render the heatmap with pure HTML/CSS/JS and native tooltip titles.

## File Changes
- `server.py` - add `/api/analytics/heatmap` and helper functions for aggregation/streaks.
- `index.html` - add Analytics nav link and analytics page shell.
- `app.js` - add page state, analytics fetch/render logic, month/day labels, tooltip content.
- `styles.css` - add analytics layout + heatmap styles with accent opacity scale.
- `tests/test_tasks_api.py` - add endpoint tests.
- `tests/test_kanban_shell.py` - add analytics nav/shell presence tests.

## Steps
1. Implement heatmap endpoint and helper logic in backend.
2. Add analytics page shell to HTML.
3. Add analytics render behavior and routing in JS.
4. Add heatmap styles in CSS.
5. Add/adjust tests for backend and shell.
6. Run tests and manual browser verification.
7. Commit and push branch updates.

## Edge Cases
- Days with no completions must still be present in output.
- Invalid or empty `completed_at` values should not break aggregation.
- Multiple completions on same day must aggregate correctly.
- Streak logic should reset on zero-completion days.

## Test Plan
- [ ] API test: endpoint responds `200` with expected keys and 84-day series.
- [ ] API test: known seeded completions aggregate correctly by date.
- [ ] API test: streak and total stats are computed.
- [ ] Shell test: top nav includes Analytics link.
- [ ] Shell test: analytics page container and key IDs exist.
- [ ] Manual UI check: heatmap renders and tooltips show date + count.

## Risks
- Date/time parsing inconsistencies across environments.  
  Mitigation: parse dates defensively and aggregate by calendar date strings.
- Layout regressions on narrow screens.  
  Mitigation: include responsive heatmap overflow and compact card layout.
