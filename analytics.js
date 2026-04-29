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

  function chartPalette() {
    const el = document.documentElement;
    const g = (name) => getComputedStyle(el).getPropertyValue(name).trim();
    const accent = g("--accent") || "#0d9488";
    const accentHover = g("--accent-hover") || "#14b8a6";
    const card = g("--card") || "#e8f0ee";
    const fg = g("--fg") || "#1a2332";
    const fgSecondary = g("--fg-secondary") || "rgba(26, 35, 50, 0.58)";
    const chartGrid = g("--chart-grid") || "rgba(26, 35, 50, 0.09)";
    return {
      accent,
      accentSubtle: hexToRgba(accent, 0.18),
      accentHover,
      card,
      fg,
      fgSecondary,
      chartGrid,
      categoryColors: [
        hexToRgba(accent, 0.82),
        hexToRgba(accent, 0.62),
        hexToRgba(accent, 0.42),
        hexToRgba(accent, 0.22)
      ],
      priorityColors: {
        high: hexToRgba(accent, 0.88),
        medium: hexToRgba(accent, 0.55),
        low: mixFg(fg, 0.38)
      }
    };
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    if (h.length !== 6) return `rgba(13, 148, 136, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const gch = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${gch}, ${b}, ${alpha})`;
  }

  function mixFg(fgHex, alpha) {
    const h = fgHex.replace("#", "");
    if (h.length !== 6) return `rgba(26, 35, 50, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const gch = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${gch}, ${b}, ${alpha})`;
  }

  let colors = chartPalette();
  
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
              color: colors.chartGrid
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
              color: colors.chartGrid
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
              color: colors.chartGrid
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
              color: colors.chartGrid
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
              color: colors.chartGrid
            }
          }
        }
      }
    });
  }

  function onThemeChange() {
    colors = chartPalette();
    refreshAnalytics();
  }

  window.addEventListener("taskflow-themechange", onThemeChange);
  window.addEventListener("storage", (e) => {
    if (e.key === "taskflow-theme") onThemeChange();
  });

  // Load and render all data
  async function loadAnalytics(cohort, startDate, endDate) {
    colors = chartPalette();
    try {
      const [summary, distribution, trends] = await Promise.all([
        AnalyticsAPI.getSummary(cohort, startDate, endDate),
        AnalyticsAPI.getDistribution(cohort, startDate, endDate),
        AnalyticsAPI.getTrends(cohort, startDate, endDate)
      ]);
      
      updateKPIs(summary);
      renderCategoryChart(distribution);
      renderPriorityChart(distribution);
      renderWeeklyProgressChart(trends);
      renderPriorityFocusChart(trends);
      renderDailyVolumeChart(trends);
      renderProductivityScoreChart(trends);
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
