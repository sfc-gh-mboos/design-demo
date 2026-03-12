document.addEventListener("DOMContentLoaded", () => {
  const filters = document.getElementById("filters");
  const viewToggle = document.getElementById("viewToggle");
  const searchInput = document.getElementById("searchInput");
  const taskList = document.getElementById("taskList");
  const listView = document.getElementById("listView");
  const boardView = document.getElementById("boardView");
  const taskCount = document.getElementById("taskCount");
  const dateLabel = document.getElementById("dateLabel");

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
  };

  // --- State ---

  const state = {
    tasks: [],
    filter: "all",
    view: "list",
    searchQuery: "",
  };

  async function loadTasks() {
    state.tasks = await TaskAPI.getAll(state.filter);
    render();
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

  // --- Init ---

  loadTasks();
});
