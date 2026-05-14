document.addEventListener("DOMContentLoaded", () => {
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
  let deliveryTimelineChart = null;
  let deliveryBurndownChart = null;
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
    _params(cohort, start, end, forecastOpts) {
      let url = `cohort=${encodeURIComponent(cohort)}`;
      if (start) url += `&start_date=${encodeURIComponent(start)}`;
      if (end) url += `&end_date=${encodeURIComponent(end)}`;
      if (forecastOpts) {
        if (forecastOpts.velocity_window_days != null && forecastOpts.velocity_window_days !== "") {
          url += `&velocity_window_days=${encodeURIComponent(forecastOpts.velocity_window_days)}`;
        }
        if (forecastOpts.max_forecast_days != null && forecastOpts.max_forecast_days !== "") {
          url += `&max_forecast_days=${encodeURIComponent(forecastOpts.max_forecast_days)}`;
        }
      }
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
    async getTrends(cohort, start, end, forecastOpts) {
      const res = await fetch(`/api/analytics/trends?${this._params(cohort, start, end, forecastOpts)}`);
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

  function getForecastOptsFromDom() {
    const vwEl = document.getElementById("forecastVelocityWindow");
    const mdEl = document.getElementById("forecastMaxDays");
    return {
      velocity_window_days: vwEl ? vwEl.value : "7",
      max_forecast_days: mdEl ? mdEl.value : "120",
    };
  }

  function formatChartDay(isoDate) {
    const d = new Date(`${isoDate}T12:00:00`);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function formatEtaMedium(isoDate) {
    if (!isoDate) return null;
    const d = new Date(`${isoDate}T12:00:00`);
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  function updateForecastMeta(dt) {
    const metaEl = document.getElementById("forecastPanelMeta");
    const subtitleEl = document.getElementById("forecastPanelSubtitle");
    if (!metaEl || !subtitleEl) return;

    const vb = dt.velocity_basis || {};
    const wdays = vb.window_days != null ? vb.window_days : 7;
    const avg = vb.avg_completed_per_day != null ? vb.avg_completed_per_day : 0;
    subtitleEl.textContent = `Based on trailing ${wdays}-day avg: ${avg} completions/day`;

    const history = dt.history || [];
    const forecast = dt.forecast || [];

    if (history.length === 0) {
      metaEl.textContent = "No daily trend data in this date range.";
      return;
    }

    const lastHist = history[history.length - 1];
    const horizon = getForecastOptsFromDom().max_forecast_days;

    let lines = [];

    if (lastHist.backlog_remaining <= 0) {
      lines.push(`Backlog clear as of ${formatEtaMedium(lastHist.date) || lastHist.date}.`);
    } else if (dt.estimated_delivery_date) {
      lines.push(`Est. backlog cleared: ${formatEtaMedium(dt.estimated_delivery_date) || dt.estimated_delivery_date}.`);
    } else if ((vb.avg_completed_per_day === 0 || vb.avg_completed_per_day == null) && forecast.length === 0) {
      lines.push("Forecast unavailable — no trailing completions to estimate velocity.");
    }

    if (dt.forecast_truncated && forecast.length > 0) {
      const remaining = forecast[forecast.length - 1].projected_backlog_remaining;
      lines.push(`Beyond ${horizon}-day horizon (~${remaining} tasks remaining).`);
    }

    metaEl.textContent = lines.filter(Boolean).join(" ");
  }

  function updateForecastKpis(dt) {
    const kVel = document.getElementById("forecastKpiVelocity");
    const kEta = document.getElementById("forecastKpiEta");
    const kRem = document.getElementById("forecastKpiRemaining");
    if (!kVel || !kEta || !kRem) return;

    const vb = dt.velocity_basis || {};
    const history = dt.history || [];

    kVel.textContent = vb.avg_completed_per_day != null ? String(vb.avg_completed_per_day) : "—";

    if (history.length === 0) {
      kEta.textContent = "—";
      kRem.textContent = "—";
      return;
    }

    const lastHist = history[history.length - 1];
    kRem.textContent = String(lastHist.backlog_remaining);

    if (lastHist.backlog_remaining <= 0) {
      kEta.textContent = formatEtaMedium(lastHist.date) || lastHist.date;
    } else if (dt.estimated_delivery_date) {
      kEta.textContent = formatEtaMedium(dt.estimated_delivery_date) || dt.estimated_delivery_date;
    } else {
      kEta.textContent = "—";
    }
  }

  function renderDeliveryTimelineChart(dt) {
    const canvas = document.getElementById("deliveryTimelineChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (deliveryTimelineChart) {
      deliveryTimelineChart.destroy();
    }

    const history = dt.history || [];
    const forecast = dt.forecast || [];

    if (history.length === 0) {
      deliveryTimelineChart = new Chart(ctx, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
        },
      });
      return;
    }

    const labels = [
      ...history.map((row) => formatChartDay(row.date)),
      ...forecast.map((row) => formatChartDay(row.date)),
    ];

    const completedActual = history.map((r) => r.completed).concat(forecast.map(() => null));
    const backlogActual = history.map((r) => r.backlog_remaining).concat(forecast.map(() => null));
    const completedProj = history.map(() => null).concat(forecast.map((r) => r.projected_completed));
    const backlogProj = history.map(() => null).concat(forecast.map((r) => r.projected_backlog_remaining));

    deliveryTimelineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Completed (actual)",
            data: completedActual,
            borderColor: colors.accent,
            backgroundColor: "transparent",
            yAxisID: "y",
            tension: 0.25,
            spanGaps: false,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
          {
            label: "Completed (projected)",
            data: completedProj,
            borderColor: colors.accentHover,
            backgroundColor: "transparent",
            borderDash: [6, 4],
            yAxisID: "y",
            tension: 0.25,
            spanGaps: false,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
          {
            label: "Backlog (actual)",
            data: backlogActual,
            borderColor: colors.priorityColors.low,
            backgroundColor: "transparent",
            yAxisID: "y1",
            tension: 0.25,
            spanGaps: false,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
          {
            label: "Backlog (projected)",
            data: backlogProj,
            borderColor: "rgba(38, 37, 30, 0.55)",
            backgroundColor: "transparent",
            borderDash: [6, 4],
            yAxisID: "y1",
            tension: 0.25,
            spanGaps: false,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: { size: 11 },
              color: colors.fg,
              padding: 12,
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const v = context.parsed.y;
                if (v == null || Number.isNaN(v)) return null;
                const rounded = Math.round(v * 100) / 100;
                return `${context.dataset.label}: ${rounded}`;
              },
              filter(item) {
                const v = item.parsed.y;
                return v != null && !Number.isNaN(v);
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 0,
            },
            grid: { display: false },
          },
          y: {
            position: "left",
            beginAtZero: true,
            title: {
              display: true,
              text: "Completions / day",
              color: colors.fgSecondary,
              font: { size: 11 },
            },
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 },
            },
            grid: {
              color: "rgba(38, 37, 30, 0.08)",
            },
          },
          y1: {
            position: "right",
            beginAtZero: true,
            title: {
              display: true,
              text: "Backlog remaining",
              color: colors.fgSecondary,
              font: { size: 11 },
            },
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 },
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });
  }

  function renderDeliveryBurndownChart(dt) {
    const canvas = document.getElementById("deliveryBurndownChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (deliveryBurndownChart) {
      deliveryBurndownChart.destroy();
    }

    const history = dt.history || [];
    const forecast = dt.forecast || [];

    if (history.length === 0) {
      deliveryBurndownChart = new Chart(ctx, {
        type: "line",
        data: { labels: [], datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
        },
      });
      return;
    }

    const labels = [
      ...history.map((row) => formatChartDay(row.date)),
      ...forecast.map((row) => formatChartDay(row.date)),
    ];

    const backlogActual = history.map((r) => r.backlog_remaining).concat(forecast.map(() => null));
    const backlogProj = history.map(() => null).concat(forecast.map((r) => r.projected_backlog_remaining));

    deliveryBurndownChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Backlog (actual)",
            data: backlogActual,
            borderColor: colors.accent,
            backgroundColor: colors.accentSubtle,
            fill: false,
            tension: 0.25,
            spanGaps: false,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
          {
            label: "Backlog (projected)",
            data: backlogProj,
            borderColor: colors.accentHover,
            backgroundColor: "transparent",
            borderDash: [6, 4],
            tension: 0.25,
            spanGaps: false,
            pointRadius: 2,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              font: { size: 11 },
              color: colors.fg,
              padding: 12,
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const v = context.parsed.y;
                if (v == null || Number.isNaN(v)) return null;
                return `${context.dataset.label}: ${v}`;
              },
              filter(item) {
                const v = item.parsed.y;
                return v != null && !Number.isNaN(v);
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 0,
            },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: colors.fgSecondary,
              font: { size: 10 },
            },
            grid: {
              color: "rgba(38, 37, 30, 0.08)",
            },
          },
        },
      },
    });
  }

  function renderForecastPanel(dt) {
    const safe = dt || {};
    updateForecastMeta(safe);
    updateForecastKpis(safe);
    renderDeliveryTimelineChart(safe);
    renderDeliveryBurndownChart(safe);
  }

  async function reloadForecastTrendsOnly() {
    try {
      const { start, end } = getDateParams();
      const trends = await AnalyticsAPI.getTrends(
        cohortFilter.value,
        start || undefined,
        end || undefined,
        getForecastOptsFromDom(),
      );
      renderForecastPanel(trends.delivery_timeline || {});
    } catch (error) {
      console.error("Failed to refresh forecast:", error);
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-feedback";
      errorDiv.textContent = "Failed to refresh delivery forecast.";
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }

  // Load and render all data
  async function loadAnalytics(cohort, startDate, endDate) {
    try {
      const forecastOpts = getForecastOptsFromDom();
      const [summary, distribution, trends] = await Promise.all([
        AnalyticsAPI.getSummary(cohort, startDate, endDate),
        AnalyticsAPI.getDistribution(cohort, startDate, endDate),
        AnalyticsAPI.getTrends(cohort, startDate, endDate, forecastOpts),
      ]);

      updateKPIs(summary);
      renderCategoryChart(distribution);
      renderPriorityChart(distribution);
      renderWeeklyProgressChart(trends);
      renderPriorityFocusChart(trends);
      renderDailyVolumeChart(trends);
      renderProductivityScoreChart(trends);
      renderForecastPanel(trends.delivery_timeline || {});
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

  const forecastApplyBtn = document.getElementById("forecastApplyBtn");
  if (forecastApplyBtn) {
    forecastApplyBtn.addEventListener("click", () => reloadForecastTrendsOnly());
  }
});
