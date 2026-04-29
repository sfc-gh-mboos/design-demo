---
name: delivery-forecasting
description: Defines the canonical delivery forecast model (trailing completion velocity, backlog drain, ETA, horizon capping) and API/UI contracts for a forecasting portal. Use when building or changing forecast APIs, timeline charts, backlog ETAs, velocity displays, or analytics that project task delivery.
---

# Delivery forecasting

## Definitions (use consistently)

- **Completed (per day)**: count of items finished that calendar day (e.g. status moved to done, or equivalent domain event).
- **Backlog remaining (end of day)**: work not yet done that still counts toward delivery pressure (e.g. todo + in-progress; adjust labels to your domain but keep the split: *stock* backlog vs *flow* completions).
- **History**: one row per calendar day in the selected range, ordered oldest → newest.
- **Forecast**: synthetic future rows after the last history day, same grain (usually daily).

## Core algorithm (agents must preserve this behavior)

Default parameters unless product specifies otherwise:

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `velocity_window_days` | 7 | Trailing window for average completions/day |
| `max_forecast_days` | 120 | Stop projecting after this many future days |

1. **Build `history`** from source time series (aligned to calendar days in range):
   - `date` (ISO `YYYY-MM-DD`)
   - `completed` (non-negative integer)
   - `backlog_remaining` (non-negative integer)

2. **Compute velocity**  
   `window = min(velocity_window_days, len(history))`  
   If `window == 0`, velocity = `0`.  
   Else velocity = `mean(last window days of history[].completed)` (float).

3. **Expose `velocity_basis`** (for UI copy and audits):
   - `window_days`: same as `velocity_window_days`
   - `avg_completed_per_day`: velocity rounded for display (e.g. 2 decimals)

4. **Start forecast from last history day**
   - `last_backlog = history[-1].backlog_remaining`
   - `last_date` = parse `history[-1].date`

5. **Branch outcomes**
   - If `last_backlog <= 0`: set `estimated_delivery_date = history[-1].date`, `forecast = []`, `forecast_truncated = false`.
   - Else if `velocity <= 0`: set `estimated_delivery_date = null`, `forecast = []`, `forecast_truncated = false` (cannot responsibly predict drain).
   - Else simulate day-by-day:
     - Start `cur_date = last_date`, `cur_backlog = float(last_backlog)`, `forecast = []`.
     - Loop while `len(forecast) < max_forecast_days`:
       - `cur_date += 1 day`
       - `completed_today = min(velocity, cur_backlog)`
       - `cur_backlog -= completed_today`
       - Append `{ date: cur_date ISO, projected_completed: round(completed_today, 2), projected_backlog_remaining: floor(max(0, cur_backlog)) }` (or equivalent integer rule documented in code).
       - If backlog effectively zero (`cur_backlog < epsilon`): set `estimated_delivery_date = cur_date`, **break**.
     - If loop exits without clearing backlog: set `forecast_truncated = true` when `cur_backlog > epsilon`; else `false`.

6. **Never silently extend** beyond `max_forecast_days`; surface truncation via `forecast_truncated` and UI copy.

## API response contract

Any “delivery timeline” or portal forecast payload should include:

```json
{
  "history": [{ "date": "", "completed": 0, "backlog_remaining": 0 }],
  "forecast": [{ "date": "", "projected_completed": 0, "projected_backlog_remaining": 0 }],
  "estimated_delivery_date": null,
  "forecast_truncated": false,
  "velocity_basis": { "window_days": 7, "avg_completed_per_day": 0.0 }
}
```

- **`estimated_delivery_date`**: ISO date string when backlog hits zero; `null` if unknown or not forecastable.
- **`forecast_truncated`**: `true` when forecast stopped at horizon with backlog still > 0.

Prefer **extending an existing trends/summary endpoint** over many one-off routes if the portal already aggregates analytics—keep one source of truth.

## Portal UI expectations

- **Chart**: line chart (or equivalent) with:
  - **Actual** series: historical `completed` and `backlog_remaining` (solid).
  - **Forecast** series: `projected_*` only for future segment (dashed); omit forecast datasets if `forecast` is empty.
  - Prefer **dual axis** when backlog scale differs materially from per-day completions.
- **Header/meta** near the chart:
  - If ETA exists: human-readable “Est. backlog cleared: …” (locale-aware).
  - If already clear: “Backlog clear as of …” when no future forecast rows.
  - If `forecast_truncated`: explain horizon (e.g. “Beyond N-day horizon (~X tasks remaining)”).
  - If not forecastable: **“Forecast unavailable”** (do not invent an ETA).
- **Subtitle**: show trailing average line, e.g. “Based on trailing {window_days}-day avg: {avg} completions/day”.
- **Tooltips**: full date + rounded values; hide null dataset points from tooltips.

## Agent checklist when changing this system

- [ ] History and forecast use the same day grain and monotonic dates.
- [ ] Velocity uses **only** trailing history (no peeking at future realized data).
- [ ] Empty history → empty forecast, `estimated_delivery_date` null, clear empty state in UI.
- [ ] Cohort/date filters recompute the entire series (no stale forecast).
- [ ] Add or update tests that assert the presence and shape of `delivery_timeline` (or equivalent) on the trends/forecast API.

## Optional reference

This repo’s reference implementation lives in `server.py` (`_build_delivery_timeline`) and `analytics.js` (`renderDeliveryTimelineChart`). Read those files when aligning code with this skill.
