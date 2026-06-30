document.addEventListener("DOMContentLoaded", () => {
  const recapCompleted = document.getElementById("recapCompleted");
  const recapCreated = document.getElementById("recapCreated");
  const recapCompletionRate = document.getElementById("recapCompletionRate");
  const recapAvgDays = document.getElementById("recapAvgDays");
  const recapTopCategory = document.getElementById("recapTopCategory");
  const recapTopCategoryCard = document.getElementById("recapTopCategoryCard");
  const recapDailyRow = document.getElementById("recapDailyRow");
  const recapEmptyState = document.getElementById("recapEmptyState");
  const recapRangeLabel = document.getElementById("recapRangeLabel");

  function formatShortDate(dateStr) {
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function formatRangeLabel(start, end) {
    return `${formatShortDate(start)} – ${formatShortDate(end)}`;
  }

  function renderDailyBreakdown(daily) {
    recapDailyRow.innerHTML = "";
    const maxCompleted = Math.max(...daily.map((day) => day.completed), 1);

    daily.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "recap-daily-cell";

      const barWrap = document.createElement("div");
      barWrap.className = "recap-daily-bar-wrap";
      barWrap.setAttribute("aria-label", `${day.completed} completions on ${day.date}`);

      const bar = document.createElement("div");
      bar.className = "recap-daily-bar";
      const heightPct = day.completed > 0 ? Math.max(12, (day.completed / maxCompleted) * 100) : 0;
      bar.style.height = `${heightPct}%`;
      barWrap.appendChild(bar);

      const count = document.createElement("div");
      count.className = "recap-daily-count";
      count.textContent = String(day.completed);

      const label = document.createElement("div");
      label.className = "recap-daily-label";
      label.textContent = formatShortDate(day.date);

      cell.appendChild(barWrap);
      cell.appendChild(count);
      cell.appendChild(label);
      recapDailyRow.appendChild(cell);
    });
  }

  function renderRecap(data) {
    const { summary, daily, range } = data;

    recapCompleted.textContent = summary.completed;
    recapCreated.textContent = summary.created;
    recapCompletionRate.textContent = `${summary.completion_rate}%`;
    recapAvgDays.textContent = summary.avg_days_to_complete;

    if (summary.top_category) {
      recapTopCategory.textContent = summary.top_category;
      recapTopCategoryCard.classList.remove("recap-highlight-card--empty");
    } else {
      recapTopCategory.textContent = "None yet";
      recapTopCategoryCard.classList.add("recap-highlight-card--empty");
    }

    recapRangeLabel.textContent = formatRangeLabel(range.start, range.end);
    renderDailyBreakdown(daily);

    const hasActivity = summary.completed > 0 || summary.created > 0;
    recapEmptyState.classList.toggle("hidden", hasActivity);
  }

  async function loadRecap() {
    try {
      const res = await fetch("/api/analytics/weekly-recap");
      if (!res.ok) {
        throw new Error(`Failed to fetch weekly recap: ${res.statusText}`);
      }
      const data = await res.json();
      renderRecap(data);
    } catch (error) {
      console.error("Failed to load weekly recap:", error);
      const errorDiv = document.createElement("div");
      errorDiv.className = "error-feedback";
      errorDiv.textContent = "Failed to load weekly recap. Please refresh the page.";
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }

  loadRecap();
});
