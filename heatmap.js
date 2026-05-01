document.addEventListener("DOMContentLoaded", () => {
  const monthLabelsEl = document.getElementById("heatmapMonthLabels");
  const dayLabelsEl = document.getElementById("heatmapDayLabels");
  const gridEl = document.getElementById("heatmapGrid");
  const legendEl = document.getElementById("heatmapLegendCells");
  const tooltipEl = document.getElementById("heatmapTooltip");

  const currentStreakEl = document.getElementById("currentStreak");
  const longestStreakEl = document.getElementById("longestStreak");
  const totalCompletionsEl = document.getElementById("totalCompletions");

  const HeatmapAPI = {
    async getHeatmap() {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Failed to fetch heatmap data: ${response.statusText}`);
      }
      return response.json();
    }
  };

  function formatUtcDate(dateString) {
    const date = new Date(`${dateString}T00:00:00Z`);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function setStreakStat(target, value) {
    target.innerHTML = `${value} <span class="heatmap-stat-unit">days</span>`;
  }

  function renderSummary(summary) {
    setStreakStat(currentStreakEl, summary.current_streak_days || 0);
    setStreakStat(longestStreakEl, summary.longest_streak_days || 0);
    totalCompletionsEl.textContent = String(summary.total_completions || 0);
  }

  function renderMonthLabels(monthLabels, columnCount) {
    monthLabelsEl.innerHTML = "";
    const monthByColumn = new Map(monthLabels.map((label) => [label.column, label.month]));
    for (let i = 0; i < columnCount; i += 1) {
      const monthCell = document.createElement("span");
      monthCell.className = "heatmap-month-label";
      monthCell.textContent = monthByColumn.get(i) || "";
      monthLabelsEl.appendChild(monthCell);
    }
  }

  function renderDayLabels(labels) {
    dayLabelsEl.innerHTML = "";
    labels.forEach((label) => {
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      dayLabelsEl.appendChild(labelEl);
    });
  }

  function showTooltip(event, cell) {
    const text = `${formatUtcDate(cell.date)}\n${cell.count} task${cell.count === 1 ? "" : "s"} completed`;
    tooltipEl.textContent = text;
    tooltipEl.classList.add("visible");
    tooltipEl.style.left = `${event.pageX + 12}px`;
    tooltipEl.style.top = `${event.pageY - 34}px`;
  }

  function hideTooltip() {
    tooltipEl.classList.remove("visible");
  }

  function renderLegend(levels) {
    legendEl.innerHTML = "";
    levels.forEach((level) => {
      const swatch = document.createElement("span");
      swatch.className = `heatmap-legend-cell heatmap-level-${level}`;
      swatch.setAttribute("aria-hidden", "true");
      legendEl.appendChild(swatch);
    });
  }

  function renderGrid(weeks) {
    gridEl.innerHTML = "";
    weeks.forEach((week) => {
      week.days.forEach((cell) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `heatmap-cell heatmap-level-${cell.level}`;
        button.dataset.date = cell.date;
        button.dataset.count = String(cell.count);
        button.setAttribute("aria-label", `${formatUtcDate(cell.date)}: ${cell.count} tasks completed`);

        button.addEventListener("mouseenter", (event) => showTooltip(event, cell));
        button.addEventListener("mousemove", (event) => showTooltip(event, cell));
        button.addEventListener("mouseleave", hideTooltip);
        button.addEventListener("focus", (event) => showTooltip(event, cell));
        button.addEventListener("blur", hideTooltip);

        gridEl.appendChild(button);
      });
    });
  }

  function showError(message) {
    const error = document.createElement("div");
    error.className = "error-feedback";
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 5000);
  }

  async function initHeatmap() {
    try {
      const data = await HeatmapAPI.getHeatmap();
      renderSummary(data.summary || {});
      renderMonthLabels(data.month_labels || [], (data.weeks || []).length || 12);
      renderDayLabels(data.day_labels || ["Mon", "Wed", "Fri", "Sun"]);
      renderLegend(data.legend_levels || [0, 1, 2, 3, 4, 5]);
      renderGrid(data.weeks || []);
    } catch (error) {
      console.error("Failed to initialize heatmap:", error);
      showError("Failed to load activity heatmap. Please refresh the page.");
    }
  }

  initHeatmap();
});
