document.addEventListener("DOMContentLoaded", () => {
  const monthLabelsEl = document.getElementById("monthLabels");
  const heatmapGridEl = document.getElementById("heatmapGrid");
  const legendCellsEl = document.getElementById("legendCells");
  const tooltipEl = document.getElementById("heatmapTooltip");
  const currentStreakEl = document.getElementById("currentStreakValue");
  const longestStreakEl = document.getElementById("longestStreakValue");
  const totalCompletionsEl = document.getElementById("totalCompletionsValue");

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  function pluralizeTasks(count) {
    return `${count} task${count === 1 ? "" : "s"} completed`;
  }

  function setSummary(summary) {
    currentStreakEl.textContent = summary.current_streak_days;
    longestStreakEl.textContent = summary.longest_streak_days;
    totalCompletionsEl.textContent = summary.total_completions;
  }

  function renderMonthLabels(monthLabels) {
    monthLabelsEl.innerHTML = "";
    monthLabels.forEach((label) => {
      const month = document.createElement("span");
      month.className = "heatmap-month-label";
      month.style.gridColumnStart = String(label.column + 1);
      month.textContent = label.month;
      monthLabelsEl.appendChild(month);
    });
  }

  function showTooltip(content, x, y) {
    tooltipEl.textContent = content;
    tooltipEl.classList.add("visible");

    const maxLeft = window.innerWidth - tooltipEl.offsetWidth - 8;
    const maxTop = window.innerHeight - tooltipEl.offsetHeight - 8;
    const left = Math.min(Math.max(8, x + 12), maxLeft);
    const top = Math.min(Math.max(8, y + 12), maxTop);

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltipEl.classList.remove("visible");
  }

  function addCellInteractions(cell) {
    const dateText = dateFormatter.format(new Date(cell.dataset.date));
    const count = Number(cell.dataset.count);
    const tooltipText = `${dateText} - ${pluralizeTasks(count)}`;

    cell.addEventListener("mouseenter", (event) => {
      showTooltip(tooltipText, event.clientX, event.clientY);
    });

    cell.addEventListener("mousemove", (event) => {
      showTooltip(tooltipText, event.clientX, event.clientY);
    });

    cell.addEventListener("mouseleave", hideTooltip);

    cell.addEventListener("focus", () => {
      const rect = cell.getBoundingClientRect();
      showTooltip(tooltipText, rect.left + rect.width / 2, rect.top - 20);
    });

    cell.addEventListener("blur", hideTooltip);
  }

  function renderGrid(weeks) {
    heatmapGridEl.innerHTML = "";
    weeks.forEach((week, weekIndex) => {
      week.days.forEach((day, dayIndex) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `heatmap-cell heatmap-level-${day.level}`;
        cell.style.gridColumnStart = String(weekIndex + 1);
        cell.style.gridRowStart = String(dayIndex + 1);
        cell.dataset.date = day.date;
        cell.dataset.count = String(day.count);
        cell.setAttribute(
          "aria-label",
          `${dateFormatter.format(new Date(day.date))}: ${pluralizeTasks(day.count)}`
        );
        addCellInteractions(cell);
        heatmapGridEl.appendChild(cell);
      });
    });
  }

  function renderLegend(levels) {
    legendCellsEl.innerHTML = "";
    levels.forEach((level) => {
      const swatch = document.createElement("span");
      swatch.className = `heatmap-legend-cell heatmap-level-${level}`;
      legendCellsEl.appendChild(swatch);
    });
  }

  async function loadHeatmap() {
    try {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Failed to fetch heatmap: ${response.statusText}`);
      }
      const payload = await response.json();
      setSummary(payload.summary);
      renderMonthLabels(payload.month_labels);
      renderGrid(payload.weeks);
      renderLegend(payload.legend_levels);
    } catch (error) {
      console.error(error);
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-feedback";
      errorDiv.textContent = "Failed to load heatmap data. Please refresh the page.";
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }

  loadHeatmap();
});
