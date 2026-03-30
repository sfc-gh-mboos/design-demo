document.addEventListener("DOMContentLoaded", () => {
  const HeatmapAPI = {
    async fetch(weeks = 12) {
      const res = await fetch(`/api/analytics/heatmap?weeks=${weeks}`);
      if (!res.ok) throw new Error("Failed to fetch heatmap data");
      return res.json();
    },
  };

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function getLevel(count, max) {
    if (count === 0) return 0;
    if (max === 0) return 0;
    const ratio = count / max;
    if (ratio <= 0.15) return 1;
    if (ratio <= 0.35) return 2;
    if (ratio <= 0.55) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
  }

  function buildDayLabels() {
    const container = document.getElementById("dayLabels");
    const visible = [0, 2, 4, 6]; // Mon, Wed, Fri, Sun
    DAYS.forEach((day, i) => {
      const el = document.createElement("div");
      el.className = "heatmap-day-label";
      el.textContent = visible.includes(i) ? day : "";
      container.appendChild(el);
    });
  }

  function renderGrid(data) {
    const { start_date, end_date, daily_counts, current_streak, longest_streak, total_completions } = data;

    document.getElementById("currentStreak").textContent = current_streak;
    document.getElementById("longestStreak").textContent = longest_streak;
    document.getElementById("totalCompletions").textContent = total_completions;

    const start = new Date(start_date + "T00:00:00");
    const end = new Date(end_date + "T00:00:00");

    const maxCount = Math.max(1, ...Object.values(daily_counts));

    const weeks = [];
    const d = new Date(start);
    let currentWeek = [];
    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      const dayOfWeek = (d.getDay() + 6) % 7; // 0=Mon
      currentWeek.push({ date: iso, count: daily_counts[iso] || 0, dayOfWeek });
      if (dayOfWeek === 6 || d.getTime() === end.getTime()) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      d.setDate(d.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const grid = document.getElementById("heatmapGrid");
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;

    const monthLabels = document.getElementById("monthLabels");
    monthLabels.innerHTML = "";
    monthLabels.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;

    const monthPositions = new Map();
    weeks.forEach((week, wi) => {
      const firstDay = week[0];
      const dt = new Date(firstDay.date + "T00:00:00");
      const monthKey = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (!monthPositions.has(monthKey)) {
        monthPositions.set(monthKey, { col: wi, month: dt.getMonth() });
      }
    });

    for (let wi = 0; wi < weeks.length; wi++) {
      const label = document.createElement("div");
      label.className = "heatmap-month-label";
      let found = false;
      for (const [, val] of monthPositions) {
        if (val.col === wi) {
          label.textContent = MONTHS[val.month];
          found = true;
          break;
        }
      }
      if (!found) label.textContent = "";
      monthLabels.appendChild(label);
    }

    const cellsByDay = Array.from({ length: 7 }, () => []);

    weeks.forEach((week) => {
      const weekMap = {};
      week.forEach((day) => { weekMap[day.dayOfWeek] = day; });

      for (let row = 0; row < 7; row++) {
        const day = weekMap[row];
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";

        if (day) {
          const level = getLevel(day.count, maxCount);
          cell.classList.add(`heatmap-level-${level}`);
          cell.dataset.date = day.date;
          cell.dataset.count = day.count;

          cell.addEventListener("mouseenter", showTooltip);
          cell.addEventListener("mouseleave", hideTooltip);
        } else {
          cell.classList.add("heatmap-empty");
        }

        cellsByDay[row].push(cell);
      }
    });

    cellsByDay.forEach((row) => {
      row.forEach((cell) => grid.appendChild(cell));
    });
    grid.style.gridTemplateRows = "repeat(7, 1fr)";
  }

  function showTooltip(e) {
    const cell = e.currentTarget;
    const date = cell.dataset.date;
    const count = parseInt(cell.dataset.count, 10);
    if (!date) return;

    const tooltip = document.getElementById("heatmapTooltip");
    const d = new Date(date + "T00:00:00");
    const formatted = d.toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric"
    });

    tooltip.textContent = `${count} task${count !== 1 ? "s" : ""} on ${formatted}`;
    tooltip.classList.add("visible");

    const rect = cell.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 8}px`;
  }

  function hideTooltip() {
    document.getElementById("heatmapTooltip").classList.remove("visible");
  }

  async function init() {
    buildDayLabels();
    try {
      const data = await HeatmapAPI.fetch(12);
      renderGrid(data);
    } catch (err) {
      console.error("Heatmap load error:", err);
    }
  }

  init();
});
