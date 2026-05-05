# Implementation Plan: KAN-146 Add activity heatmap

## Scope
In scope:
- Add a dedicated Activity Heatmap page at `/heatmap` and wire top navigation alongside Tasks and Analytics.
- Render a GitHub-style 12-week completion heatmap from `GET /api/analytics/heatmap`.
- Match the provided Figma mock with pixel-focused layout and spacing.
- Add test coverage for the new page route and heatmap API response contract.

Out of scope:
- Changes to analytics dashboard chart behavior.
- Database schema changes beyond existing `completed_at` support.

## Design Reference
Figma: https://www.figma.com/design/oTsNM9L38fv9uDNLwK0K9l/Task--Management--Web-App-Design--Community-?node-id=3457-32&m=dev

Design intent:
- Clean page shell with top nav and wide card container.
- Header title + three summary stats above a 12-column x 7-row grid.
- Accent-driven intensity scale from empty (white/card) to full accent.
- Month labels on top axis, selective day labels on y-axis, compact legend.

## Approach
- Reuse existing backend endpoint `GET /api/analytics/heatmap` and existing heatmap CSS block, then tune styles for Figma parity.
- Reintroduce dedicated `heatmap.html` and `heatmap.js` to keep concerns isolated from `analytics.html`.
- Render month labels and cells from API payload rather than hardcoding data.
- Implement lightweight tooltip behavior in vanilla JS with keyboard/focus support.

## File Changes
- `server.py` - add `/heatmap` page route.
- `index.html` - add Heatmap nav link.
- `analytics.html` - add Heatmap nav link.
- `heatmap.html` - new dedicated page markup.
- `heatmap.js` - new fetch/render/tooltip logic.
- `styles.css` - tune heatmap layout/spacing/typography for pixel fidelity.
- `tests/test_app.py` - add route and API contract coverage.

## Steps
1. Add `/heatmap` route and nav links across existing pages.
2. Create heatmap page HTML shell and placeholder containers.
3. Implement JS rendering from `/api/analytics/heatmap`.
4. Adjust CSS for Figma parity (container, labels, grid, legend, tooltip).
5. Add tests for `/heatmap` and API shape.
6. Run tests and lint diagnostics, then prepare commit and PR.

## Edge Cases
- No completions in period (all level-0 cells, summary zeros).
- Sparse month boundaries inside 12-week range.
- Invalid or missing API fields (display graceful empty state).
- Tooltip positioning near viewport edges.

## Test Plan
- [ ] Unit-like endpoint test for `GET /api/analytics/heatmap` structure.
- [ ] Page route test for `GET /heatmap`.
- [ ] Existing page route tests continue to pass.

## Risks
- Pixel-perfect tuning may conflict with responsive behavior; mitigate with breakpoint-specific styles.
- Existing in-progress branch edits may overlap; mitigate by editing only targeted files and preserving unrelated logic.
