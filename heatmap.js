const HeatmapPage = (() => {
  const refs = {
    currentStreakValue: document.getElementById("currentStreakValue"),
    longestStreakValue: document.getElementById("longestStreakValue"),
    totalCompletionsValue: document.getElementById("totalCompletionsValue"),
    monthLabels: document.getElementById("heatmapMonthLabels"),
    grid: document.getElementById("heatmapGrid"),
    tooltip: document.getElementById("heatmapTooltip"),
  };

  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  async function init() {
    try {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      renderSummary(payload.summary || {});
      renderMonthLabels(payload.month_labels || [], payload.weeks || []);
      renderGrid(payload.weeks || []);
    } catch (error) {
      refs.grid.innerHTML = "";
      refs.grid.textContent = "Unable to load heatmap data.";
      refs.grid.style.display = "block";
      refs.grid.style.color = "var(--fg-secondary)";
      refs.grid.style.padding = "12px";
      refs.grid.style.minHeight = "64px";
      // Keep details in console for local debugging.
      console.error("Heatmap load failed", error);
    }
  }

  function renderSummary(summary) {
    refs.currentStreakValue.textContent = Number(summary.current_streak_days || 0);
    refs.longestStreakValue.textContent = Number(summary.longest_streak_days || 0);
    refs.totalCompletionsValue.textContent = Number(summary.total_completions || 0);
  }

  function renderMonthLabels(monthLabels, weeks) {
    refs.monthLabels.innerHTML = "";

    const totalWeeks = Math.max(weeks.length || 0, 12);
    refs.monthLabels.style.gridTemplateColumns = `repeat(${totalWeeks}, minmax(0, 1fr))`;

    monthLabels.forEach((label) => {
      const el = document.createElement("span");
      el.className = "heatmap-month-label";
      el.textContent = label.month;
      el.style.gridColumn = String((label.column || 0) + 1);
      refs.monthLabels.appendChild(el);
    });
  }

  function renderGrid(weeks) {
    refs.grid.innerHTML = "";
    refs.grid.style.display = "grid";
    refs.grid.style.padding = "";
    refs.grid.style.color = "";
    refs.grid.style.minHeight = "";

    const totalWeeks = Math.max(weeks.length || 0, 12);
    refs.grid.style.gridTemplateColumns = `repeat(${totalWeeks}, minmax(0, 1fr))`;

    weeks.forEach((week, weekIndex) => {
      (week.days || []).forEach((day, dayIndex) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `heatmap-cell heatmap-level-${Number(day.level || 0)}`;
        cell.style.gridColumn = String(weekIndex + 1);
        cell.style.gridRow = String(dayIndex + 1);
        cell.dataset.date = day.date;
        cell.dataset.count = String(day.count || 0);
        cell.setAttribute("aria-label", `${day.count || 0} completed on ${formatDate(day.date)}`);
        cell.addEventListener("mouseenter", handleCellHover);
        cell.addEventListener("mousemove", handleCellHover);
        cell.addEventListener("focus", handleCellFocus);
        cell.addEventListener("mouseleave", hideTooltip);
        cell.addEventListener("blur", hideTooltip);
        refs.grid.appendChild(cell);
      });
    });
  }

  function formatDate(isoDate) {
    const date = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return isoDate || "Unknown date";
    }
    return dayFormatter.format(date);
  }

  function tooltipText(cell) {
    const count = Number(cell.dataset.count || 0);
    const date = formatDate(cell.dataset.date);
    const noun = count === 1 ? "task" : "tasks";
    return `${count} ${noun} completed on ${date}`;
  }

  function showTooltipAt(x, y, text) {
    refs.tooltip.textContent = text;
    refs.tooltip.classList.add("visible");
    refs.tooltip.setAttribute("aria-hidden", "false");

    const viewportPadding = 12;
    const rect = refs.tooltip.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - viewportPadding;
    const maxTop = window.innerHeight - rect.height - viewportPadding;
    const left = Math.max(viewportPadding, Math.min(x + 10, maxLeft));
    const top = Math.max(viewportPadding, Math.min(y - rect.height - 10, maxTop));

    refs.tooltip.style.left = `${left}px`;
    refs.tooltip.style.top = `${top}px`;
  }

  function handleCellHover(event) {
    const cell = event.currentTarget;
    showTooltipAt(event.clientX, event.clientY, tooltipText(cell));
  }

  function handleCellFocus(event) {
    const cell = event.currentTarget;
    const rect = cell.getBoundingClientRect();
    showTooltipAt(rect.right, rect.top, tooltipText(cell));
  }

  function hideTooltip() {
    refs.tooltip.classList.remove("visible");
    refs.tooltip.setAttribute("aria-hidden", "true");
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", HeatmapPage.init);
