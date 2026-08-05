document.addEventListener("DOMContentLoaded", () => {
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const monthsRow = document.getElementById("heatmapMonths");
  const dayLabelsColumn = document.getElementById("heatmapDayLabels");
  const grid = document.getElementById("heatmapGrid");
  const legendScale = document.getElementById("heatmapLegend");
  const tooltip = document.getElementById("heatmapTooltip");
  const statCurrentStreak = document.getElementById("statCurrentStreak");
  const statLongestStreak = document.getElementById("statLongestStreak");
  const statTotalCompletions = document.getElementById("statTotalCompletions");

  const HeatmapAPI = {
    async getHeatmap() {
      const res = await fetch("/api/analytics/heatmap");
      if (!res.ok) {
        throw new Error(`Failed to fetch heatmap: ${res.statusText}`);
      }
      return res.json();
    },
  };

  /* ISO dates are calendar days, so build them locally to avoid a UTC shift. */
  function parseISODate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDate(iso) {
    const date = parseISODate(iso);
    return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function describeCell(day) {
    const noun = day.count === 1 ? "task" : "tasks";
    return `${day.count} ${noun} completed on ${formatDate(day.date)}`;
  }

  function renderStats(summary) {
    statCurrentStreak.textContent = summary.current_streak_days;
    statLongestStreak.textContent = summary.longest_streak_days;
    statTotalCompletions.textContent = summary.total_completions;
  }

  function renderMonthLabels(monthLabels, weekCount) {
    monthsRow.replaceChildren();
    monthsRow.style.setProperty("--heat-columns", weekCount);
    monthLabels.forEach((label) => {
      const span = document.createElement("span");
      span.className = "heatmap-month";
      /* Column 1 is the day-label gutter, so week N sits in column N + 2. */
      span.style.gridColumn = String(label.column + 2);
      span.textContent = label.month;
      monthsRow.appendChild(span);
    });
  }

  function renderDayLabels(dayLabels) {
    dayLabelsColumn.replaceChildren();
    /* The API sends every other weekday (Mon, Wed, Fri, Sun) for legibility. */
    dayLabels.forEach((label, index) => {
      const span = document.createElement("span");
      span.className = "heatmap-daylabel";
      span.style.gridRow = String(index * 2 + 1);
      span.textContent = label;
      dayLabelsColumn.appendChild(span);
    });
  }

  function renderGrid(weeks) {
    grid.replaceChildren();
    grid.style.setProperty("--heat-columns", weeks.length);
    weeks.forEach((week) => {
      week.days.forEach((day) => {
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";
        cell.setAttribute("role", "listitem");
        cell.dataset.level = String(day.level);
        cell.dataset.date = day.date;
        cell.dataset.count = String(day.count);
        cell.setAttribute("aria-label", describeCell(day));
        grid.appendChild(cell);
      });
    });
  }

  function renderLegend(levels) {
    legendScale.replaceChildren();
    levels.forEach((level) => {
      const swatch = document.createElement("span");
      swatch.className = "heatmap-legend-swatch";
      swatch.dataset.level = String(level);
      legendScale.appendChild(swatch);
    });
  }

  function showTooltip(cell) {
    const count = Number(cell.dataset.count);
    const noun = count === 1 ? "task" : "tasks";
    tooltip.replaceChildren();

    const countLine = document.createElement("span");
    countLine.className = "heatmap-tooltip-count";
    countLine.textContent = `${count} ${noun} completed`;

    const dateLine = document.createElement("span");
    dateLine.className = "heatmap-tooltip-date";
    dateLine.textContent = formatDate(cell.dataset.date);

    tooltip.append(countLine, dateLine);
    tooltip.hidden = false;

    const cellBox = cell.getBoundingClientRect();
    const tooltipBox = tooltip.getBoundingClientRect();
    const left = cellBox.left + cellBox.width / 2 - tooltipBox.width / 2;
    const top = cellBox.top - tooltipBox.height - 8;
    const maxLeft = document.documentElement.clientWidth - tooltipBox.width - 8;
    tooltip.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function bindTooltip() {
    grid.addEventListener("mouseover", (e) => {
      const cell = e.target.closest(".heatmap-cell");
      if (cell) showTooltip(cell);
    });
    grid.addEventListener("mouseout", (e) => {
      const cell = e.target.closest(".heatmap-cell");
      if (cell && !cell.contains(e.relatedTarget)) hideTooltip();
    });
    /* The grid scrolls horizontally on narrow screens, which does not bubble to window. */
    grid.closest(".heatmap-scroll").addEventListener("scroll", hideTooltip, { passive: true });
    window.addEventListener("scroll", hideTooltip, { passive: true });
  }

  function showErrorFeedback(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-feedback";
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  async function loadHeatmap() {
    try {
      const data = await HeatmapAPI.getHeatmap();
      renderStats(data.summary);
      renderMonthLabels(data.month_labels, data.weeks.length);
      renderDayLabels(data.day_labels);
      renderGrid(data.weeks);
      renderLegend(data.legend_levels);
    } catch (error) {
      console.error("Failed to load heatmap:", error);
      showErrorFeedback("Failed to load activity data. Please refresh the page.");
    }
  }

  bindTooltip();
  loadHeatmap();
});
