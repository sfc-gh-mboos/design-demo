document.addEventListener("DOMContentLoaded", () => {
  const DAYS_TO_SHOW_LABEL = new Set(["Mon", "Wed", "Fri", "Sun"]);
  const currentStreakEl = document.getElementById("heatmapCurrentStreak");
  const longestStreakEl = document.getElementById("heatmapLongestStreak");
  const totalCompletionsEl = document.getElementById("heatmapTotalCompletions");
  const monthRowEl = document.getElementById("heatmapMonthRow");
  const rowsEl = document.getElementById("heatmapRows");
  const legendEl = document.getElementById("heatmapLegendCells");
  const errorEl = document.getElementById("heatmapError");

  function formatDate(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function renderSummary(summary) {
    currentStreakEl.textContent = summary.current_streak_days;
    longestStreakEl.textContent = summary.longest_streak_days;
    totalCompletionsEl.textContent = summary.total_completions;
  }

  function renderMonthRow(labels) {
    monthRowEl.textContent = "";
    const corner = document.createElement("div");
    corner.className = "heatmap-corner";
    monthRowEl.appendChild(corner);

    labels.forEach((label) => {
      const cell = document.createElement("div");
      cell.className = "heatmap-month-cell";
      cell.textContent = label;
      monthRowEl.appendChild(cell);
    });
  }

  function renderRows(rows) {
    rowsEl.textContent = "";

    rows.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "heatmap-day-row";

      const label = document.createElement("div");
      label.className = "heatmap-y-label";
      label.textContent = DAYS_TO_SHOW_LABEL.has(row.label) ? row.label : "";
      rowEl.appendChild(label);

      row.cells.forEach((cell) => {
        const cellEl = document.createElement("button");
        cellEl.type = "button";
        cellEl.className = `heatmap-cell heatmap-cell--level-${cell.level}`;
        cellEl.setAttribute("aria-label", `${formatDate(cell.date)}: ${cell.count} completions`);
        cellEl.title = `${formatDate(cell.date)}: ${cell.count} completion${cell.count === 1 ? "" : "s"}`;
        rowEl.appendChild(cellEl);
      });

      rowsEl.appendChild(rowEl);
    });
  }

  function renderLegend(levels) {
    legendEl.textContent = "";
    levels.forEach((level) => {
      const swatch = document.createElement("span");
      swatch.className = `heatmap-cell heatmap-cell--level-${level}`;
      swatch.setAttribute("aria-hidden", "true");
      legendEl.appendChild(swatch);
    });
  }

  function setError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  async function loadHeatmap() {
    try {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Failed to load heatmap (${response.status})`);
      }

      const payload = await response.json();
      renderSummary(payload.summary);
      renderMonthRow(payload.month_labels);
      renderRows(payload.rows);
      renderLegend(payload.legend_levels || [0, 1, 2, 3, 4, 5]);
      errorEl.hidden = true;
    } catch (_error) {
      setError("Unable to load heatmap right now.");
    }
  }

  loadHeatmap();
});
