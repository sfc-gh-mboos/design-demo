document.addEventListener("DOMContentLoaded", async () => {
  function loadChartLib() {
    if (typeof Chart !== "undefined") {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      const finish = (ok) => {
        clearTimeout(timeout);
        resolve(ok);
      };
      const timeout = setTimeout(() => {
        script.remove();
        finish(false);
      }, 2800);
      script.onload = () => finish(typeof Chart !== "undefined");
      script.onerror = () => finish(false);
      document.head.appendChild(script);
    });
  }

  const chartsAvailable = await loadChartLib();

  const cohortFilter = document.getElementById("cohortFilter");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const datePresetBtns = document.querySelectorAll(".date-preset-btn");

  function formatDateForAPI(d) {
    return d.toISOString().slice(0, 10);
  }

  function setDateRange(days) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (days === "all") {
      startDateInput.value = "";
      endDateInput.value = "";
    } else {
      const start = new Date(today);
      start.setDate(start.getDate() - (parseInt(days, 10) - 1));
      start.setHours(0, 0, 0, 0);
      startDateInput.value = formatDateForAPI(start);
      endDateInput.value = formatDateForAPI(today);
    }
  }

  function getDateParams() {
    const start = startDateInput.value;
    const end = endDateInput.value;
    return { start, end };
  }

  function setPresetActive(days) {
    datePresetBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.days === String(days));
    });
  }

  // Chart instances (will be created on first load)
  let categoryChart = null;
  let priorityChart = null;
  let weeklyProgressChart = null;
  let priorityFocusChart = null;
  let productivityScoreChart = null;
  let dailyVolumeChart = null;
  // Color palette using Cursor brand colors
  const colors = {
    accent: "#f54e00",
    accentSubtle: "rgba(245, 78, 0, 0.12)",
    accentHover: "#ff5c0d",
    bg: "#f7f7f4",
    card: "#f2f1ed",
    fg: "#26251e",
    fgSecondary: "rgba(38, 37, 30, 0.6)",
    categoryColors: [
      "rgba(245, 78, 0, 0.8)",
      "rgba(245, 78, 0, 0.6)",
      "rgba(245, 78, 0, 0.4)",
      "rgba(245, 78, 0, 0.2)"
    ],
    priorityColors: {
      high: "rgba(245, 78, 0, 0.9)",
      medium: "rgba(245, 78, 0, 0.6)",
      low: "rgba(38, 37, 30, 0.4)"
    }
  };
  
  // API layer
  const AnalyticsAPI = {
    _params(cohort, start, end) {
      let url = `cohort=${encodeURIComponent(cohort)}`;
      if (start) url += `&start_date=${encodeURIComponent(start)}`;
      if (end) url += `&end_date=${encodeURIComponent(end)}`;
      return url;
    },
    async getSummary(cohort, start, end) {
      const res = await fetch(`/api/analytics/summary?${this._params(cohort, start, end)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch summary: ${res.statusText}`);
      }
      return res.json();
    },
    async getDistribution(cohort, start, end) {
      const res = await fetch(`/api/analytics/distribution?${this._params(cohort, start, end)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch distribution: ${res.statusText}`);
      }
      return res.json();
    },
    async getTrends(cohort, start, end) {
      const res = await fetch(`/api/analytics/trends?${this._params(cohort, start, end)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch trends: ${res.statusText}`);
      }
      return res.json();
    }
  };
  
  // Update KPI cards
  function updateKPIs(summary) {
    document.getElementById("kpiCompletionRate").textContent = `${summary.completion_rate}%`;
    document.getElementById("kpiTasksWeek").textContent = summary.tasks_this_week;
    document.getElementById("kpiStreak").textContent = summary.streak_days;
    document.getElementById("kpiHighPriority").textContent = `${summary.high_priority_completion}%`;
  }
  
  function chartCardForCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    return canvas ? canvas.closest(".chart-card") : null;
  }

  function clearChartFallback(canvasId) {
    const card = chartCardForCanvas(canvasId);
    if (!card) return;
    card
      .querySelectorAll(".chart-fallback, .chart-fallback-legend")
      .forEach((el) => el.remove());
    const canvas = document.getElementById(canvasId);
    if (canvas) canvas.classList.remove("hidden");
  }

  function showFallbackNotice() {
    if (document.getElementById("chartFallbackNotice")) return;
    const bar = document.createElement("p");
    bar.id = "chartFallbackNotice";
    bar.className = "chart-fallback-notice";
    bar.textContent =
      "Charts library did not load; showing a compact data preview instead.";
    const hero = document.querySelector(".analytics-container .hero");
    if (hero) hero.after(bar);
  }

  function renderFallbackCategory(data) {
    const id = "categoryChart";
    clearChartFallback(id);
    const canvas = document.getElementById(id);
    const card = chartCardForCanvas(id);
    if (!canvas || !card) return;
    canvas.classList.add("hidden");
    const wrap = document.createElement("div");
    wrap.className = "chart-fallback";
    const max = Math.max(
      1,
      ...data.by_category.map((c) => c.completed || 0)
    );
    data.by_category.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "chart-fallback-row";
      const label = document.createElement("span");
      label.className = "chart-fallback-label";
      label.textContent = c.name;
      const track = document.createElement("div");
      track.className = "chart-fallback-track";
      const fill = document.createElement("span");
      fill.className = "chart-fallback-fill";
      fill.style.width = `${Math.round((c.completed / max) * 100)}%`;
      fill.style.opacity = String(0.45 + (0.15 * (3 - Math.min(i, 3))));
      const val = document.createElement("span");
      val.className = "chart-fallback-value";
      val.textContent = `${c.completed}/${c.total}`;
      track.appendChild(fill);
      row.append(label, track, val);
      wrap.appendChild(row);
    });
    card.appendChild(wrap);
  }

  function renderFallbackPriority(data) {
    const id = "priorityChart";
    clearChartFallback(id);
    const canvas = document.getElementById(id);
    const card = chartCardForCanvas(id);
    if (!canvas || !card) return;
    canvas.classList.add("hidden");
    const wrap = document.createElement("div");
    wrap.className = "chart-fallback";
    const max = Math.max(1, ...data.by_priority.map((p) => p.count || 0));
    data.by_priority.forEach((p) => {
      const row = document.createElement("div");
      row.className = "chart-fallback-row";
      const label = document.createElement("span");
      label.className = "chart-fallback-label";
      label.textContent =
        p.name.charAt(0).toUpperCase() + p.name.slice(1);
      const track = document.createElement("div");
      track.className = "chart-fallback-track";
      const fill = document.createElement("span");
      fill.className = `chart-fallback-fill chart-fallback-fill--${p.name}`;
      fill.style.width = `${Math.round((p.count / max) * 100)}%`;
      const val = document.createElement("span");
      val.className = "chart-fallback-value";
      val.textContent = String(p.count);
      track.appendChild(fill);
      row.append(label, track, val);
      wrap.appendChild(row);
    });
    card.appendChild(wrap);
  }

  function renderFallbackSeries(canvasId, labels, series) {
    clearChartFallback(canvasId);
    const canvas = document.getElementById(canvasId);
    const card = chartCardForCanvas(canvasId);
    if (!canvas || !card) return;
    canvas.classList.add("hidden");
    const wrap = document.createElement("div");
    wrap.className = "chart-fallback chart-fallback--spark";
    const max = Math.max(
      1,
      ...series.flatMap((s) => s.values.map((v) => v || 0))
    );
    labels.forEach((_, idx) => {
      const col = document.createElement("div");
      col.className = "chart-fallback-spark-col";
      col.title = `${labels[idx]}: ${series
        .map((s) => `${s.label} ${s.values[idx] ?? 0}`)
        .join(", ")}`;
      series.forEach((s) => {
        const v = s.values[idx] || 0;
        const seg = document.createElement("span");
        seg.className = `chart-fallback-spark-bar chart-fallback-spark-bar--${s.tone}`;
        const pct = Math.round((v / max) * 100);
        seg.style.height = `${Math.max(6, pct)}%`;
        col.appendChild(seg);
      });
      wrap.appendChild(col);
    });
    const leg = document.createElement("div");
    leg.className = "chart-fallback-legend";
    series.forEach((s) => {
      const item = document.createElement("span");
      item.className = "chart-fallback-legend-item";
      const dot = document.createElement("i");
      dot.className = `chart-fallback-dot chart-fallback-dot--${s.tone}`;
      item.appendChild(dot);
      item.appendChild(document.createTextNode(s.label));
      leg.appendChild(item);
    });
    card.appendChild(wrap);
    card.appendChild(leg);
  }

  function renderAllFallbacks(distribution, trends) {
    showFallbackNotice();
    renderFallbackCategory(distribution);
    renderFallbackPriority(distribution);
    const weeks = trends.weekly_progress.map((w) => {
      const date = new Date(w.week);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    renderFallbackSeries("weeklyProgressChart", weeks, [
      {
        label: "Created",
        tone: "accent",
        values: trends.weekly_progress.map((w) => w.created),
      },
      {
        label: "Completed",
        tone: "muted",
        values: trends.weekly_progress.map((w) => w.completed),
      },
    ]);
    const pfWeeks = trends.priority_focus.map((w) => {
      const date = new Date(w.week);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    renderFallbackSeries("priorityFocusChart", pfWeeks, [
      {
        label: "High",
        tone: "high",
        values: trends.priority_focus.map((w) => w.high),
      },
      {
        label: "Med",
        tone: "medium",
        values: trends.priority_focus.map((w) => w.medium),
      },
      {
        label: "Low",
        tone: "low",
        values: trends.priority_focus.map((w) => w.low),
      },
    ]);
    const days = trends.daily_volume.map((d) => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    renderFallbackSeries("dailyVolumeChart", days, [
      {
        label: "Done",
        tone: "high",
        values: trends.daily_volume.map((d) => d.done),
      },
      {
        label: "In progress",
        tone: "medium",
        values: trends.daily_volume.map((d) => d.in_progress),
      },
      {
        label: "To do",
        tone: "low",
        values: trends.daily_volume.map((d) => d.todo),
      },
    ]);
    const scoreWeeks = trends.productivity_score.map((w) => {
      const date = new Date(w.week);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    renderFallbackSeries("productivityScoreChart", scoreWeeks, [
      {
        label: "Score",
        tone: "accent",
        values: trends.productivity_score.map((w) => w.score),
      },
    ]);
  }

  // Render category distribution (doughnut chart)
  function renderCategoryChart(data) {
    const ctx = document.getElementById("categoryChart").getContext("2d");
    
    if (categoryChart) {
      categoryChart.destroy();
    }
    
    categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: data.by_category.map(c => c.name),
        datasets: [{
          data: data.by_category.map(c => c.completed),
          backgroundColor: colors.categoryColors,
          borderColor: colors.card,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: {
                size: 11
              },
              color: colors.fg,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const item = data.by_category[context.dataIndex];
                return `${item.name}: ${item.completed}/${item.total} (${Math.round(item.completed / item.total * 100)}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  // Render priority distribution (bar chart)
  function renderPriorityChart(data) {
    const ctx = document.getElementById("priorityChart").getContext("2d");
    
    if (priorityChart) {
      priorityChart.destroy();
    }
    
    priorityChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.by_priority.map(p => p.name.charAt(0).toUpperCase() + p.name.slice(1)),
        datasets: [{
          label: "Tasks",
          data: data.by_priority.map(p => p.count),
          backgroundColor: [
            colors.priorityColors.high,
            colors.priorityColors.medium,
            colors.priorityColors.low
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.parsed.y} tasks`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              color: "rgba(38, 37, 30, 0.08)"
            }
          },
          x: {
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // Render weekly progress (line chart)
  function renderWeeklyProgressChart(data) {
    const ctx = document.getElementById("weeklyProgressChart").getContext("2d");
    
    if (weeklyProgressChart) {
      weeklyProgressChart.destroy();
    }
    
    const weeks = data.weekly_progress.map(w => {
      const date = new Date(w.week);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    weeklyProgressChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: weeks,
        datasets: [
          {
            label: "Created",
            data: data.weekly_progress.map(w => w.created),
            borderColor: colors.accent,
            backgroundColor: colors.accentSubtle,
            tension: 0.4,
            fill: false
          },
          {
            label: "Completed",
            data: data.weekly_progress.map(w => w.completed),
            borderColor: colors.accentHover,
            backgroundColor: colors.accentSubtle,
            tension: 0.4,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: { size: 11 },
              color: colors.fg,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              color: "rgba(38, 37, 30, 0.08)"
            }
          },
          x: {
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // Render priority focus (stacked bar chart)
  function renderPriorityFocusChart(data) {
    const ctx = document.getElementById("priorityFocusChart").getContext("2d");
    
    if (priorityFocusChart) {
      priorityFocusChart.destroy();
    }
    
    const weeks = data.priority_focus.map(w => {
      const date = new Date(w.week);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    priorityFocusChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: weeks,
        datasets: [
          {
            label: "High",
            data: data.priority_focus.map(w => w.high),
            backgroundColor: colors.priorityColors.high,
            borderRadius: 4
          },
          {
            label: "Medium",
            data: data.priority_focus.map(w => w.medium),
            backgroundColor: colors.priorityColors.medium,
            borderRadius: 4
          },
          {
            label: "Low",
            data: data.priority_focus.map(w => w.low),
            backgroundColor: colors.priorityColors.low,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: { size: 11 },
              color: colors.fg,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              color: "rgba(38, 37, 30, 0.08)"
            }
          }
        }
      }
    });
  }
  
  // Render productivity score (line chart)
  function renderProductivityScoreChart(data) {
    const ctx = document.getElementById("productivityScoreChart").getContext("2d");
    
    if (productivityScoreChart) {
      productivityScoreChart.destroy();
    }
    
    const weeks = data.productivity_score.map(w => {
      const date = new Date(w.week);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    productivityScoreChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: weeks,
        datasets: [{
          label: "Productivity Score",
          data: data.productivity_score.map(w => w.score),
          borderColor: colors.accent,
          backgroundColor: colors.accentSubtle,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Score: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 },
              callback: function(value) {
                return value;
              }
            },
            grid: {
              color: "rgba(38, 37, 30, 0.08)"
            }
          },
          x: {
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }
  
  // Render daily volume (stacked bar chart by status)
  function renderDailyVolumeChart(data) {
    const ctx = document.getElementById("dailyVolumeChart").getContext("2d");

    if (dailyVolumeChart) {
      dailyVolumeChart.destroy();
    }

    const days = data.daily_volume.map(d => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    dailyVolumeChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: days,
        datasets: [
          {
            label: "Done",
            data: data.daily_volume.map(d => d.done),
            backgroundColor: colors.priorityColors.high,
            borderRadius: 2
          },
          {
            label: "In Progress",
            data: data.daily_volume.map(d => d.in_progress),
            backgroundColor: colors.priorityColors.medium,
            borderRadius: 2
          },
          {
            label: "To Do",
            data: data.daily_volume.map(d => d.todo),
            backgroundColor: colors.priorityColors.low,
            borderRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: { size: 11 },
              color: colors.fg,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              afterTitle: function(tooltipItems) {
                const idx = tooltipItems[0].dataIndex;
                const item = data.daily_volume[idx];
                return `Total: ${item.todo + item.in_progress + item.done}`;
              },
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y}`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 },
              stepSize: 1
            },
            grid: {
              color: "rgba(38, 37, 30, 0.08)"
            }
          }
        }
      }
    });
  }

  // Load and render all data
  async function loadAnalytics(cohort, startDate, endDate) {
    try {
      const [summary, distribution, trends] = await Promise.all([
        AnalyticsAPI.getSummary(cohort, startDate, endDate),
        AnalyticsAPI.getDistribution(cohort, startDate, endDate),
        AnalyticsAPI.getTrends(cohort, startDate, endDate)
      ]);
      
      updateKPIs(summary);
      if (chartsAvailable) {
        document.getElementById("chartFallbackNotice")?.remove();
        [
          "categoryChart",
          "priorityChart",
          "weeklyProgressChart",
          "priorityFocusChart",
          "dailyVolumeChart",
          "productivityScoreChart",
        ].forEach(clearChartFallback);
        renderCategoryChart(distribution);
        renderPriorityChart(distribution);
        renderWeeklyProgressChart(trends);
        renderPriorityFocusChart(trends);
        renderDailyVolumeChart(trends);
        renderProductivityScoreChart(trends);
      } else {
        renderAllFallbacks(distribution, trends);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
      // Show error feedback
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-feedback";
      errorDiv.textContent = "Failed to load analytics data. Please refresh the page.";
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }
  
  function refreshAnalytics() {
    const { start, end } = getDateParams();
    loadAnalytics(cohortFilter.value, start || undefined, end || undefined);
  }

  // Initial load: default to 7d range
  setDateRange(7);
  setPresetActive("7");
  refreshAnalytics();

  // Cohort filter change handler
  cohortFilter.addEventListener("change", () => refreshAnalytics());

  // Date preset click handlers
  datePresetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setDateRange(btn.dataset.days);
      setPresetActive(btn.dataset.days);
      refreshAnalytics();
    });
  });

  // Custom date input handlers (clear preset selection)
  startDateInput.addEventListener("change", () => {
    setPresetActive("");
    refreshAnalytics();
  });
  endDateInput.addEventListener("change", () => {
    setPresetActive("");
    refreshAnalytics();
  });
});
