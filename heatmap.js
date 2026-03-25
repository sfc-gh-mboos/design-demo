document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("heatmapGrid");
  const monthLabels = document.getElementById("monthLabels");
  const tooltip = document.getElementById("heatmapTooltip");
  const currentStreakEl = document.getElementById("currentStreak");
  const longestStreakEl = document.getElementById("longestStreak");
  const totalCompletionsEl = document.getElementById("totalCompletions");

  const WEEKS = 12;
  const DAYS_PER_WEEK = 7;
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function getLevel(count, max) {
    if (count === 0) return 0;
    if (max <= 0) return 1;
    const ratio = count / max;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
  }

  function buildGrid(days) {
    grid.innerHTML = "";
    monthLabels.innerHTML = "";

    const maxCount = Math.max(1, ...days.map(d => d.count));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = (today.getDay() + 6) % 7;
    const endOfGrid = new Date(today);
    endOfGrid.setDate(endOfGrid.getDate() + (6 - dayOfWeek));

    const startOfGrid = new Date(endOfGrid);
    startOfGrid.setDate(startOfGrid.getDate() - (WEEKS * 7 - 1));

    const countMap = {};
    days.forEach(d => { countMap[d.date] = d.count; });

    const weeks = [];
    const cursor = new Date(startOfGrid);
    let currentWeek = [];

    while (cursor <= endOfGrid) {
      const iso = cursor.toISOString().slice(0, 10);
      const dow = (cursor.getDay() + 6) % 7;

      if (dow === 0 && currentWeek.length > 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentWeek.push({
        date: iso,
        count: countMap[iso] || 0,
        dayOfWeek: dow,
        month: cursor.getMonth(),
        year: cursor.getFullYear(),
        day: cursor.getDate(),
        isFuture: cursor > today,
      });

      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    grid.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;

    const monthPositions = [];
    let lastMonth = -1;

    weeks.forEach((week, weekIdx) => {
      const col = document.createElement("div");
      col.className = "heatmap-column";

      const firstDay = week[0];
      if (firstDay.month !== lastMonth) {
        if (firstDay.day <= 7) {
          monthPositions.push({ month: firstDay.month, col: weekIdx });
          lastMonth = firstDay.month;
        } else if (lastMonth === -1) {
          monthPositions.push({ month: firstDay.month, col: weekIdx });
          lastMonth = firstDay.month;
        }
      }

      for (let row = 0; row < DAYS_PER_WEEK; row++) {
        const dayData = week.find(d => d.dayOfWeek === row);
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";

        if (!dayData || dayData.isFuture) {
          cell.setAttribute("data-level", "empty");
        } else {
          const level = getLevel(dayData.count, maxCount);
          cell.setAttribute("data-level", String(level));
          cell.setAttribute("data-date", dayData.date);
          cell.setAttribute("data-count", String(dayData.count));

          cell.addEventListener("mouseenter", showTooltip);
          cell.addEventListener("mouseleave", hideTooltip);
        }

        col.appendChild(cell);
      }

      grid.appendChild(col);
    });

    monthLabels.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;
    monthLabels.innerHTML = "";

    const labelSpans = new Array(weeks.length).fill("");
    monthPositions.forEach(p => {
      labelSpans[p.col] = MONTH_NAMES[p.month];
    });

    labelSpans.forEach(text => {
      const span = document.createElement("span");
      span.className = "heatmap-month-label";
      span.textContent = text;
      monthLabels.appendChild(span);
    });
  }

  function showTooltip(e) {
    const cell = e.target;
    const date = cell.getAttribute("data-date");
    const count = cell.getAttribute("data-count");
    if (!date) return;

    const d = new Date(date + "T00:00:00");
    const formatted = d.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    });
    const taskWord = count === "1" ? "task" : "tasks";
    tooltip.textContent = `${count} ${taskWord} completed on ${formatted}`;
    tooltip.classList.add("visible");

    const rect = cell.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
  }

  async function loadHeatmap() {
    try {
      const res = await fetch(`/api/analytics/heatmap?weeks=${WEEKS}`);
      if (!res.ok) throw new Error("Failed to load heatmap data");
      const data = await res.json();

      currentStreakEl.textContent = data.stats.current_streak;
      longestStreakEl.textContent = data.stats.longest_streak;
      totalCompletionsEl.textContent = data.stats.total_completions;

      buildGrid(data.days);
    } catch (err) {
      grid.innerHTML = '<p class="heatmap-error">Failed to load activity data.</p>';
    }
  }

  loadHeatmap();
});
