document.addEventListener("DOMContentLoaded", () => {
  const topbarNav = document.querySelector(".topbar-nav");
  const filters = document.getElementById("filters");
  const viewToggle = document.getElementById("viewToggle");
  const searchInput = document.getElementById("searchInput");
  const taskList = document.getElementById("taskList");
  const listView = document.getElementById("listView");
  const boardView = document.getElementById("boardView");
  const taskCount = document.getElementById("taskCount");
  const dateLabel = document.getElementById("dateLabel");
  const tasksPanel = document.getElementById("tasksPanel");
  const analyticsPanel = document.getElementById("analyticsPanel");
  const heatmapGrid = document.getElementById("heatmapGrid");
  const heatmapMonths = document.getElementById("heatmapMonths");
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

    async getHeatmap() {
      const res = await fetch("/api/analytics/heatmap");
      if (!res.ok) {
        throw new Error(`Failed to fetch heatmap data: ${res.statusText}`);
      }
      return res.json();
    },
  };

  // --- State ---

  const state = {
    tasks: [],
    filter: "all",
    view: "list",
    searchQuery: "",
    page: "tasks",
    heatmap: null,
  };

  async function loadTasks() {
    state.tasks = await TaskAPI.getAll(state.filter);
    render();
  }

  async function loadHeatmap() {
    state.heatmap = await TaskAPI.getHeatmap();
    if (state.page === "analytics") {
      renderHeatmap();
    }
  }

  // --- UI rendering ---

  const PRIORITY_LABELS = { high: "High", medium: "Med", low: "Low" };
  const BOARD_STATUSES = ["todo", "in-progress", "done"];

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
    const showTasks = state.page === "tasks";
    tasksPanel.classList.toggle("hidden", !showTasks);
    analyticsPanel.classList.toggle("hidden", showTasks);

    if (!showTasks) {
      renderHeatmap();
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

  function renderHeatmap() {
    const data = state.heatmap;
    if (!data) {
      currentStreak.textContent = "0";
      longestStreak.textContent = "0";
      totalCompletions.textContent = "0";
      heatmapGrid.innerHTML = "";
      heatmapMonths.innerHTML = "";
      return;
    }

    const summary = data.summary || {};
    currentStreak.textContent = String(summary.current_streak || 0);
    longestStreak.textContent = String(summary.longest_streak || 0);
    totalCompletions.textContent = String(summary.total_completions || 0);

    const dailyCounts = Array.isArray(data.daily_counts) ? data.daily_counts : [];
    if (!dailyCounts.length) {
      heatmapGrid.innerHTML = "";
      heatmapMonths.innerHTML = "";
      return;
    }

    const weeks = [];
    for (let i = 0; i < dailyCounts.length; i += 7) {
      weeks.push(dailyCounts.slice(i, i + 7));
    }

    const maxCount = Math.max(0, ...dailyCounts.map((entry) => Number(entry.count) || 0));
    const today = data.today || "";

    heatmapGrid.innerHTML = "";
    heatmapMonths.innerHTML = "";
    heatmapGrid.style.setProperty("--heatmap-columns", String(weeks.length));
    heatmapMonths.style.setProperty("--heatmap-columns", String(weeks.length));

    let previousMonthLabel = "";
    weeks.forEach((week) => {
      const monthLabel = formatMonth(week[0]?.date);
      const labelNode = document.createElement("span");
      labelNode.className = "heatmap-month-label";
      labelNode.textContent = monthLabel !== previousMonthLabel ? monthLabel : "";
      previousMonthLabel = monthLabel;
      heatmapMonths.appendChild(labelNode);
    });

    weeks.forEach((week) => {
      week.forEach((day) => {
        const count = Number(day.count) || 0;
        const date = day.date;
        const isFuture = today && date > today;
        const cell = document.createElement("div");
        cell.className = "heatmap-cell";
        if (isFuture) {
          cell.classList.add("future");
        }
        cell.setAttribute("role", "gridcell");
        cell.title = `${formatDate(date)}: ${count} task${count === 1 ? "" : "s"} completed`;

        if (count === 0 || isFuture) {
          cell.style.backgroundColor = "var(--card)";
        } else {
          const opacity = maxCount > 0 ? 0.2 + (count / maxCount) * 0.8 : 0.2;
          cell.style.backgroundColor = `rgba(245, 78, 0, ${Math.min(opacity, 1).toFixed(2)})`;
        }
        heatmapGrid.appendChild(cell);
      });
    });
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatMonth(dateString) {
    if (!dateString) return "";
    return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
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
        <span class="board-task-title ${isDone ? 'done' : ''}">${task.title}</span>
        <span class="board-task-priority priority-${task.priority}">${priorityLabel}</span>
      </div>
      <span class="board-task-meta">${task.category}</span>
    `;
    
    // Add drag event listeners
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

      // Update column count (reflects visible tasks after filtering)
      countNode.textContent = String(tasksForColumn.length);
      
      // Clear and repopulate column body
      bodyNode.innerHTML = "";
      
      // Handle empty state
      if (tasksForColumn.length === 0) {
        const placeholder = document.createElement("p");
        placeholder.className = "board-column-placeholder";
        placeholder.textContent = "No tasks";
        bodyNode.appendChild(placeholder);
      } else {
        // Render tasks in column
        tasksForColumn.forEach((task) => bodyNode.appendChild(renderBoardTask(task)));
      }
    });
    
    // Set up drop zones once (or re-setup if needed)
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

  const STATUS_CYCLE = { todo: "in-progress", "in-progress": "done", done: "todo" };

  async function cycleStatus(task) {
    const nextStatus = STATUS_CYCLE[task.status];
    await TaskAPI.update(task.id, { status: nextStatus });
    state.heatmap = null;
    await loadTasks();
  }

  // --- Drag and Drop (KN-5) ---

  let draggedTask = null;
  let draggedTaskElement = null;
  let draggedFromStatus = null;

  function handleDragStart(e) {
    draggedTaskElement = e.target;
    draggedTaskElement.classList.add("dragging");
    draggedTask = {
      id: parseInt(draggedTaskElement.dataset.taskId),
      status: draggedTaskElement.dataset.status,
    };
    draggedFromStatus = draggedTask.status;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", draggedTaskElement.outerHTML);
    
    // Add visual feedback to all columns
    BOARD_STATUSES.forEach((status) => {
      const column = boardView.querySelector(`[data-board-column="${status}"]`);
      if (column) {
        column.classList.add("drag-target");
      }
    });
  }

  function handleDragEnd(e) {
    draggedTaskElement.classList.remove("dragging");
    
    // Remove visual feedback from all columns
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
    // Remove existing event listeners by replacing with a clone
    const newColumn = columnNode.cloneNode(true);
    columnNode.parentNode.replaceChild(newColumn, columnNode);
    
    const bodyNode = newColumn.querySelector(`[data-column-body="${status}"]`);
    
    newColumn.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      newColumn.classList.add("drag-over");
    });
    
    newColumn.addEventListener("dragleave", (e) => {
      // Only remove drag-over if we're actually leaving the column
      if (!newColumn.contains(e.relatedTarget)) {
        newColumn.classList.remove("drag-over");
      }
    });
    
    newColumn.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      newColumn.classList.remove("drag-over");
      
      if (!draggedTask || draggedTask.status === status) {
        return; // No change needed
      }
      
      // Optimistic update: move card immediately in UI
      const originalTask = state.tasks.find((t) => t.id === draggedTask.id);
      if (!originalTask) return;
      
      const originalStatus = originalTask.status;
      originalTask.status = status; // Optimistic update to state
      
      // Immediately re-render board with new status
      const visibleTasks = getVisibleTasks();
      renderBoard(visibleTasks);
      
      // Persist change via API
      try {
        const response = await TaskAPI.update(draggedTask.id, { status });
        if (response.error) {
          throw new Error(response.error);
        }
        state.heatmap = null;
        // Refresh to ensure consistency with server
        await loadTasks();
      } catch (error) {
        // Rollback on failure
        originalTask.status = originalStatus;
        await loadTasks();
        
        // Show error feedback
        showErrorFeedback("Failed to update task status. Please try again.");
      }
    });
  }

  function showErrorFeedback(message) {
    // Create a temporary error message element
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-feedback";
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Remove after 3 seconds
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
    // Reset drop zones setup when switching views
    if (view === "board") {
      columnDropZonesSetup = false;
    }
    render();
  }

  function setPage(page) {
    state.page = page;
    const navLinks = topbarNav.querySelectorAll("[data-nav-view]");
    navLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.navView === page);
    });
    render();
    if (page === "analytics" && !state.heatmap) {
      loadHeatmap().catch(() => {
        showErrorFeedback("Failed to load heatmap data. Please try again.");
      });
    }
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

  topbarNav.addEventListener("click", (e) => {
    const navLink = e.target.closest("[data-nav-view]");
    if (!navLink) return;
    e.preventDefault();
    setPage(navLink.dataset.navView);
  });

  // --- Init ---

  loadTasks();
});
