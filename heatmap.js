function formatDateLabel(isoDate) {
  const day = new Date(`${isoDate}T12:00:00`);
  return day.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function createElement(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

function setSummaryValue(container, value, withUnit) {
  const numberNode = container.querySelector(".heatmap-summary-number");
  if (!numberNode) return;
  numberNode.textContent = String(value);
  if (!withUnit) return;
  const unitNode = container.querySelector(".heatmap-summary-unit");
  if (unitNode) {
    unitNode.textContent = value === 1 ? "day" : "days";
  }
}

function buildBoard(data) {
  const { month_labels: monthLabels, weeks, day_labels: dayLabels } = data;
  const root = createElement("div", "heatmap-board-inner");
  if (!weeks || !weeks.length) return root;

  const monthByColumn = new Map();
  (monthLabels || []).forEach((item) => monthByColumn.set(item.column, item.month));

  const monthRow = createElement("div", "heatmap-month-row");
  monthRow.appendChild(createElement("div", "heatmap-corner", ""));
  for (let columnIndex = 0; columnIndex < weeks.length; columnIndex += 1) {
    monthRow.appendChild(
      createElement("div", "heatmap-month-cell", monthByColumn.get(columnIndex) || "")
    );
  }
  root.appendChild(monthRow);

  const dayLabelRows = new Set([0, 2, 4, 6]);
  for (let rowIndex = 0; rowIndex < 7; rowIndex += 1) {
    const row = createElement("div", "heatmap-day-row");
    const labelText = dayLabelRows.has(rowIndex) ? dayLabels[rowIndex] || "" : "";
    row.appendChild(createElement("div", "heatmap-y-label", labelText));

    for (let columnIndex = 0; columnIndex < weeks.length; columnIndex += 1) {
      const day = weeks[columnIndex].days[rowIndex];
      const count = day.count;
      const level = day.level;
      const cell = createElement("button", `heatmap-cell heatmap-cell--level-${level}`);
      cell.type = "button";
      cell.dataset.date = day.date;
      cell.dataset.count = String(count);
      const suffix = count === 1 ? "" : "s";
      const tooltip = `${formatDateLabel(day.date)}: ${count} completion${suffix}`;
      cell.title = tooltip;
      cell.setAttribute("aria-label", tooltip);
      row.appendChild(cell);
    }

    root.appendChild(row);
  }

  return root;
}

async function initHeatmap() {
  const errorNode = document.getElementById("heatmapError");
  const boardNode = document.getElementById("heatmapBoard");
  const currentStreakNode = document.getElementById("statCurrentStreak");
  const longestStreakNode = document.getElementById("statLongestStreak");
  const totalNode = document.getElementById("statTotal");

  try {
    const response = await fetch("/api/analytics/heatmap");
    if (!response.ok) throw new Error("Failed to fetch heatmap data");
    const payload = await response.json();
    const summary = payload.summary || {};

    setSummaryValue(currentStreakNode, summary.current_streak_days ?? 0, true);
    setSummaryValue(longestStreakNode, summary.longest_streak_days ?? 0, true);
    setSummaryValue(totalNode, summary.total_completions ?? 0, false);

    boardNode.replaceChildren(buildBoard(payload));
    errorNode.hidden = true;
  } catch (error) {
    errorNode.textContent = "Could not load activity data. Please refresh and try again.";
    errorNode.hidden = false;
  }
}

document.addEventListener("DOMContentLoaded", initHeatmap);
