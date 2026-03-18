(function () {
  var WEEKS = 12;
  var DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function getLevel(count) {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 3;
    if (count <= 6) return 4;
    return 5;
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function buildWeeks(dailyCounts) {
    var counts = {};
    dailyCounts.forEach(function (d) { counts[d.date] = d.count; });

    var today = new Date();
    today.setHours(12, 0, 0, 0);

    var dow = today.getDay();
    var mondayOffset = dow === 0 ? 6 : dow - 1;
    var currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - mondayOffset);

    var startDate = new Date(currentMonday);
    startDate.setDate(startDate.getDate() - (WEEKS - 1) * 7);

    var weeks = [];
    var cursor = new Date(startDate);

    for (var w = 0; w < WEEKS; w++) {
      var week = [];
      for (var d = 0; d < 7; d++) {
        var date = new Date(cursor);
        date.setDate(cursor.getDate() + d);
        var dateStr = date.toISOString().split('T')[0];
        var isFuture = date > today;
        week.push({ date: dateStr, count: isFuture ? 0 : (counts[dateStr] || 0), isFuture: isFuture });
      }
      weeks.push(week);
      cursor.setDate(cursor.getDate() + 7);
    }

    return weeks;
  }

  function renderHeatmap(data) {
    document.getElementById('currentStreak').textContent = data.current_streak;
    document.getElementById('longestStreak').textContent = data.longest_streak;
    document.getElementById('totalCompletions').textContent = data.total_completions;

    var weeks = buildWeeks(data.daily_counts);
    var grid = document.getElementById('heatmapGrid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = '33px repeat(' + WEEKS + ', 1fr)';

    // Row 0: month labels
    grid.appendChild(document.createElement('div'));
    for (var w = 0; w < weeks.length; w++) {
      var el = document.createElement('div');
      var firstDay = new Date(weeks[w][0].date + 'T12:00:00');
      var isNewMonth = w === 0 ||
        firstDay.getMonth() !== new Date(weeks[w - 1][0].date + 'T12:00:00').getMonth();
      if (isNewMonth) {
        el.className = 'heatmap-month-label';
        el.textContent = MONTH_NAMES[firstDay.getMonth()];
      }
      grid.appendChild(el);
    }

    // Rows 1–7: day labels + cells
    for (var dayIdx = 0; dayIdx < 7; dayIdx++) {
      var label = document.createElement('div');
      label.className = 'heatmap-day-label';
      if (dayIdx === 0 || dayIdx === 2 || dayIdx === 4 || dayIdx === 6) {
        label.textContent = DAY_NAMES[dayIdx];
      }
      grid.appendChild(label);

      for (var wi = 0; wi < weeks.length; wi++) {
        var day = weeks[wi][dayIdx];
        var cell = document.createElement('div');

        if (day.isFuture) {
          cell.className = 'heatmap-cell heatmap-cell-future';
        } else {
          cell.className = 'heatmap-cell level-' + getLevel(day.count);
          var tooltip = document.createElement('div');
          tooltip.className = 'heatmap-tooltip';
          var txt = day.count === 0 ? 'No tasks' :
            day.count + ' task' + (day.count !== 1 ? 's' : '');
          tooltip.textContent = txt + ' on ' + formatDate(day.date);
          cell.appendChild(tooltip);
        }

        grid.appendChild(cell);
      }
    }
  }

  function loadHeatmap() {
    fetch('/api/analytics/heatmap?weeks=' + WEEKS)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(renderHeatmap)
      .catch(function (err) {
        console.error('Failed to load heatmap:', err);
      });
  }

  document.addEventListener('DOMContentLoaded', loadHeatmap);
})();
