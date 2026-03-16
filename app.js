document.addEventListener("DOMContentLoaded", () => {
  const filters = document.getElementById("filters");
  const viewToggle = document.getElementById("viewToggle");
  const searchInput = document.getElementById("searchInput");
  const taskList = document.getElementById("taskList");
  const listView = document.getElementById("listView");
  const boardView = document.getElementById("boardView");
  const taskCount = document.getElementById("taskCount");
  const dateLabel = document.getElementById("dateLabel");
  const navLinks = document.querySelectorAll("[data-page-link]");
  const tasksPage = document.getElementById("tasksPage");
  const analyticsPage = document.getElementById("analyticsPage");
  const currentStreak = document.getElementById("currentStreak");
  const longestStreak = document.getElementById("longestStreak");
  const totalCompletions = document.getElementById("totalCompletions");
  const heatmapMonths = document.getElementById("heatmapMonths");
  const heatmapYAxis = document.getElementById("heatmapYAxis");
  const heatmapGrid = document.getElementById("heatmapGrid");
  const container = document.querySelector(".container");

  dateLabel.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

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

  const state = {
    tasks: [],
    filter: "all",
    view: "list",
    searchQuery: "",
    page: "tasks",
    heatmap: null,
  };

  const PRIORITY_LABELS = { high: "High", medium: "Med", low: "Low" };
  const BOARD_STATUSES = ["todo", "in-progress", "done"];
  const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
  const STATUS_CYCLE = { todo: "in-progress", "in-progress": "done", done: "todo" };

  async function loadTasks() {
    state.tasks = await TaskAPI.getAll(state.filter);
    renderTasks();
  }

  async function loadHeatmap() {
    state.heatmap = await TaskAPI.getHeatmap();
    renderHeatmap();
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

  function getVisibleTasks() {
    const query = state.searchQuery.trim().toLowerCase();
    if (!query) return state.tasks;
    return state.tasks.filter((task) => {
      const title = String(task.title || "").toLowerCase();
      const category = String(task.category || "").toLowerCase();
      return title.includes(query) || category.includes(query);
    });
  }

  function renderTasks() {
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

  function getDateLabel(dateString) {
    const d = new Date(`${dateString}T00:00:00`);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function heatmapLevel(count, maxCount) {
    if (count <= 0 || maxCount <= 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.2) return 1;
    if (ratio <= 0.4) return 2;
    if (ratio <= 0.6) return 3;
    if (ratio <= 0.8) return 4;
    return 5;
  }

  function groupWeeks(days) {
    const weeks = [];
    let currentWeek = null;
    let currentWeekKey = null;

    days.forEach((day) => {
      const date = new Date(`${day.date}T00:00:00`);
      const weekdayMondayFirst = (date.getDay() + 6) % 7;
      const monday = new Date(date);
      monday.setDate(date.getDate() - weekdayMondayFirst);
      const weekKey = monday.toISOString().slice(0, 10);

      if (weekKey !== currentWeekKey) {
        currentWeekKey = weekKey;
        currentWeek = new Array(7).fill(null);
        weeks.push({ key: weekKey, days: currentWeek });
      }

      currentWeek[weekdayMondayFirst] = day;
    });

    return weeks;
  }

  function renderHeatmap() {
    if (!state.heatmap || !Array.isArray(state.heatmap.days)) return;

    const days = state.heatmap.days;
    const summary = state.heatmap.summary || {};
    currentStreak.textContent = String(summary.current_streak || 0);
    longestStreak.textContent = String(summary.longest_streak || 0);
    totalCompletions.textContent = String(summary.total_completions || 0);

    heatmapYAxis.innerHTML = "";
    WEEKDAY_LABELS.forEach((label) => {
      const el = document.createElement("span");
      el.textContent = label;
      heatmapYAxis.appendChild(el);
    });

    const weeks = groupWeeks(days);
    const counts = days.map((day) => day.count);
    const maxCount = Math.max(0, ...counts);

    heatmapMonths.innerHTML = "";
    heatmapMonths.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;
    let previousMonth = "";
    weeks.forEach((week, idx) => {
      const monthNode = document.createElement("span");
      monthNode.className = "heatmap-month-label";
      monthNode.style.gridColumn = String(idx + 1);
      const monthAnchor = week.days.find((entry) => entry) || null;
      if (!monthAnchor) return;
      const monthDate = new Date(`${monthAnchor.date}T00:00:00`);
      const monthText = monthDate.toLocaleDateString("en-US", { month: "short" });
      monthNode.textContent = monthText !== previousMonth ? monthText : "";
      previousMonth = monthText;
      heatmapMonths.appendChild(monthNode);
    });

    heatmapGrid.innerHTML = "";
    heatmapGrid.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;
    heatmapGrid.style.gridTemplateRows = "repeat(7, 1fr)";

    weeks.forEach((week, weekIndex) => {
      for (let weekdayIndex = 0; weekdayIndex < 7; weekdayIndex += 1) {
        const day = week.days[weekdayIndex];
        const cell = document.createElement("div");
        const count = day ? day.count : 0;
        const date = day ? day.date : "";
        const level = heatmapLevel(count, maxCount);
        cell.className = `heatmap-cell level-${level}`;
        cell.style.gridColumn = String(weekIndex + 1);
        cell.style.gridRow = String(weekdayIndex + 1);
        cell.setAttribute("role", "gridcell");
        if (day) {
          const unit = count === 1 ? "task" : "tasks";
          cell.title = `${getDateLabel(date)}: ${count} completed ${unit}`;
          cell.dataset.date = date;
          cell.dataset.count = String(count);
        }
        heatmapGrid.appendChild(cell);
      }
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

  async function cycleStatus(task) {
    const nextStatus = STATUS_CYCLE[task.status];
    await TaskAPI.update(task.id, { status: nextStatus });
    await loadTasks();
    if (state.page === "analytics") {
      await loadHeatmap();
    }
  }

  let draggedTask = null;
  let draggedTaskElement = null;
  let draggedFromStatus = null;

  function handleDragStart(e) {
    draggedTaskElement = e.target;
    draggedTaskElement.classList.add("dragging");
    draggedTask = {
      id: parseInt(draggedTaskElement.dataset.taskId, 10),
      status: draggedTaskElement.dataset.status,
    };
    draggedFromStatus = draggedTask.status;
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
    draggedTaskElement.classList.remove("dragging");

    BOARD_STATUSES.forEach((status) => {
      const column = boardView.querySelector(`[data-board-column="${status}"]`);
      if (column) {
        column.classList.remove("drag-target", "drag-over");
      }
    });

    draggedTask = null;
    draggedTaskElement = null;
    draggedFromStatus = null;
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

      const originalTask = state.tasks.find((task) => task.id === draggedTask.id);
      if (!originalTask) return;

      const originalStatus = originalTask.status;
      originalTask.status = status;
      renderBoard(getVisibleTasks());

      try {
        const response = await TaskAPI.update(draggedTask.id, { status });
        if (response.error) {
          throw new Error(response.error);
        }
        await loadTasks();
        if (state.page === "analytics") {
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
    if (currentActive) currentActive.classList.remove("active");
    const nextActive = filters.querySelector(`[data-filter="${filter}"]`);
    if (nextActive) nextActive.classList.add("active");
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
    renderTasks();
  }

  async function setPage(nextPage) {
    state.page = nextPage;
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.pageLink === nextPage);
    });

    const showTasks = nextPage === "tasks";
    tasksPage.classList.toggle("hidden", !showTasks);
    analyticsPage.classList.toggle("hidden", showTasks);
    container.classList.toggle("analytics-mode", !showTasks);

    if (!showTasks) {
      try {
        await loadHeatmap();
      } catch (error) {
        showErrorFeedback("Failed to load heatmap.");
      }
    }
  }

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
    renderTasks();
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      const targetPage = link.dataset.pageLink === "analytics" ? "analytics" : "tasks";
      await setPage(targetPage);
    });
  });

  loadTasks();
});
