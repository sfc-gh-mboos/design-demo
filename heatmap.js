(function () {
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  function getLevel(count, max) {
    if (count === 0) return 0;
    if (max <= 0) return 1;
    const ratio = count / max;
    if (ratio <= 0.15) return 1;
    if (ratio <= 0.35) return 2;
    if (ratio <= 0.55) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
  }

  function renderDayLabels() {
    const container = document.getElementById("dayLabels");
    DAY_LABELS.forEach(function (label, i) {
      const el = document.createElement("span");
      el.className = "heatmap-day-label";
      el.textContent = (i % 2 === 0) ? label : "";
      container.appendChild(el);
    });
  }

  function renderGrid(days) {
    const grid = document.getElementById("heatmapGrid");
    const monthLabels = document.getElementById("monthLabels");
    grid.innerHTML = "";
    monthLabels.innerHTML = "";

    if (!days.length) return;

    var maxCount = 0;
    days.forEach(function (d) { if (d.count > maxCount) maxCount = d.count; });

    var firstDate = new Date(days[0].date + "T00:00:00");
    var startDay = (firstDate.getDay() + 6) % 7;

    var totalSlots = startDay + days.length;
    var numWeeks = Math.ceil(totalSlots / 7);

    grid.style.gridTemplateColumns = "repeat(" + numWeeks + ", 1fr)";

    var cells = [];
    for (var w = 0; w < numWeeks; w++) {
      for (var d = 0; d < 7; d++) {
        var idx = w * 7 + d - startDay;
        var cell = document.createElement("div");

        if (idx < 0 || idx >= days.length) {
          cell.className = "heatmap-cell empty";
        } else {
          var entry = days[idx];
          var level = getLevel(entry.count, maxCount);
          cell.className = "heatmap-cell level-" + level;
          cell.dataset.date = entry.date;
          cell.dataset.count = entry.count;
        }

        cells.push(cell);
        grid.appendChild(cell);
      }
    }

    var seenMonths = {};
    for (var w = 0; w < numWeeks; w++) {
      var label = document.createElement("span");
      label.className = "heatmap-month-label";

      var idx = w * 7 - startDay;
      if (idx >= 0 && idx < days.length) {
        var dt = new Date(days[idx].date + "T00:00:00");
        var monthKey = dt.getFullYear() + "-" + dt.getMonth();
        if (!seenMonths[monthKey]) {
          seenMonths[monthKey] = true;
          label.textContent = MONTH_NAMES[dt.getMonth()];
        }
      }

      monthLabels.appendChild(label);
    }

    setupTooltips(grid);
  }

  function setupTooltips(grid) {
    var tooltip = document.getElementById("tooltip");

    grid.addEventListener("mouseover", function (e) {
      var cell = e.target.closest(".heatmap-cell[data-date]");
      if (!cell) return;

      var date = cell.dataset.date;
      var count = parseInt(cell.dataset.count, 10);
      var dt = new Date(date + "T00:00:00");
      var formatted = dt.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      var text = count === 0
        ? "No completions on " + formatted
        : count + " completion" + (count !== 1 ? "s" : "") + " on " + formatted;

      tooltip.textContent = text;
      tooltip.classList.add("visible");

      var rect = cell.getBoundingClientRect();
      tooltip.style.left = rect.left + rect.width / 2 + "px";
      tooltip.style.top = rect.top - 8 + "px";
    });

    grid.addEventListener("mouseout", function (e) {
      if (!e.target.closest(".heatmap-cell[data-date]")) return;
      tooltip.classList.remove("visible");
    });
  }

  function updateStats(data) {
    document.querySelector("#currentStreak .stat-number").textContent = data.current_streak;
    document.querySelector("#longestStreak .stat-number").textContent = data.longest_streak;
    document.querySelector("#totalCompletions .stat-number").textContent = data.total;
  }

  function load() {
    renderDayLabels();

    fetch("/api/analytics/heatmap?weeks=12")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        updateStats(data);
        renderGrid(data.days);
      })
      .catch(function (err) {
        console.error("Failed to load heatmap data:", err);
      });
  }

  document.addEventListener("DOMContentLoaded", load);
})();
