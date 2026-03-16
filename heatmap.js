document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("heatmapGrid");
  const monthLabels = document.getElementById("monthLabels");
  const tooltip = document.getElementById("heatmapTooltip");

  try {
    const res = await fetch("/api/analytics/heatmap?weeks=12");
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    renderStats(data.stats);
    renderGrid(data.days, data.max_count);
  } catch (err) {
    grid.textContent = "Failed to load heatmap data.";
  }

  function renderStats(stats) {
    setStatValue("currentStreak", stats.current_streak, "days");
    setStatValue("longestStreak", stats.longest_streak, "days");
    setStatValue("totalCompletions", stats.total_completions);
  }

  function setStatValue(id, value, unit) {
    const el = document.getElementById(id);
    if (!el) return;
    const numEl = el.querySelector(".heatmap-stat-number");
    const unitEl = el.querySelector(".heatmap-stat-unit");
    if (numEl) numEl.textContent = value;
    if (unitEl) unitEl.textContent = unit || "";
  }

  function getLevel(count, maxCount) {
    if (count === 0) return 0;
    if (maxCount === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.15) return 1;
    if (ratio <= 0.35) return 2;
    if (ratio <= 0.55) return 3;
    if (ratio <= 0.75) return 4;
    return 5;
  }

  function renderGrid(days, maxCount) {
    const weeks = groupByWeek(days);
    const numWeeks = weeks.length;

    grid.style.gridTemplateColumns = `repeat(${numWeeks}, 1fr)`;

    renderMonthLabels(weeks, numWeeks);

    weeks.forEach((week) => {
      const col = document.createElement("div");
      col.className = "heatmap-column";

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dayData = week.find((d) => {
          const date = new Date(d.date + "T00:00:00");
          return date.getDay() === (dayOfWeek + 1) % 7; // Convert Mon=0 to JS day
        });

        const cell = document.createElement("div");
        if (dayData) {
          const level = getLevel(dayData.count, maxCount);
          cell.className = `heatmap-cell heatmap-level-${level}`;
          cell.dataset.date = dayData.date;
          cell.dataset.count = dayData.count;
          cell.addEventListener("mouseenter", showTooltip);
          cell.addEventListener("mouseleave", hideTooltip);
        } else {
          cell.className = "heatmap-cell heatmap-cell-empty";
        }
        col.appendChild(cell);
      }

      grid.appendChild(col);
    });
  }

  function groupByWeek(days) {
    const weeks = [];
    let currentWeek = [];

    days.forEach((day) => {
      const date = new Date(day.date + "T00:00:00");
      const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0

      if (dayOfWeek === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }

  function renderMonthLabels(weeks, numWeeks) {
    monthLabels.style.gridTemplateColumns = `repeat(${numWeeks}, 1fr)`;
    let lastMonth = "";

    weeks.forEach((week) => {
      const label = document.createElement("span");
      label.className = "heatmap-month-label";

      const firstDay = week[0];
      const date = new Date(firstDay.date + "T00:00:00");
      const month = date.toLocaleDateString("en-US", { month: "short" });

      if (month !== lastMonth) {
        label.textContent = month;
        lastMonth = month;
      }

      monthLabels.appendChild(label);
    });
  }

  function showTooltip(e) {
    const cell = e.target;
    const date = cell.dataset.date;
    const count = parseInt(cell.dataset.count, 10);
    const dateStr = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    tooltip.textContent = `${count} task${count !== 1 ? "s" : ""} completed on ${dateStr}`;
    tooltip.classList.add("visible");

    const rect = cell.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
  }
});
