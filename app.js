document.addEventListener("DOMContentLoaded", () => {
  const filters = document.getElementById("filters");
  const viewToggle = document.getElementById("viewToggle");
  const searchInput = document.getElementById("searchInput");
  const taskList = document.getElementById("taskList");
  const listView = document.getElementById("listView");
  const boardView = document.getElementById("boardView");
  const taskCount = document.getElementById("taskCount");
  const dateLabel = document.getElementById("dateLabel");
  const navLinks = Array.from(document.querySelectorAll("[data-page-link]"));
  const tasksPage = document.getElementById("tasksPage");
  const analyticsPage = document.getElementById("analyticsPage");
  const heatmapMonths = document.getElementById("heatmapMonths");
  const heatmapGrid = document.getElementById("heatmapGrid");
  const currentStreak = document.getElementById("currentStreak");
  const longestStreak = document.getElementById("longestStreak");
  const totalCompletions = document.getElementById("totalCompletions");

  dateLabel.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // --- API layer ---

  const TaskAPI = {
    async getAll(status) {
      const query = status && status !== "all" ? `?status=${status}` : "";
      const res = await fetch(`/api/tasks${query}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch tasks: ${res.statusText}`);
      }
      return res.json();
    },

    async getHeatmap() {
      const res = await fetch("/api/analytics/heatmap");
      if (!res.ok) {
        throw new Error(`Failed to fetch heatmap: ${res.statusText}`);
      }
      return res.json();
    },

    async update(id, data) {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `Failed to update task: ${res.statusText}`);
      }
      return res.json();
    },

    async remove(id) {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to delete task: ${res.statusText}`);
      }
    },
  };

  // --- State ---

  const state = {
    tasks: [],
    filter: "all",
    view: "list",
    searchQuery: "",
    page: getPageFromHash(),
    heatmap: null,
  };

  async function loadTasks() {
    try {
      state.tasks = await TaskAPI.getAll(state.filter);
      render();
    } catch (error) {
      showErrorFeedback(error.message || "Failed to load tasks.");
    }
  }

  async function loadHeatmap() {
    try {
      state.heatmap = await TaskAPI.getHeatmap();
      render();
    } catch (error) {
      showErrorFeedback(error.message || "Failed to load heatmap.");
    }
  }

  // --- UI rendering ---

  const PRIORITY_LABELS = { high: "High", medium: "Med", low: "Low" };
  const BOARD_STATUSES = ["todo", "in-progress", "done"];
  const STATUS_CYCLE = { todo: "in-progress", "in-progress": "done", done: "todo" };

  function getPageFromHash() {
    const page = window.location.hash.replace("#", "").trim().toLowerCase();
    return page === "analytics" ? "analytics" : "tasks";
  }

  function parseISODate(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 3) return null;
    const [year, month, day] = parts.map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function formatISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function getMondayIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  function getIntensityLevel(count, maxCount) {
    if (count <= 0) return 0;
    if (maxCount <= 1) return 4;
    const ratio = count / maxCount;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  }

  function buildMonthLabels(weeks) {
    const labels = [];
    let previousMonth = "";
    weeks.forEach((week, weekIndex) => {
      const inRangeDays = week.filter((day) => day.inRange);
      if (inRangeDays.length === 0) {
        labels.push("");
        return;
      }

      let labelDate = inRangeDays.find((day) => day.date.getDate() === 1)?.date;
      if (!labelDate && weekIndex === 0) {
        labelDate = inRangeDays[0].date;
      }
      if (!labelDate) {
        labels.push("");
        return;
      }

      const monthLabel = labelDate.toLocaleDateString("en-US", { month: "short" });
      if (monthLabel === previousMonth) {
        labels.push("");
        return;
      }

      previousMonth = monthLabel;
      labels.push(monthLabel);
    });
    return labels;
  }

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task-card";
    li.dataset.status = task.status;
    li.dataset.category = task.category.toLowerCase();
    li.dataset.id = task.id;

    li.innerHTML = `
      <div class="status-indicator status-${task.status}"></div>
      <div class="task-body">
        <span class="task-title">${task.title}</span>
        <span class="task-meta">${task.category}</span>
      </div>
      <span class="priority priority-${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>
    `;

    const statusDot = li.querySelector(".status-indicator");
    statusDot.style.cursor = "pointer";
    statusDot.title = "Cycle status";
    statusDot.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleStatus(task);
    });

    return li;
  }

  function render() {
    renderPageChrome();

    if (state.page === "analytics") {
      renderAnalytics();
      return;
    }

    const visibleTasks = getVisibleTasks();
    const count = visibleTasks.length;
    taskCount.textContent = `${count} task${count !== 1 ? "s" : ""}`;

    if (state.view === "board") {
      listView.classList.add("hidden");
      boardView.classList.remove("hidden");
      renderBoard(visibleTasks);
      return;
    }

    listView.classList.remove("hidden");
    boardView.classList.add("hidden");
    taskList.innerHTML = "";
    visibleTasks.forEach((task) => taskList.appendChild(renderTask(task)));
  }

  function renderPageChrome() {
    tasksPage.classList.toggle("hidden", state.page !== "tasks");
    analyticsPage.classList.toggle("hidden", state.page !== "analytics");

    navLinks.forEach((link) => {
      const isActive = link.dataset.pageLink === state.page;
      link.classList.toggle("active", isActive);
      link.setAttribute("aria-current", isActive ? "page" : "false");
    });
  }

  function renderAnalytics() {
    if (!state.heatmap) {
      heatmapMonths.innerHTML = "";
      heatmapGrid.innerHTML = '<p class="heatmap-empty">Loading activity data...</p>';
      currentStreak.textContent = "0";
      longestStreak.textContent = "0";
      totalCompletions.textContent = "0";
      return;
    }

    const summary = state.heatmap.summary || {};
    currentStreak.textContent = String(summary.current_streak || 0);
    longestStreak.textContent = String(summary.longest_streak || 0);
    totalCompletions.textContent = String(summary.total_completions || 0);

    const startDate = parseISODate(state.heatmap.start_date);
    const endDate = parseISODate(state.heatmap.end_date);
    if (!startDate || !endDate) {
      heatmapMonths.innerHTML = "";
      heatmapGrid.innerHTML = '<p class="heatmap-empty">Heatmap data is unavailable.</p>';
      return;
    }

    const countsByDate = new Map(
      (state.heatmap.daily_counts || []).map((entry) => [
        entry.date,
        Number(entry.count) || 0,
      ])
    );
    const maxCount = Math.max(
      0,
      ...(state.heatmap.daily_counts || []).map((entry) => Number(entry.count) || 0)
    );

    const paddedStart = addDays(startDate, -getMondayIndex(startDate));
    const paddedEnd = addDays(endDate, 6 - getMondayIndex(endDate));

    const weeks = [];
    let cursor = new Date(paddedStart);
    while (cursor <= paddedEnd) {
      const week = [];
      for (let i = 0; i < 7; i += 1) {
        const iso = formatISODate(cursor);
        const inRange = cursor >= startDate && cursor <= endDate;
        week.push({
          date: new Date(cursor),
          iso,
          count: countsByDate.get(iso) || 0,
          inRange,
        });
        cursor = addDays(cursor, 1);
      }
      weeks.push(week);
    }

    const monthLabels = buildMonthLabels(weeks);
    heatmapMonths.innerHTML = "";
    heatmapMonths.style.gridTemplateColumns = `repeat(${weeks.length}, var(--heatmap-cell-size))`;
    monthLabels.forEach((monthText) => {
      const month = document.createElement("span");
      month.className = "heatmap-month-label";
      month.textContent = monthText;
      heatmapMonths.appendChild(month);
    });

    heatmapGrid.innerHTML = "";
    heatmapGrid.style.gridTemplateColumns = `repeat(${weeks.length}, var(--heatmap-cell-size))`;
    weeks.forEach((week) => {
      week.forEach((day) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `heatmap-cell intensity-${getIntensityLevel(day.count, maxCount)}`;
        cell.setAttribute("aria-label", `${day.iso}: ${day.count} completed task${day.count !== 1 ? "s" : ""}`);
        if (!day.inRange) {
          cell.classList.add("heatmap-cell-padding");
          cell.disabled = true;
        } else {
          const dateLabel = day.date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          cell.title = `${dateLabel}: ${day.count} task${day.count !== 1 ? "s" : ""} completed`;
        }
        heatmapGrid.appendChild(cell);
      });
    });
  }

  function renderBoardTask(task) {
    const item = document.createElement("article");
    item.className = "board-task-card";
    item.draggable = true;
    item.dataset.taskId = task.id;
    item.dataset.status = task.status;

    const priorityLabel = PRIORITY_LABELS[task.priority] || task.priority;
    const isDone = task.status === "done";

    item.innerHTML = `
      <div class="board-task-header">
        <span class="board-task-title ${isDone ? "done" : ""}">${task.title}</span>
        <span class="board-task-priority priority-${task.priority}">${priorityLabel}</span>
      </div>
      <span class="board-task-meta">${task.category}</span>
    `;

    item.addEventListener("dragstart", handleDragStart);
    item.addEventListener("dragend", handleDragEnd);

    return item;
  }

  function getVisibleTasks() {
    const query = state.searchQuery.trim().toLowerCase();
    if (!query) return state.tasks;
    return state.tasks.filter((task) => {
      const title = String(task.title || "").toLowerCase();
      const category = String(task.category || "").toLowerCase();
      return title.includes(query) || category.includes(query);
    });
  }

  let columnDropZonesSetup = false;

  function renderBoard(tasks) {
    BOARD_STATUSES.forEach((status) => {
      const tasksForColumn = tasks.filter((task) => task.status === status);
      const countNode = boardView.querySelector(`[data-column-count="${status}"]`);
      const bodyNode = boardView.querySelector(`[data-column-body="${status}"]`);
      const columnNode = boardView.querySelector(`[data-board-column="${status}"]`);

      if (!countNode || !bodyNode || !columnNode) return;

      countNode.textContent = String(tasksForColumn.length);
      bodyNode.innerHTML = "";

      if (tasksForColumn.length === 0) {
        const placeholder = document.createElement("p");
        placeholder.className = "board-column-placeholder";
        placeholder.textContent = "No tasks";
        bodyNode.appendChild(placeholder);
      } else {
        tasksForColumn.forEach((task) => bodyNode.appendChild(renderBoardTask(task)));
      }
    });

    if (!columnDropZonesSetup || state.view === "board") {
      setupAllColumnDropZones();
      columnDropZonesSetup = true;
    }
  }

  function setupAllColumnDropZones() {
    BOARD_STATUSES.forEach((status) => {
      const columnNode = boardView.querySelector(`[data-board-column="${status}"]`);
      if (columnNode) {
        setupColumnDropZone(columnNode, status);
      }
    });
  }

  // --- Actions ---

  async function cycleStatus(task) {
    const nextStatus = STATUS_CYCLE[task.status];
    await TaskAPI.update(task.id, { status: nextStatus });
    await loadTasks();
    if (state.heatmap) {
      await loadHeatmap();
    }
  }

  function setPage(page, syncHash = true) {
    const nextPage = page === "analytics" ? "analytics" : "tasks";
    state.page = nextPage;
    if (syncHash) {
      const nextHash = `#${nextPage}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
      }
    }
    render();
    if (nextPage === "analytics" && !state.heatmap) {
      loadHeatmap();
    }
  }

  // --- Drag and Drop (KN-5) ---

  let draggedTask = null;
  let draggedTaskElement = null;

  function handleDragStart(e) {
    draggedTaskElement = e.target;
    draggedTaskElement.classList.add("dragging");
    draggedTask = {
      id: parseInt(draggedTaskElement.dataset.taskId, 10),
      status: draggedTaskElement.dataset.status,
    };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", draggedTaskElement.outerHTML);

    BOARD_STATUSES.forEach((status) => {
      const column = boardView.querySelector(`[data-board-column="${status}"]`);
      if (column) {
        column.classList.add("drag-target");
      }
    });
  }

  function handleDragEnd() {
    if (draggedTaskElement) {
      draggedTaskElement.classList.remove("dragging");
    }

    BOARD_STATUSES.forEach((status) => {
      const column = boardView.querySelector(`[data-board-column="${status}"]`);
      if (column) {
        column.classList.remove("drag-target", "drag-over");
      }
    });

    draggedTask = null;
    draggedTaskElement = null;
  }

  function setupColumnDropZone(columnNode, status) {
    const newColumn = columnNode.cloneNode(true);
    columnNode.parentNode.replaceChild(newColumn, columnNode);

    newColumn.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      newColumn.classList.add("drag-over");
    });

    newColumn.addEventListener("dragleave", (e) => {
      if (!newColumn.contains(e.relatedTarget)) {
        newColumn.classList.remove("drag-over");
      }
    });

    newColumn.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      newColumn.classList.remove("drag-over");

      if (!draggedTask || draggedTask.status === status) {
        return;
      }

      const originalTask = state.tasks.find((t) => t.id === draggedTask.id);
      if (!originalTask) return;

      const originalStatus = originalTask.status;
      originalTask.status = status;

      const visibleTasks = getVisibleTasks();
      renderBoard(visibleTasks);

      try {
        const response = await TaskAPI.update(draggedTask.id, { status });
        if (response.error) {
          throw new Error(response.error);
        }
        await loadTasks();
        if (state.heatmap) {
          await loadHeatmap();
        }
      } catch (error) {
        originalTask.status = originalStatus;
        await loadTasks();
        showErrorFeedback("Failed to update task status. Please try again.");
      }
    });
  }

  function showErrorFeedback(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-feedback";
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  function setFilter(filter) {
    const currentActive = filters.querySelector(".active");
    if (currentActive) {
      currentActive.classList.remove("active");
    }

    const nextActive = filters.querySelector(`[data-filter="${filter}"]`);
    if (nextActive) {
      nextActive.classList.add("active");
    }

    state.filter = filter;
  }

  function setView(view) {
    state.view = view;
    const buttons = viewToggle.querySelectorAll(".view-toggle-btn");
    buttons.forEach((button) => {
      const isActive = button.dataset.view === view;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    if (view === "board") {
      columnDropZonesSetup = false;
    }
    render();
  }

  // --- Event listeners ---

  filters.addEventListener("click", (e) => {
    if (!e.target.matches(".filter-btn")) return;
    setFilter(e.target.dataset.filter);
    loadTasks();
  });

  viewToggle.addEventListener("click", (e) => {
    if (!e.target.matches(".view-toggle-btn")) return;
    setView(e.target.dataset.view);
  });

  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value || "";
    render();
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      setPage(link.dataset.pageLink, true);
    });
  });

  window.addEventListener("hashchange", () => {
    setPage(getPageFromHash(), false);
  });

  // --- Init ---

  loadTasks();
  setPage(state.page, true);
});
