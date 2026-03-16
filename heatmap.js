const HeatmapAPI = {
  async getData(weeks = 12) {
    const res = await fetch(`/api/analytics/heatmap?weeks=${weeks}`);
    if (!res.ok) throw new Error(`Heatmap API error: ${res.status}`);
    return res.json();
  },
};

function updateStats(data) {
  document.querySelector("#currentStreak .heatmap-stat-number").textContent =
    data.current_streak;
  document.querySelector("#longestStreak .heatmap-stat-number").textContent =
    data.longest_streak;
  document.querySelector("#totalCompletions .heatmap-stat-number").textContent =
    data.total;
}

function getLevel(count, maxCount) {
  if (count === 0) return 0;
  if (maxCount === 0) return 0;
  const ratio = count / maxCount;
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.4) return 2;
  if (ratio <= 0.6) return 3;
  if (ratio <= 0.8) return 4;
  return 5;
}

function buildGrid(days) {
  const grid = document.getElementById("heatmapGrid");
  const monthLabels = document.getElementById("monthLabels");
  const dayLabels = document.getElementById("dayLabels");

  grid.innerHTML = "";
  monthLabels.innerHTML = "";
  dayLabels.innerHTML = "";

  if (days.length === 0) return;

  const maxCount = Math.max(...days.map((d) => d.count));

  const firstDate = new Date(days[0].date + "T00:00:00");
  const startDow = (firstDate.getDay() + 6) % 7; // 0=Mon

  const cells = [];
  for (let i = 0; i < startDow; i++) {
    cells.push(null);
  }
  days.forEach((d) => cells.push(d));

  const totalWeeks = Math.ceil(cells.length / 7);

  grid.style.gridTemplateColumns = `repeat(${totalWeeks}, 1fr)`;

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const showDays = [0, 2, 4, 6]; // Mon, Wed, Fri, Sun
  dayNames.forEach((name, i) => {
    const label = document.createElement("span");
    label.className = "heatmap-day-label";
    if (!showDays.includes(i)) {
      label.style.visibility = "hidden";
    }
    label.textContent = name;
    dayLabels.appendChild(label);
  });

  const monthPositions = new Map();
  cells.forEach((cell, idx) => {
    if (!cell) return;
    const d = new Date(cell.date + "T00:00:00");
    if (d.getDate() <= 7) {
      const weekCol = Math.floor(idx / 7);
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      if (!monthPositions.has(monthName)) {
        monthPositions.set(monthName, weekCol);
      }
    }
  });

  monthLabels.style.gridTemplateColumns = `repeat(${totalWeeks}, 1fr)`;
  for (let w = 0; w < totalWeeks; w++) {
    const label = document.createElement("span");
    label.className = "heatmap-month-label";
    for (const [name, col] of monthPositions) {
      if (col === w) {
        label.textContent = name;
        break;
      }
    }
    monthLabels.appendChild(label);
  }

  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < totalWeeks; col++) {
      const idx = col * 7 + row;
      const el = document.createElement("div");
      el.className = "heatmap-cell";

      if (idx < cells.length && cells[idx]) {
        const entry = cells[idx];
        const level = getLevel(entry.count, maxCount);
        el.setAttribute("data-level", level);
        el.setAttribute("data-date", entry.date);
        el.setAttribute("data-count", entry.count);
      } else {
        el.setAttribute("data-level", "empty");
      }

      grid.appendChild(el);
    }
  }
}

function setupTooltip() {
  const tooltip = document.getElementById("tooltip");
  const grid = document.getElementById("heatmapGrid");

  grid.addEventListener("mouseover", (e) => {
    const cell = e.target.closest(".heatmap-cell[data-date]");
    if (!cell) {
      tooltip.classList.remove("visible");
      return;
    }

    const date = cell.getAttribute("data-date");
    const count = cell.getAttribute("data-count");
    const d = new Date(date + "T00:00:00");
    const formatted = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const label =
      count === "0"
        ? "No completions"
        : `${count} completion${count === "1" ? "" : "s"}`;

    tooltip.textContent = `${label} on ${formatted}`;
    tooltip.classList.add("visible");

    const rect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`;
    tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
  });

  grid.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest(".heatmap-cell[data-date]")) {
      tooltip.classList.remove("visible");
    }
  });
}

async function loadHeatmap() {
  try {
    const data = await HeatmapAPI.getData(12);
    updateStats(data);
    buildGrid(data.days);
    setupTooltip();
  } catch (err) {
    console.error("Failed to load heatmap:", err);
    const container = document.querySelector(".heatmap-card");
    const feedback = document.createElement("div");
    feedback.className = "error-feedback";
    feedback.textContent = "Failed to load activity data";
    document.body.appendChild(feedback);
    setTimeout(() => feedback.remove(), 3000);
  }
}

document.addEventListener("DOMContentLoaded", loadHeatmap);
