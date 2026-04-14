document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("heatmapGrid");
  const monthLabels = document.getElementById("heatmapMonthLabels");
  const legendCells = document.getElementById("heatmapLegendCells");
  const tooltip = document.getElementById("heatmapTooltip");
  const currentStreakValue = document.getElementById("currentStreakValue");
  const longestStreakValue = document.getElementById("longestStreakValue");
  const totalCompletionsValue = document.getElementById("totalCompletionsValue");

  const levelClasses = [
    "heatmap-level-0",
    "heatmap-level-1",
    "heatmap-level-2",
    "heatmap-level-3",
    "heatmap-level-4",
    "heatmap-level-5",
  ];

  const friendlyDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  function updateSummary(summary) {
    currentStreakValue.textContent = summary.current_streak_days;
    longestStreakValue.textContent = summary.longest_streak_days;
    totalCompletionsValue.textContent = summary.total_completions;
  }

  function renderMonthLabels(labels) {
    monthLabels.innerHTML = "";
    labels.forEach((label) => {
      const node = document.createElement("span");
      node.className = "heatmap-month-label";
      node.style.gridColumn = `${label.column + 1}`;
      node.textContent = label.month;
      monthLabels.appendChild(node);
    });
  }

  function moveTooltip(event, cell) {
    const rect = cell.getBoundingClientRect();
    const left = rect.left + window.scrollX + rect.width / 2;
    const top = rect.top + window.scrollY - 10;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    if (event && event.type === "mousemove") {
      tooltip.style.transform = "translate(-50%, -110%)";
    }
  }

  function renderGrid(weeks) {
    grid.innerHTML = "";
    weeks.forEach((week, columnIndex) => {
      week.days.forEach((day, rowIndex) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `heatmap-cell ${levelClasses[day.level]}`;
        button.style.gridColumn = `${columnIndex + 1}`;
        button.style.gridRow = `${rowIndex + 1}`;
        button.dataset.date = day.date;
        button.dataset.count = day.count;
        button.setAttribute("aria-label", `${day.count} tasks completed on ${day.date}`);
        button.addEventListener("mouseenter", (event) => {
          const dateText = friendlyDate.format(new Date(`${day.date}T12:00:00`));
          const suffix = day.count === 1 ? "task completed" : "tasks completed";
          tooltip.textContent = `${dateText}: ${day.count} ${suffix}`;
          tooltip.classList.add("visible");
          moveTooltip(event, button);
        });
        button.addEventListener("mousemove", (event) => moveTooltip(event, button));
        button.addEventListener("mouseleave", () => tooltip.classList.remove("visible"));
        button.addEventListener("focus", (event) => {
          const dateText = friendlyDate.format(new Date(`${day.date}T12:00:00`));
          const suffix = day.count === 1 ? "task completed" : "tasks completed";
          tooltip.textContent = `${dateText}: ${day.count} ${suffix}`;
          tooltip.classList.add("visible");
          moveTooltip(event, button);
        });
        button.addEventListener("blur", () => tooltip.classList.remove("visible"));
        grid.appendChild(button);
      });
    });
  }

  function renderLegend() {
    legendCells.innerHTML = "";
    for (let level = 0; level <= 5; level += 1) {
      const node = document.createElement("span");
      node.className = `heatmap-legend-cell ${levelClasses[level]}`;
      legendCells.appendChild(node);
    }
  }

  async function loadHeatmap() {
    try {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Failed to fetch heatmap data: ${response.status}`);
      }
      const payload = await response.json();
      updateSummary(payload.summary);
      renderMonthLabels(payload.month_labels || []);
      renderGrid(payload.weeks || []);
      renderLegend();
    } catch (error) {
      console.error(error);
      tooltip.textContent = "Failed to load heatmap data.";
      tooltip.classList.add("visible");
      tooltip.style.left = "50%";
      tooltip.style.top = "120px";
      tooltip.style.transform = "translateX(-50%)";
    }
  }

  loadHeatmap();
});
