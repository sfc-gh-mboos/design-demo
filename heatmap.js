document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("heatmapGrid");
  const dayLabels = document.getElementById("heatmapDayLabels");
  const monthLabels = document.getElementById("heatmapMonthLabels");

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const SHOWN_DAYS = [0, 2, 4, 6]; // Mon, Wed, Fri, Sun

  function getLevel(count, max) {
    if (count === 0) return 0;
    if (max <= 0) return 1;
    const ratio = count / max;
    if (ratio <= 0.15) return 1;
    if (ratio <= 0.30) return 2;
    if (ratio <= 0.50) return 3;
    if (ratio <= 0.70) return 4;
    return 5;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function renderDayLabels() {
    dayLabels.innerHTML = "";
    DAY_NAMES.forEach((name, i) => {
      const label = document.createElement("div");
      label.className = "heatmap-day-label";
      if (!SHOWN_DAYS.includes(i)) {
        label.classList.add("hidden-label");
      }
      label.textContent = SHOWN_DAYS.includes(i) ? name : "";
      dayLabels.appendChild(label);
    });
  }

  function renderGrid(days) {
    grid.innerHTML = "";
    monthLabels.innerHTML = "";

    if (!days || days.length === 0) return;

    const maxCount = Math.max(...days.map(d => d.count), 1);

    // Organize days into weeks (columns)
    // Each week column has 7 rows: Mon(0) through Sun(6)
    const firstDate = new Date(days[0].date + "T00:00:00");
    const firstDayOfWeek = (firstDate.getDay() + 6) % 7; // Convert Sun=0 to Mon=0 based

    const weeks = [];
    let currentWeek = new Array(7).fill(null);

    // Fill leading empty cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek[i] = null;
    }

    let dayIndex = firstDayOfWeek;
    for (const day of days) {
      if (dayIndex === 7) {
        weeks.push(currentWeek);
        currentWeek = new Array(7).fill(null);
        dayIndex = 0;
      }
      currentWeek[dayIndex] = day;
      dayIndex++;
    }
    if (currentWeek.some(d => d !== null)) {
      weeks.push(currentWeek);
    }

    // Set grid template columns
    grid.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;

    // Render month labels
    let lastMonth = -1;
    const monthPositions = [];
    weeks.forEach((week, weekIdx) => {
      const firstDayInWeek = week.find(d => d !== null);
      if (firstDayInWeek) {
        const date = new Date(firstDayInWeek.date + "T00:00:00");
        const month = date.getMonth();
        if (month !== lastMonth) {
          monthPositions.push({ month, weekIdx });
          lastMonth = month;
        }
      }
    });

    // Create month label containers
    monthLabels.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;
    for (let i = 0; i < weeks.length; i++) {
      const label = document.createElement("div");
      label.className = "heatmap-month-label";
      const pos = monthPositions.find(p => p.weekIdx === i);
      if (pos) {
        label.textContent = MONTH_NAMES[pos.month];
      }
      monthLabels.appendChild(label);
    }

    // Render cells column by column (each column = 1 week)
    for (let col = 0; col < weeks.length; col++) {
      for (let row = 0; row < 7; row++) {
        const day = weeks[col][row];
        const cell = document.createElement("div");
        if (day) {
          const level = getLevel(day.count, maxCount);
          cell.className = `heatmap-cell level-${level}`;
          cell.title = `${formatDate(day.date)}: ${day.count} task${day.count !== 1 ? "s" : ""} completed`;

          cell.addEventListener("mouseenter", () => showTooltip(cell, day));
          cell.addEventListener("mouseleave", hideTooltip);
        } else {
          cell.className = "heatmap-cell empty";
        }
        grid.appendChild(cell);
      }
    }
  }

  // Tooltip
  let tooltipEl = null;

  function showTooltip(cell, day) {
    hideTooltip();
    tooltipEl = document.createElement("div");
    tooltipEl.className = "heatmap-tooltip";
    tooltipEl.innerHTML = `<strong>${day.count} task${day.count !== 1 ? "s" : ""}</strong> on ${formatDate(day.date)}`;

    document.body.appendChild(tooltipEl);

    const rect = cell.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.top - tipRect.height - 8;

    if (left < 8) left = 8;
    if (left + tipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tipRect.width - 8;
    }
    if (top < 8) {
      top = rect.bottom + 8;
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  function updateStats(stats) {
    document.getElementById("statCurrentStreak").textContent = stats.current_streak;
    document.getElementById("statLongestStreak").textContent = stats.longest_streak;
    document.getElementById("statTotalCompletions").textContent = stats.total_completions;
  }

  async function loadHeatmap() {
    try {
      const res = await fetch("/api/analytics/heatmap?weeks=12");
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      updateStats(data.stats);
      renderDayLabels();
      renderGrid(data.days);
    } catch (err) {
      console.error("Failed to load heatmap:", err);
    }
  }

  loadHeatmap();
});
