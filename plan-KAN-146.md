# Implementation Plan: KAN-146 Add activity heatmap

## Scope
- In scope: new `Heatmap` page linked from top navigation, pixel-accurate rendering of provided Figma node, tooltip interactions, and API-backed summary/grid data from task completion timestamps.
- In scope: `GET /api/analytics/heatmap` verification and tests for page and endpoint.
- Out of scope: changes to existing analytics chart behavior, data warehouse integrations, or unrelated in-progress files.

## Design Reference
- Figma: https://www.figma.com/design/oTsNM9L38fv9uDNLwK0K9l/Task--Management--Web-App-Design--Community-?node-id=3457-32&m=dev
- Intent: clean white card, 12-week matrix with 7 rows (Mon-Sun), subtle labels, accent-based intensity ramp, summary metrics above grid, and compact "Less/More" legend.

## Approach
- Reuse existing backend heatmap aggregation helpers in `server.py` and keep the API contract stable.
- Recreate `heatmap.html` and `heatmap.js` to render the heatmap from API response (`weeks`, `month_labels`, `summary`) with precise DOM structure for styling parity.
- Keep styling in `styles.css` heatmap section aligned with Figma dimensions (cell size, spacing, padding, label typography, border radii).
- Ensure top nav includes Heatmap on both existing pages and the heatmap page marks itself active.

## File Changes
- `server.py` - add `/heatmap` page route (if missing), keep `/api/analytics/heatmap` contract consistent.
- `index.html` - add Heatmap nav link.
- `analytics.html` - add Heatmap nav link.
- `heatmap.html` - add full heatmap page markup.
- `heatmap.js` - fetch and render summary, month labels, 7x12 grid, legend, and tooltip.
- `styles.css` - tune heatmap styles for pixel fit.
- `tests/test_app.py` - add `/heatmap` and `/api/analytics/heatmap` assertions.

## Steps
1. Recreate missing page/script files for heatmap rendering.
2. Update navigation and backend route linkage for `/heatmap`.
3. Tune layout/styling to mirror Figma spacing and intensity scale.
4. Add tests for page availability and API response shape.
5. Run lint/pytest verification and fix any regressions.

## Edge Cases
- No completed tasks in range should still render full grid with empty cells and valid labels.
- Timezone boundaries should not break streak calculations or date labels.
- Tooltip content should handle singular/plural task wording.

## Test Plan
- [ ] `GET /heatmap` returns HTTP 200
- [ ] `GET /api/analytics/heatmap` returns HTTP 200 with expected keys
- [ ] Heatmap API returns `weeks` with 12 columns and 7 rows per week
- [ ] Manual check: nav includes Heatmap and active state is correct
- [ ] Manual check: visual parity against provided Figma screenshot

## Risks
- Existing in-progress branch changes could overlap; mitigate by committing only KAN-146-specific files.
- Pixel-perfect differences across font rendering may vary slightly by platform; mitigate with exact spacing and token values.
