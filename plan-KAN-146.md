# Implementation Plan: KAN-146 Activity Heatmap

> Notion was unavailable in this environment (the Atlassian and Notion MCP servers
> both require authentication), so this plan is checked in alongside the code
> instead of being published to Notion.

## Scope

In scope:

- Dedicated Heatmap page at `/heatmap`, reachable from the top navigation.
- 12-week completion grid rendered from real `tasks.completed_at` data via
  `GET /api/analytics/heatmap`.
- Summary stats (current streak, longest streak, total completions), month labels,
  day labels, intensity legend, and hover/focus tooltips.
- Pixel-accurate reproduction of the supplied Figma mock.
- pytest coverage for the page route and the heatmap endpoint.

Out of scope:

- Reworking the existing analytics dashboard or its Chart.js charts.
- Cohort or date-range filtering for the heatmap.
- Introducing a charting dependency for the grid.

## Design Reference

Figma: https://www.figma.com/design/oTsNM9L38fv9uDNLwK0K9l/Task--Management--Web-App-Design--Community-?node-id=3457-32&m=dev

Measured spec (1x, taken off the supplied mock):

| Element | Value |
|---------|-------|
| Frame width / padding | 940px / 48px horizontal |
| Title | 20px, weight 700, `--fg` |
| Stat label | 12px, `--fg-secondary`, 16px line box |
| Stat value | 26px weight 700; unit (`days`) 13px weight 500 |
| Stat row gap | 28px |
| Card | white, 1px hairline border, 12px radius, 20px padding |
| Day-label gutter | 30px label column + 6px gap = 36px |
| Cell | 60x60px, 6px radius, 4px gap (64px pitch) |
| Grid | 12 columns x 7 rows = 764x444px |
| Month labels | 12px, left-aligned to the first column of each month |
| Day labels | `Mon/Wed/Fri/Sun`, 11px, 14px line box, bottom-anchored in the gutter |
| Legend | `Less`, six 14px swatches (4px gap), `More`; 11px text |

Intensity scale is `--accent` (`#f54e00`) over white at 0.12 / 0.28 / 0.45 / 0.65 / 1.0
alpha, with level 0 drawn as white plus a hairline border.

The mock anchors the `Mon/Wed/Fri/Sun` labels as a tight stack at the bottom of the
gutter rather than aligning each label to its row. That is reproduced as drawn.

## Approach

- The backend endpoint and helpers (`_build_heatmap_grid`, `_heatmap_summary`) already
  exist in `server.py`; the page that consumed them was removed in an earlier commit.
  Rebuild the front end against the existing contract rather than reshaping the API.
- Drive geometry from custom properties (`--hm-cell`, `--hm-gap`, `--hm-gutter`) scoped
  to the page so the desktop rendering is exact and the two breakpoints only need to
  re-declare the properties.
- Use px (not rem) inside the heatmap section: `html { font-size: 15px }` would otherwise
  rescale every measurement taken off the mock.
- Extend demo data generation from 8 to 12 weeks so a fresh database fills the whole
  grid instead of leaving the first third empty.

## File Changes

- `heatmap.html` - new page shell (title, stats, card, legend, tooltip host).
- `heatmap.js` - fetch, summary, month labels, grid cells, legend, tooltips.
- `styles.css` - new `Activity Heatmap` section plus `.sr-only`.
- `server.py` - widen demo data to 12 weeks.
- `index.html`, `analytics.html` - Heatmap nav link.
- `tests/test_app.py` - page route and heatmap endpoint coverage.

## Steps

1. Build `heatmap.html` against the existing API contract.
2. Implement rendering and tooltips in `heatmap.js`.
3. Add the CSS section using the measured spec.
4. Widen demo data so all 12 columns carry data.
5. Add nav links on the Tasks and Analytics pages.
6. Add tests; run `python -m pytest tests -v`.
7. Screenshot at the mock's own width and iterate until the geometry matches.

## Edge Cases

- No completed tasks: full 12x7 grid of level-0 cells, zeroed summary.
- Single completion day: `max_count <= 1` maps that day to level 5 so it stays visible.
- Partial current week: the grid always ends on the current week's Sunday, so future
  days render as level 0.
- Narrow viewports: cell/gap/gutter shrink at 900px and 640px; the grid never overflows.

## Test Plan

- [ ] `GET /heatmap` returns 200.
- [ ] `GET /api/analytics/heatmap` returns 12 weeks of 7 days each.
- [ ] Every returned date falls inside the reported range and levels stay within 0-5.
- [ ] Summary fields are present and integral.
- [ ] Month labels reference in-range columns; legend exposes six levels.
- [ ] Visual comparison against the mock at 940px.

## Risks

- `styles.css` is shared with the Tasks and Analytics pages, so all new selectors are
  namespaced under `.heatmap-page` to avoid regressions.
- Font stack differs from Figma's default, so text advance widths differ by a few px
  even when sizes match exactly.
- Streaks are computed in UTC; a local-timezone user near midnight can see a streak
  that differs by one day from their own clock.
