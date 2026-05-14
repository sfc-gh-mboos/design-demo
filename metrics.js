document.addEventListener("DOMContentLoaded", async () => {
  const gate = document.getElementById("metricsGate");
  const content = document.getElementById("metricsContent");
  const subtitle = document.getElementById("metricsSubtitle");
  const emptyEl = document.getElementById("metricsEmpty");

  function showGate() {
    gate.hidden = false;
    content.hidden = true;
  }

  function showContent() {
    gate.hidden = true;
    content.hidden = false;
  }

  function fmtPct(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return "--";
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }

  function renderBars(node, items, totalOverride) {
    node.innerHTML = "";
    const total = totalOverride != null
      ? totalOverride
      : items.reduce((acc, it) => acc + (it.count || 0), 0);
    const fallback = total > 0 ? total : 1;
    items.forEach((item) => {
      const count = item.count || 0;
      const pct = total > 0 ? (count / fallback) * 100 : 0;
      const li = document.createElement("li");
      li.className = "metrics-bar";
      li.innerHTML = `
        <div class="metrics-bar-row">
          <span class="metrics-bar-label">${item.name}</span>
          <span class="metrics-bar-count">${count}</span>
        </div>
        <div class="metrics-bar-track">
          <div class="metrics-bar-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
      `;
      node.appendChild(li);
    });
  }

  function renderDailyVolume(node, daily) {
    node.innerHTML = "";
    const max = daily.reduce((m, d) => Math.max(m, d.created, d.completed), 0) || 1;
    daily.forEach((d) => {
      const day = document.createElement("div");
      day.className = "daily-volume-day";
      const createdHeight = (d.created / max) * 100;
      const completedHeight = (d.completed / max) * 100;
      const dayLabel = d.date.slice(5);
      day.innerHTML = `
        <div class="daily-volume-bars">
          <span class="daily-volume-bar daily-volume-bar--created" style="height:${createdHeight.toFixed(1)}%" title="${d.created} created"></span>
          <span class="daily-volume-bar daily-volume-bar--completed" style="height:${completedHeight.toFixed(1)}%" title="${d.completed} completed"></span>
        </div>
        <span class="daily-volume-label">${dayLabel}</span>
      `;
      node.appendChild(day);
    });
  }

  function renderMetrics(payload) {
    const user = payload.user;
    const m = payload.metrics;

    if (subtitle) {
      subtitle.textContent = `Custom metrics for ${user.display_name || user.username}.`;
    }

    document.getElementById("kpiTotalTasks").textContent = String(m.total_tasks);
    document.getElementById("kpiCompletionRate").textContent = fmtPct(m.completion_rate);
    document.getElementById("kpiStreakDays").textContent = String(m.streak_days);
    document.getElementById("kpiCompletedWeek").textContent = String(m.completed_last_7_days);

    const statusItems = [
      { name: "To Do", count: m.by_status["todo"] || 0 },
      { name: "In Progress", count: m.by_status["in-progress"] || 0 },
      { name: "Done", count: m.by_status["done"] || 0 },
    ];
    renderBars(document.getElementById("statusBars"), statusItems);
    renderBars(document.getElementById("priorityBars"), m.by_priority.map((p) => ({
      name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
      count: p.count,
    })));
    renderBars(document.getElementById("categoryBars"), m.by_category);
    renderDailyVolume(document.getElementById("dailyVolume"), m.daily_volume);

    if (m.total_tasks === 0) {
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
    }
  }

  try {
    const res = await fetch("/api/metrics/me", { credentials: "same-origin" });
    if (res.status === 401) {
      showGate();
      return;
    }
    if (!res.ok) {
      showGate();
      return;
    }
    const payload = await res.json();
    renderMetrics(payload);
    showContent();
  } catch (err) {
    showGate();
  }
});
