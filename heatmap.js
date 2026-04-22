function formatDateLabel(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function buildBoard(data) {
  const { month_labels: monthLabels, weeks, day_labels: dayLabels } = data;
  const board = el("div", "heatmap-board-inner");
  if (!weeks || weeks.length === 0) return board;

  const byCol = new Map();
  (monthLabels || []).forEach((m) => byCol.set(m.column, m.month));

  const header = el("div", "heatmap-month-row");
  header.appendChild(el("div", "heatmap-corner", ""));
  for (let c = 0; c < weeks.length; c += 1) {
    const cell = el("div", "heatmap-month-cell", byCol.get(c) || "\u00a0");
    header.appendChild(cell);
  }
  board.appendChild(header);

  for (let r = 0; r < 7; r += 1) {
    const row = el("div", "heatmap-day-row");
    const label = el("div", "heatmap-y-label", dayLabels[r] || "");
    row.appendChild(label);
    for (let c = 0; c < weeks.length; c += 1) {
      const day = weeks[c].days[r];
      const count = day.count;
      const level = day.level;
      const cell = el("button", `heatmap-cell heatmap-cell--level-${level}`);
      cell.type = "button";
      cell.dataset.date = day.date;
      cell.dataset.count = String(count);
      const tip = count === 0
        ? `${formatDateLabel(day.date)} — no completions`
        : `${formatDateLabel(day.date)} — ${count} task${count === 1 ? "" : "s"} completed`;
      cell.title = tip;
      cell.setAttribute("aria-label", tip);
      row.appendChild(cell);
    }
    board.appendChild(row);
  }

  return board;
}

async function init() {
  const errEl = document.getElementById("heatmapError");
  const boardEl = document.getElementById("heatmapBoard");
  const streak = document.getElementById("statCurrentStreak");
  const longest = document.getElementById("statLongestStreak");
  const total = document.getElementById("statTotal");

  try {
    const res = await fetch("/api/analytics/heatmap");
    if (!res.ok) throw new Error(res.statusText || "Request failed");
    const data = await res.json();

    const s = data.summary;
    streak.textContent = s.current_streak_days;
    longest.textContent = s.longest_streak_days;
    total.textContent = s.total_completions;

    boardEl.replaceChildren(buildBoard(data));
    errEl.hidden = true;
  } catch {
    errEl.textContent = "Could not load activity data. Please try again.";
    errEl.hidden = false;
  }
}

document.addEventListener("DOMContentLoaded", init);
