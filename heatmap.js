document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("heatmapGrid");
  const monthLabels = document.getElementById("heatmapMonthLabels");
  const legendCells = document.getElementById("heatmapLegendCells");
  const tooltip = document.getElementById("heatmapTooltip");
  const currentStreakValue = document.getElementById("currentStreakValue");
  const longestStreakValue = document.getElementById("longestStreakValue");
  const totalCompletionsValue = document.getElementById("totalCompletionsValue");

  const LEVELS = [0, 1, 2, 3, 4, 5];

  const friendlyDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  function describeDay(day) {
    const dateText = friendlyDate.format(new Date(`${day.date}T12:00:00`));
    const noun = day.count === 1 ? "task" : "tasks";
    return `${dateText}: ${day.count} ${noun} completed`;
  }

  function showTooltip(cell, text) {
    const rect = cell.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    tooltip.style.top = `${rect.top + window.scrollY - 8}px`;
    tooltip.classList.add("visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
  }

  function updateSummary(summary) {
    currentStreakValue.textContent = summary.current_streak_days;
    longestStreakValue.textContent = summary.longest_streak_days;
    totalCompletionsValue.textContent = summary.total_completions;
  }

  function renderMonthLabels(labels) {
    monthLabels.innerHTML = "";
    labels.forEach((label) => {
      const node = document.createElement("span");
      node.className = "heatmap-month";
      node.style.gridColumn = `${label.column + 1}`;
      node.textContent = label.month;
      monthLabels.appendChild(node);
    });
  }

  function renderGrid(weeks) {
    grid.innerHTML = "";
    weeks.forEach((week, columnIndex) => {
      week.days.forEach((day, rowIndex) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "heatmap-cell";
        cell.dataset.level = day.level;
        cell.style.gridColumn = `${columnIndex + 1}`;
        cell.style.gridRow = `${rowIndex + 1}`;
        const description = describeDay(day);
        cell.setAttribute("aria-label", description);
        cell.addEventListener("mouseenter", () => showTooltip(cell, description));
        cell.addEventListener("focus", () => showTooltip(cell, description));
        cell.addEventListener("mouseleave", hideTooltip);
        cell.addEventListener("blur", hideTooltip);
        grid.appendChild(cell);
      });
    });
  }

  function renderLegend(levels) {
    legendCells.innerHTML = "";
    levels.forEach((level) => {
      const node = document.createElement("span");
      node.className = "heatmap-legend-cell";
      node.dataset.level = level;
      legendCells.appendChild(node);
    });
  }

  function renderError() {
    grid.innerHTML = "";
    const message = document.createElement("p");
    message.className = "heatmap-error";
    message.textContent = "Could not load activity data. Please refresh to try again.";
    grid.appendChild(message);
  }

  async function loadHeatmap() {
    try {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Heatmap request failed with status ${response.status}`);
      }
      const payload = await response.json();
      updateSummary(payload.summary);
      renderMonthLabels(payload.month_labels || []);
      renderGrid(payload.weeks || []);
      renderLegend(payload.legend_levels || LEVELS);
    } catch (error) {
      console.error(error);
      renderError();
    }
  }

  loadHeatmap();
});
