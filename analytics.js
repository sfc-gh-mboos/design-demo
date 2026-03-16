document.addEventListener("DOMContentLoaded", () => {
  const cohortFilter = document.getElementById("cohortFilter");
  
  // Chart instances (will be created on first load)
  let categoryChart = null;
  let priorityChart = null;
  let weeklyProgressChart = null;
  let priorityFocusChart = null;
  let productivityScoreChart = null;
  
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
    async getSummary(cohort) {
      const res = await fetch(`/api/analytics/summary?cohort=${cohort}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch summary: ${res.statusText}`);
      }
      return res.json();
    },
    
    async getDistribution(cohort) {
      const res = await fetch(`/api/analytics/distribution?cohort=${cohort}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch distribution: ${res.statusText}`);
      }
      return res.json();
    },
    
    async getTrends(cohort) {
      const res = await fetch(`/api/analytics/trends?cohort=${cohort}`);
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
  
  // Load and render all data
  async function loadAnalytics(cohort) {
    try {
      const [summary, distribution, trends] = await Promise.all([
        AnalyticsAPI.getSummary(cohort),
        AnalyticsAPI.getDistribution(cohort),
        AnalyticsAPI.getTrends(cohort)
      ]);
      
      updateKPIs(summary);
      renderCategoryChart(distribution);
      renderPriorityChart(distribution);
      renderWeeklyProgressChart(trends);
      renderPriorityFocusChart(trends);
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
  
  // Initial load
  loadAnalytics(cohortFilter.value);
  
  // Cohort filter change handler
  cohortFilter.addEventListener("change", (e) => {
    loadAnalytics(e.target.value);
  });
});
