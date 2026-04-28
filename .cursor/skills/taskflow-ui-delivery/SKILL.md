---
name: taskflow-ui-delivery
description: Delivers full-stack UI features in the Taskflow stack (Flask, SQLite, vanilla JS in app.js, index.html, styles.css). Covers API contracts, PRAGMA migrations, list/board rendering, HTML5 drag-and-drop, optimistic updates, Cursor brand styling, and pytest coverage. Use when adding or changing Taskflow pages, task UI, focus strip, modals, filters, or any feature that touches server.py and the static front end together.
---

# Taskflow UI feature delivery

## Stack map

| Layer | File(s) |
|-------|---------|
| Routes + DB | [server.py](server.py) |
| Markup | [index.html](index.html) (Tasks), [analytics.html](analytics.html) where relevant |
| Behavior | [app.js](app.js) |
| Tokens / layout | [styles.css](styles.css) (use existing `:root` vars; accent `#f54e00`) |
| Tests | [tests/test_app.py](tests/test_app.py), [tests/conftest.py](tests/conftest.py) |

## Delivery order

1. **Contract** — Decide JSON fields, query params, and HTTP methods. List new or changed endpoints.
2. **Database** — In `init_db()` `CREATE TABLE`, add new columns with defaults. In `migrate_add_columns()`, `PRAGMA table_info`, then `ALTER TABLE ... ADD COLUMN` only when missing (same pattern as `created_at` / `completed_at`).
3. **Server** — Implement handlers. Add small **normalizers** (e.g. priority, booleans) instead of duplicating coercion. Register **specific routes before parametric ones** (e.g. `POST /api/tasks/clear-focus` before `PUT /api/tasks/<int:id>`) so paths are not swallowed by converters.
4. **Tests** — **Every new route** gets at least one test in `test_app.py` (workspace rule). Use the `client` fixture; DB is temp per test via `conftest.py`.
5. **HTML** — Add regions with stable `id`s / `data-*` hooks for JS; keep semantics (`aria-label`, `role` where appropriate).
6. **JS** — Extend `TaskAPI` with one method per endpoint. Keep **one `loadTasks()` (or equivalent) path**; if a sidebar or strip must show data **across filters**, fetch the superset (e.g. all tasks) and **filter in the client** for list/board vs global widgets.
7. **CSS** — New UI gets a named section comment in `styles.css`; reuse `.board-column`, `.modal`, `.priority-*`, `.status-*` patterns. Extend the existing `@media (max-width: 520px)` block for small screens instead of one-off breakpoints.
8. **Verify** — Run `python -m pytest tests/test_app.py -v` from repo root.

## Front-end patterns (app.js)

- **State** — Single `state` object; `render()` branches on `state.view` (list vs board) and repaints both when needed.
- **Drag and drop** — Use `e.currentTarget` on the draggable node so inner text nodes do not break `dataset` reads. Share `dragstart` / `dragend` between list `li` and board `article` when behavior matches; normalize `dataset.taskId` (string) and `parseInt(..., 10)`.
- **Drop zones** — `dragover`: `preventDefault()` + `dropEffect`. `dragleave`: remove highlight only if `!container.contains(e.relatedTarget)`. `drop`: `preventDefault` + `stopPropagation` when a nested zone should win.
- **Optimistic UI** — Mutate `state.tasks`, call `render()`, then `await` API; on failure rollback the field and `loadTasks()` + user-visible error (reuse `showErrorFeedback`).

## Styling rules

- Prefer `var(--bg)`, `var(--fg)`, `var(--card)`, `var(--accent)`, `var(--radius)`, etc.
- Empty states: `data-empty="true"` on a container + sibling `.focus-empty` or placeholder pattern already used on the board.

## Anti-patterns for this repo

- Do not add endpoints without tests.
- Do not rely on server-side status filtering alone if another widget must show tasks **outside** the active filter (fetch all, filter client-side).
- Do not put `ALTER` only in `CREATE TABLE` for existing installs — always mirror in `migrate_add_columns`.

## Quick checklist

- [ ] Schema + migration
- [ ] Handlers + route order
- [ ] Tests for new/changed API
- [ ] HTML hooks
- [ ] `TaskAPI` + render + events
- [ ] CSS section + responsive
- [ ] `pytest` green
