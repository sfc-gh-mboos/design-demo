document.addEventListener("DOMContentLoaded", () => {
  const currentStreakNode = document.getElementById("currentStreak");
  const longestStreakNode = document.getElementById("longestStreak");
  const totalCompletionsNode = document.getElementById("totalCompletions");
  const monthLabelsNode = document.getElementById("monthLabels");
  const gridNode = document.getElementById("heatmapGrid");
  const tooltipNode = document.getElementById("heatmapTooltip");

  const HeatmapAPI = {
    async getData() {
      const response = await fetch("/api/analytics/heatmap");
      if (!response.ok) {
        throw new Error(`Failed to fetch heatmap data: ${response.statusText}`);
      }
      return response.json();
    },
  };

  function formatDateLabel(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatCount(count) {
    return `${count} task${count === 1 ? "" : "s"} completed`;
  }

  function positionTooltip(event) {
    const margin = 14;
    const { clientX, clientY } = event;
    const tooltipRect = tooltipNode.getBoundingClientRect();
    const nextLeft = Math.min(
      window.innerWidth - tooltipRect.width - margin,
      clientX + margin
    );
    const nextTop = Math.max(margin, clientY - tooltipRect.height - margin);
    tooltipNode.style.left = `${nextLeft}px`;
    tooltipNode.style.top = `${nextTop}px`;
  }

  function showTooltip(event, cell) {
    tooltipNode.textContent = `${formatDateLabel(cell.date)} - ${formatCount(cell.count)}`;
    tooltipNode.classList.add("visible");
    positionTooltip(event);
  }

  function hideTooltip() {
    tooltipNode.classList.remove("visible");
  }

  function renderMonthLabels(monthLabels, weeks) {
    monthLabelsNode.textContent = "";
    monthLabelsNode.style.gridTemplateColumns = `repeat(${weeks}, minmax(0, 1fr))`;
    monthLabels.forEach((month) => {
      const node = document.createElement("span");
      node.className = "heatmap-month";
      node.style.gridColumn = `${month.week_index + 1} / span 1`;
      node.textContent = month.label;
      monthLabelsNode.appendChild(node);
    });
  }

  function renderGrid(cells, weeks) {
    gridNode.textContent = "";
    gridNode.style.gridTemplateColumns = `repeat(${weeks}, minmax(0, 1fr))`;
    gridNode.setAttribute("aria-colcount", String(weeks));
    gridNode.setAttribute("aria-rowcount", "7");

    cells.forEach((cell) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `heatmap-cell intensity-${cell.intensity_level}`;
      button.style.gridColumn = `${cell.week_index + 1}`;
      button.style.gridRow = `${cell.day_index + 1}`;
      button.setAttribute("role", "gridcell");
      button.setAttribute(
        "aria-label",
        `${formatDateLabel(cell.date)}: ${formatCount(cell.count)}`
      );
      button.addEventListener("mouseenter", (event) => showTooltip(event, cell));
      button.addEventListener("mousemove", positionTooltip);
      button.addEventListener("mouseleave", hideTooltip);
      button.addEventListener("focus", (event) => showTooltip(event, cell));
      button.addEventListener("blur", hideTooltip);
      gridNode.appendChild(button);
    });
  }

  function renderSummary(summary) {
    currentStreakNode.textContent = String(summary.current_streak || 0);
    longestStreakNode.textContent = String(summary.longest_streak || 0);
    totalCompletionsNode.textContent = String(summary.total_completions || 0);
  }

  function renderHeatmap(payload) {
    renderSummary(payload.summary);
    renderMonthLabels(payload.month_labels, payload.weeks);
    renderGrid(payload.cells, payload.weeks);
  }

  async function initHeatmap() {
    try {
      const payload = await HeatmapAPI.getData();
      renderHeatmap(payload);
    } catch (error) {
      console.error(error);
      const message = document.createElement("div");
      message.className = "error-feedback";
      message.textContent = "Failed to load heatmap data. Please refresh the page.";
      document.body.appendChild(message);
      setTimeout(() => {
        message.remove();
      }, 5000);
    }
  }

  initHeatmap();
});
