document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("heatmapGrid");
  const monthAxis = document.getElementById("heatmapMonthAxis");
  const tooltip = document.getElementById("heatmapTooltip");
  const currentStreakEl = document.getElementById("currentStreak");
  const longestStreakEl = document.getElementById("longestStreak");
  const totalCompletionsEl = document.getElementById("totalCompletions");

  function formatDateLabel(dateValue) {
    const date = new Date(`${dateValue}T12:00:00`);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function showTooltip(cell, content) {
    tooltip.textContent = content;
    tooltip.classList.remove("hidden");
    const rect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const x = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    const y = rect.top - tooltipRect.height - 8;
    tooltip.style.left = `${Math.max(8, x)}px`;
    tooltip.style.top = `${Math.max(8, y)}px`;
  }

  function hideTooltip() {
    tooltip.classList.add("hidden");
  }

  function renderMonthLabels(weeks, monthLabels) {
    monthAxis.innerHTML = "";
    monthAxis.style.gridTemplateColumns = `repeat(${weeks}, minmax(0, 1fr))`;
    monthLabels.forEach((month) => {
      const label = document.createElement("span");
      label.textContent = month.label;
      label.style.gridColumn = `${month.week_index + 1} / span 1`;
      monthAxis.appendChild(label);
    });
  }

  function renderCells(data) {
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${data.weeks}, minmax(0, 1fr))`;
    data.cells.forEach((cell) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `heatmap-cell intensity-${cell.intensity_level}`;
      button.style.gridColumn = `${cell.week_index + 1} / span 1`;
      button.style.gridRow = `${cell.day_index + 1} / span 1`;
      button.setAttribute("role", "gridcell");
      button.setAttribute(
        "aria-label",
        `${formatDateLabel(cell.date)}: ${cell.count} completed task${cell.count === 1 ? "" : "s"}`
      );

      const tooltipText = `${formatDateLabel(cell.date)}: ${cell.count} completed`;
      button.addEventListener("mouseenter", () => showTooltip(button, tooltipText));
      button.addEventListener("focus", () => showTooltip(button, tooltipText));
      button.addEventListener("mouseleave", hideTooltip);
      button.addEventListener("blur", hideTooltip);

      grid.appendChild(button);
    });
  }

  function updateSummary(summary) {
    currentStreakEl.textContent = summary.current_streak;
    longestStreakEl.textContent = summary.longest_streak;
    totalCompletionsEl.textContent = summary.total_completions;
  }

  async function loadHeatmap() {
    try {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Heatmap request failed: ${response.status}`);
      }
      const data = await response.json();
      updateSummary(data.summary);
      renderMonthLabels(data.weeks, data.month_labels);
      renderCells(data);
    } catch (error) {
      console.error(error);
      tooltip.classList.add("hidden");
      const fallback = document.createElement("p");
      fallback.className = "heatmap-error";
      fallback.textContent = "Unable to load heatmap data right now.";
      grid.innerHTML = "";
      grid.appendChild(fallback);
    }
  }

  loadHeatmap();
});
