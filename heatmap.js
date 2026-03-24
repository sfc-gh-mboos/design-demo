document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("heatmapGrid");
  const dayLabels = document.getElementById("dayLabels");
  const monthLabels = document.getElementById("monthLabels");
  const tooltip = document.getElementById("heatmapTooltip");
  const currentStreakEl = document.getElementById("currentStreak");
  const longestStreakEl = document.getElementById("longestStreak");
  const totalCompletionsEl = document.getElementById("totalCompletions");

  const WEEKS = 12;
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_LABELS_SHOWN = { 0: "Mon", 2: "Wed", 4: "Fri", 6: "Sun" };

  const HeatmapAPI = {
    async getData(weeks) {
      const res = await fetch(`/api/analytics/heatmap?weeks=${weeks}`);
      if (!res.ok) throw new Error(`Failed to fetch heatmap data: ${res.statusText}`);
      return res.json();
    },
  };

  function getIntensityLevel(count, maxCount) {
    if (count === 0) return 0;
    if (maxCount === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.15) return 1;
    if (ratio <= 0.35) return 2;
    if (ratio <= 0.55) return 3;
    if (ratio <= 0.80) return 4;
    return 5;
  }

  function buildGridData(dailyCounts, endDateStr) {
    const endDate = new Date(endDateStr + "T12:00:00");
    const endDow = (endDate.getDay() + 6) % 7; // 0=Mon, 6=Sun

    const columns = [];
    const monthMarkers = [];

    for (let w = WEEKS - 1; w >= 0; w--) {
      const column = [];
      for (let d = 0; d < 7; d++) {
        const daysBack = endDow + 7 * w - d;
        if (daysBack < 0) {
          column.push(null);
          continue;
        }
        const cellDate = new Date(endDate);
        cellDate.setDate(endDate.getDate() - daysBack);
        const dateStr = cellDate.toISOString().slice(0, 10);
        const count = dailyCounts[dateStr] || 0;
        column.push({ date: dateStr, count, cellDate: new Date(cellDate) });
      }
      columns.push(column);
    }

    let prevMonth = null;
    columns.forEach((col, idx) => {
      const firstCell = col.find((c) => c !== null);
      if (firstCell) {
        const month = firstCell.cellDate.getMonth();
        if (month !== prevMonth) {
          monthMarkers.push({
            colIndex: idx,
            label: firstCell.cellDate.toLocaleDateString("en-US", { month: "short" }),
          });
          prevMonth = month;
        }
      }
    });

    return { columns, monthMarkers };
  }

  function renderDayLabels() {
    dayLabels.innerHTML = "";
    for (let d = 0; d < 7; d++) {
      const label = document.createElement("div");
      label.className = "heatmap-day-label";
      if (DAY_LABELS_SHOWN[d] !== undefined) {
        label.textContent = DAY_LABELS_SHOWN[d];
      }
      dayLabels.appendChild(label);
    }
  }

  function renderMonthLabels(monthMarkers, totalCols) {
    monthLabels.innerHTML = "";
    monthLabels.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;
    let lastEnd = 0;
    monthMarkers.forEach((marker) => {
      if (marker.colIndex > lastEnd) {
        const spacer = document.createElement("div");
        spacer.style.gridColumn = `${lastEnd + 1} / ${marker.colIndex + 1}`;
        monthLabels.appendChild(spacer);
      }
      const label = document.createElement("div");
      label.className = "heatmap-month-label";
      label.textContent = marker.label;
      label.style.gridColumn = `${marker.colIndex + 1}`;
      monthLabels.appendChild(label);
      lastEnd = marker.colIndex + 1;
    });
  }

  function renderGrid(columns, maxCount) {
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;

    columns.forEach((col) => {
      const colDiv = document.createElement("div");
      colDiv.className = "heatmap-column";
      col.forEach((cell) => {
        const cellDiv = document.createElement("div");
        if (cell === null) {
          cellDiv.className = "heatmap-cell heatmap-cell-empty";
        } else {
          const level = getIntensityLevel(cell.count, maxCount);
          cellDiv.className = `heatmap-cell heatmap-level-${level}`;
          cellDiv.dataset.date = cell.date;
          cellDiv.dataset.count = cell.count;

          cellDiv.addEventListener("mouseenter", (e) => showTooltip(e, cell));
          cellDiv.addEventListener("mouseleave", hideTooltip);
        }
        colDiv.appendChild(cellDiv);
      });
      grid.appendChild(colDiv);
    });
  }

  function showTooltip(e, cell) {
    const formatted = new Date(cell.date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const taskWord = cell.count === 1 ? "task" : "tasks";
    tooltip.textContent = `${cell.count} ${taskWord} completed on ${formatted}`;
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
      const data = await HeatmapAPI.getData(WEEKS);

      currentStreakEl.textContent = data.current_streak;
      longestStreakEl.textContent = data.longest_streak;
      totalCompletionsEl.textContent = data.total_completions;

      const { columns, monthMarkers } = buildGridData(data.daily_counts, data.end_date);

      const allCounts = Object.values(data.daily_counts).map(Number);
      const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 1;

      renderDayLabels();
      renderMonthLabels(monthMarkers, columns.length);
      renderGrid(columns, maxCount);
    } catch (err) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-feedback";
      errorDiv.textContent = "Failed to load heatmap data. Please try again.";
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    }
  }

  init();
});
