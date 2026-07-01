# Implementation Plan: KAN-201 Add weekly recap

## Scope

**In scope:**
- New `GET /api/analytics/weekly-recap` endpoint aggregating last 7 calendar days from `tasks` table
- New `GET /recap` page with stat cards, top category highlight, daily breakdown bars
- Nav link on Tasks, Analytics, and Recap pages
- Pytest coverage for page route and API payload shape

**Out of scope:**
- Database schema changes
- Chart.js or external charting libraries
- heatmap.html restoration (route exists but file removed from master)

## Approach

Query SQLite `tasks` table for `created_at`, `completed_at`, `status`, `category`, and `priority` over a rolling 7-day window (today minus 6 days through today). Reuse existing analytics page layout patterns and heatmap-style summary card styling via CSS variables.

## File Changes

- `server.py` — `_get_weekly_recap()` helper, API route, page route
- `recap.html` — new page markup
- `recap.js` — fetch API, render stats and daily bars
- `styles.css` — recap-specific styles
- `index.html`, `analytics.html` — add Heatmap + Recap nav links
- `tests/test_app.py` — page and API tests

## Edge Cases

- No activity in range: show zeros with friendly empty-state message
- No completions for top category: show placeholder text
- Division by zero for completion rate when created=0

## Test Plan

- [ ] `GET /recap` returns 200
- [ ] `GET /api/analytics/weekly-recap` returns expected JSON shape
- [ ] Full pytest suite passes

## Risks

- heatmap.html missing on master — nav link added but page may 404 until restored separately
