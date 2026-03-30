document.addEventListener("DOMContentLoaded", () => {
  const monthLabels = document.getElementById("monthLabels");
  const heatmapCells = document.getElementById("heatmapCells");
  const tooltip = document.getElementById("heatmapTooltip");

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  async function fetchHeatmap() {
    const res = await fetch("/api/analytics/heatmap?weeks=12");
    if (!res.ok) throw new Error("Failed to fetch heatmap data");
    return res.json();
  }

  function renderStats(data) {
    const currentEl = document.querySelector("#statCurrentStreak .heatmap-stat-number");
    const longestEl = document.querySelector("#statLongestStreak .heatmap-stat-number");
    const totalEl = document.querySelector("#statTotalCompletions .heatmap-stat-number");

    currentEl.textContent = data.current_streak;
    longestEl.textContent = data.longest_streak;
    totalEl.textContent = data.total_completions;
  }

  function renderGrid(data) {
    heatmapCells.innerHTML = "";
    monthLabels.innerHTML = "";

    const weeks = data.weeks;
    const monthPositions = {};

    weeks.forEach((week, weekIdx) => {
      const weekStart = new Date(week.week_start + "T00:00:00");
      const monthKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}`;

      if (weekIdx === 0 || !monthPositions[monthKey]) {
        monthPositions[monthKey] = {
          index: weekIdx,
          label: MONTHS[weekStart.getMonth()],
        };
      }
    });

    const totalWeeks = weeks.length;

    Object.values(monthPositions).forEach((m) => {
      const label = document.createElement("span");
      label.className = "heatmap-month-label";
      label.textContent = m.label;
      label.style.left = `${(m.index / totalWeeks) * 100}%`;
      monthLabels.appendChild(label);
    });

    weeks.forEach((week) => {
      const col = document.createElement("div");
      col.className = "heatmap-week-col";

      week.days.forEach((day) => {
        const cell = document.createElement("div");
        const level = day.future ? -1 : day.level;
        cell.className = `heatmap-cell heatmap-level-${level}`;
        cell.dataset.date = day.date;
        cell.dataset.count = day.count;

        cell.addEventListener("mouseenter", (e) => showTooltip(e, day));
        cell.addEventListener("mouseleave", hideTooltip);

        col.appendChild(cell);
      });

      heatmapCells.appendChild(col);
    });
  }

  function showTooltip(e, day) {
    if (day.future) return;
    const date = new Date(day.date + "T00:00:00");
    const formatted = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const label = day.count === 1 ? "completion" : "completions";
    tooltip.textContent = `${day.count} ${label} on ${formatted}`;
    tooltip.classList.add("visible");

    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
  }

  async function init() {
    try {
      const data = await fetchHeatmap();
      renderStats(data);
      renderGrid(data);
    } catch (err) {
      heatmapCells.innerHTML = '<p class="heatmap-error">Failed to load heatmap data.</p>';
    }
  }

  init();
});
