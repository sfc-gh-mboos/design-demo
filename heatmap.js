document.addEventListener("DOMContentLoaded", () => {
  const statNodes = {
    current: document.getElementById("currentStreakDays"),
    longest: document.getElementById("longestStreakDays"),
    total: document.getElementById("totalCompletions"),
  };
  const monthLabels = document.getElementById("heatmapMonthLabels");
  const grid = document.getElementById("heatmapGrid");
  const tooltip = document.getElementById("heatmapTooltip");

  function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function showTooltip(event, day) {
    tooltip.textContent = `${formatDate(day.date)} - ${day.count} task${day.count === 1 ? "" : "s"} completed`;
    tooltip.classList.add("visible");
    tooltip.setAttribute("aria-hidden", "false");

    const spacing = 10;
    const tooltipRect = tooltip.getBoundingClientRect();
    let top = event.clientY - tooltipRect.height - spacing;
    let left = event.clientX + spacing;

    if (top < spacing) {
      top = event.clientY + spacing;
    }
    if (left + tooltipRect.width > window.innerWidth - spacing) {
      left = event.clientX - tooltipRect.width - spacing;
    }

    tooltip.style.top = `${window.scrollY + top}px`;
    tooltip.style.left = `${window.scrollX + left}px`;
  }

  function hideTooltip() {
    tooltip.classList.remove("visible");
    tooltip.setAttribute("aria-hidden", "true");
  }

  function renderSummary(summary) {
    statNodes.current.textContent = String(summary.current_streak_days || 0);
    statNodes.longest.textContent = String(summary.longest_streak_days || 0);
    statNodes.total.textContent = String(summary.total_completions || 0);
  }

  function renderMonthLabels(weeks, labels) {
    const columns = Math.max(weeks.length, 1);
    monthLabels.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    monthLabels.innerHTML = "";

    labels.forEach((label) => {
      const monthLabel = document.createElement("span");
      monthLabel.className = "heatmap-month-label";
      monthLabel.textContent = label.month;
      monthLabel.style.gridColumnStart = String(label.column + 1);
      monthLabels.appendChild(monthLabel);
    });
  }

  function renderGrid(weeks) {
    const columns = Math.max(weeks.length, 1);
    grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    grid.innerHTML = "";

    weeks.forEach((week) => {
      week.days.forEach((day) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `heatmap-cell heatmap-level-${day.level}`;
        cell.setAttribute(
          "aria-label",
          `${formatDate(day.date)}: ${day.count} task${day.count === 1 ? "" : "s"} completed`,
        );
        cell.addEventListener("mouseenter", (event) => showTooltip(event, day));
        cell.addEventListener("mousemove", (event) => showTooltip(event, day));
        cell.addEventListener("focus", (event) => showTooltip(event, day));
        cell.addEventListener("blur", hideTooltip);
        cell.addEventListener("mouseleave", hideTooltip);
        grid.appendChild(cell);
      });
    });
  }

  async function loadHeatmap() {
    try {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Unable to load heatmap: ${response.statusText}`);
      }

      const payload = await response.json();
      renderSummary(payload.summary || {});
      renderMonthLabels(payload.weeks || [], payload.month_labels || []);
      renderGrid(payload.weeks || []);
    } catch (error) {
      console.error(error);
      const errorNotice = document.createElement("div");
      errorNotice.className = "error-feedback";
      errorNotice.textContent = "Unable to load activity heatmap. Please refresh and try again.";
      document.body.appendChild(errorNotice);
      setTimeout(() => errorNotice.remove(), 5000);
    }
  }

  loadHeatmap();
});
