async function loadHeatmap() {
  try {
    const response = await fetch("/api/analytics/heatmap");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    
    // Update summary
    document.getElementById("currentStreak").textContent = data.summary.current_streak;
    document.getElementById("longestStreak").textContent = data.summary.longest_streak;
    document.getElementById("totalCompletions").textContent = data.summary.total_completions;
    
    // Render grid
    renderHeatmapGrid(data.grid);
    
  } catch (err) {
    console.error("Failed to load heatmap:", err);
    const errorEl = document.getElementById("heatmapError");
    errorEl.textContent = "Failed to load heatmap data.";
    errorEl.style.display = "block";
  }
}

function renderHeatmapGrid(grid) {
  const board = document.getElementById("heatmapBoard");
  board.innerHTML = "";
  
  // Month labels row
  const monthRow = document.createElement("div");
  monthRow.className = "heatmap-month-row";
  monthRow.innerHTML = '<div class="heatmap-corner"></div>';
  
  grid.forEach((week) => {
    const weekStart = new Date(week.start);
    const monthLabel = weekStart.toLocaleDateString("en-US", { month: "short" });
    const monthCell = document.createElement("div");
    monthCell.className = "heatmap-month-cell";
    monthCell.textContent = monthLabel;
    monthRow.appendChild(monthCell);
  });
  board.appendChild(monthRow);
  
  // Day rows (Mon-Sun)
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const dayRow = document.createElement("div");
    dayRow.className = "heatmap-day-row";
    
    const yLabel = document.createElement("div");
    yLabel.className = "heatmap-y-label";
    yLabel.textContent = dayLabels[dayIdx];
    dayRow.appendChild(yLabel);
    
    grid.forEach((week) => {
      const dayData = week.days[dayIdx];
      const cell = document.createElement("button");
      cell.className = "heatmap-cell";
      cell.setAttribute("type", "button");
      cell.setAttribute("aria-label", `${dayData.date}: ${dayData.count} completions`);
      
      const level = getIntensityLevel(dayData.count);
      cell.classList.add(`heatmap-cell--level-${level}`);
      
      cell.title = `${dayData.date}: ${dayData.count} completions`;
      
      dayRow.appendChild(cell);
    });
    
    board.appendChild(dayRow);
  }
}

function getIntensityLevel(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  if (count <= 6) return 4;
  return 5;
}

loadHeatmap();
