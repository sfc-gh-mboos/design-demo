document.addEventListener("DOMContentLoaded", () => {
  const filters = document.getElementById("filters");
  const viewToggle = document.getElementById("viewToggle");
  const taskList = document.getElementById("taskList");
  const listView = document.getElementById("listView");
  const boardView = document.getElementById("boardView");
  const dateLabel = document.getElementById("dateLabel");
  const assistMessage = document.getElementById("assistMessage");
  const assistActions = document.getElementById("assistActions");
  const quickAddForm = document.getElementById("quickAddForm");
  const quickAddInput = document.getElementById("quickAddInput");
  const openPaletteBtn = document.getElementById("openPaletteBtn");

  if (dateLabel) {
    const now = new Date();
    dateLabel.dateTime = now.toISOString().slice(0, 10);
    dateLabel.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  const heroGreeting = document.getElementById("heroGreeting");
  if (heroGreeting) {
    const h = new Date().getHours();
    heroGreeting.textContent =
      h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  const HERO_RING_C = 2 * Math.PI * 52;

  function updateHero(tasks) {
    const ring = document.getElementById("heroRingArc");
    if (!ring) return;

    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const total = tasks.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const todoEl = document.getElementById("heroStatTodo");
    const progEl = document.getElementById("heroStatProgress");
    const doneEl = document.getElementById("heroStatDone");
    const pctEl = document.getElementById("heroPct");
    if (todoEl) todoEl.textContent = String(todo);
    if (progEl) progEl.textContent = String(inProgress);
    if (doneEl) doneEl.textContent = String(done);
    if (pctEl) pctEl.textContent = String(pct);

    const dash = (pct / 100) * HERO_RING_C;
    ring.style.strokeDasharray = `${dash} ${HERO_RING_C}`;
  }

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

    async create(data) {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `Failed to create task: ${res.statusText}`);
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
  };

  function syncUrl() {
    const params = new URLSearchParams(window.location.search);
    if (state.filter && state.filter !== "all") {
      params.set("filter", state.filter);
    } else {
      params.delete("filter");
    }
    if (state.view && state.view !== "list") {
      params.set("view", state.view);
    } else {
      params.delete("view");
    }
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState({}, "", next);
  }

  function applyUrlToState() {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get("filter");
    const view = params.get("view");
    if (filter && ["all", "todo", "in-progress", "done"].includes(filter)) {
      setFilter(filter, { skipUrl: true });
    }
    if (view === "list" || view === "board") {
      setView(view, { skipUrl: true });
    }
  }

  function updateAssistStrip(tasks) {
    if (!assistMessage || !assistActions) return;

    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const highTodo = tasks.filter((t) => t.status !== "done" && t.priority === "high").length;

    assistActions.innerHTML = "";

    if (tasks.length === 0) {
      assistMessage.textContent =
        "No tasks yet. Use the quick add bar above or open the full form for category and priority.";
      return;
    }

    if (highTodo > 0 && state.filter === "all") {
      assistMessage.textContent = `You have ${highTodo} open high-priority task${highTodo > 1 ? "s" : ""}. Jump to your to-do list to tackle them first.`;
      addAssistAction("Open to-do list", () => {
        setFilter("todo");
        loadTasks();
        if (window.TaskflowAssist) {
          TaskflowAssist.showToast("Filtered to To Do — High priority is labeled on each row.");
        }
      });
    } else if (inProgress > 4) {
      assistMessage.textContent = `${inProgress} tasks are in progress. Consider finishing or moving some back to To Do.`;
      addAssistAction("View board", () => {
        setView("board");
        syncUrl();
      });
    } else if (todo > 0 && inProgress === 0) {
      assistMessage.textContent = `${todo} task${todo > 1 ? "s are" : " is"} still to do. Pick one and move it to In progress when you start.`;
      addAssistAction("Open board", () => {
        setView("board");
        syncUrl();
      });
    } else {
      assistMessage.textContent =
        "You are on track. Click the dot on a task to cycle status, or drag cards on the board.";
    }

    addAssistAction("Analytics", () => {
      window.location.href = "/analytics";
    });
  }

  function addAssistAction(label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "assist-chip";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    assistActions.appendChild(btn);
  }

  async function loadTasks() {
    state.tasks = await TaskAPI.getAll(state.filter);
    updateAssistStrip(state.tasks);
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
    updateHero(visibleTasks);
    if (state.view === "board") {
      listView.classList.add("hidden");
      boardView.classList.remove("hidden");
      renderBoard(visibleTasks);
      return;
    }

    listView.classList.remove("hidden");
    boardView.classList.add("hidden");
    taskList.innerHTML = "";
    if (visibleTasks.length === 0) {
      const empty = document.createElement("li");
      empty.className = "task-empty";
      empty.setAttribute("role", "status");
      empty.innerHTML =
        '<p class="task-empty-title">Nothing here</p><p class="task-empty-desc">Try another filter or add a task with the bar above.</p>';
      taskList.appendChild(empty);
      return;
    }
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
    return state.tasks;
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
    
    // Set up drop zones once
    if (!columnDropZonesSetup) {
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
    if (columnNode._dropZoneReady) return;
    columnNode._dropZoneReady = true;

    columnNode.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      columnNode.classList.add("drag-over");
    });
    
    columnNode.addEventListener("dragleave", (e) => {
      if (!columnNode.contains(e.relatedTarget)) {
        columnNode.classList.remove("drag-over");
      }
    });
    
    columnNode.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      columnNode.classList.remove("drag-over");

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

  function setFilter(filter, opts) {
    const skipUrl = opts && opts.skipUrl;

    const currentActive = filters.querySelector(".active");
    if (currentActive) {
      currentActive.classList.remove("active");
      currentActive.setAttribute("aria-selected", "false");
    }

    const nextActive = filters.querySelector(`[data-filter="${filter}"]`);
    if (nextActive) {
      nextActive.classList.add("active");
      nextActive.setAttribute("aria-selected", "true");
    }

    state.filter = filter;
    if (!skipUrl) syncUrl();
  }

  function setView(view, opts) {
    const skipUrl = opts && opts.skipUrl;
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
    if (!skipUrl) syncUrl();
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
    syncUrl();
  });

  // --- Add Task Modal ---

  const addTaskBtn = document.getElementById("addTaskBtn");
  const addTaskModal = document.getElementById("addTaskModal");
  const addTaskForm = document.getElementById("addTaskForm");
  const modalClose = document.getElementById("modalClose");
  const taskTitleInput = document.getElementById("taskTitleInput");

  function openModal() {
    addTaskModal.classList.remove("hidden");
    taskTitleInput.focus();
  }

  function closeModal() {
    addTaskModal.classList.add("hidden");
    addTaskForm.reset();
  }

  addTaskBtn.addEventListener("click", openModal);
  modalClose.addEventListener("click", closeModal);

  addTaskModal.addEventListener("click", (e) => {
    if (e.target === addTaskModal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !addTaskModal.classList.contains("hidden")) {
      closeModal();
    }
  });

  addTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) return;

    const category = document.getElementById("taskCategorySelect").value;
    const priority = document.getElementById("taskPrioritySelect").value;

    try {
      await TaskAPI.create({ title, category, priority });
      closeModal();
      await loadTasks();
    } catch (err) {
      showErrorFeedback(err.message || "Failed to add task.");
    }
  });

  // --- Quick add ---

  if (quickAddForm && quickAddInput) {
    quickAddForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = quickAddInput.value.trim();
      if (!title) return;
      const category = document.getElementById("quickAddCategory").value;
      const priority = document.getElementById("quickAddPriority").value;
      try {
        await TaskAPI.create({ title, category, priority });
        quickAddInput.value = "";
        quickAddInput.focus();
        await loadTasks();
        if (window.TaskflowAssist) {
          TaskflowAssist.showToast("Task added");
        }
      } catch (err) {
        showErrorFeedback(err.message || "Failed to add task.");
      }
    });
  }

  // --- Command palette & assist ---

  function isMac() {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || navigator.userAgent.includes("Mac");
  }

  const modK = isMac() ? "⌘K" : "Ctrl+K";

  if (openPaletteBtn) {
    openPaletteBtn.querySelector(".palette-kbd").textContent = modK;
    openPaletteBtn.setAttribute("title", `Quick actions (${modK})`);
    openPaletteBtn.addEventListener("click", () => {
      if (window.TaskflowAssist) TaskflowAssist.openPalette();
    });
  }

  const heroSub = document.querySelector(".hero-subtitle");
  if (heroSub) {
    heroSub.innerHTML = `Tip: press <kbd class="inline-kbd">${modK}</kbd> anytime for navigation and shortcuts.`;
  }

  if (window.TaskflowAssist) {
    TaskflowAssist.init({
      commands: [
        {
          label: "Go to Tasks",
          keywords: ["home", "tasks"],
          hint: "Navigate",
          run: () => {
            window.location.href = "/";
          },
        },
        {
          label: "Go to Analytics",
          keywords: ["charts", "dashboard", "stats"],
          hint: "Navigate",
          run: () => {
            window.location.href = "/analytics";
          },
        },
        {
          label: "Add task (full form)",
          keywords: ["new", "create", "modal"],
          run: () => openModal(),
        },
        {
          label: "Focus quick add",
          keywords: ["input", "type"],
          run: () => quickAddInput && quickAddInput.focus(),
        },
        {
          label: "Show all tasks",
          keywords: ["filter"],
          run: () => {
            setFilter("all");
            loadTasks();
          },
        },
        {
          label: "Filter: To do",
          keywords: ["filter", "todo"],
          run: () => {
            setFilter("todo");
            loadTasks();
          },
        },
        {
          label: "Filter: In progress",
          keywords: ["filter", "wip"],
          run: () => {
            setFilter("in-progress");
            loadTasks();
          },
        },
        {
          label: "Filter: Done",
          keywords: ["filter", "complete"],
          run: () => {
            setFilter("done");
            loadTasks();
          },
        },
        {
          label: "View: List",
          keywords: ["table"],
          run: () => {
            setView("list");
            syncUrl();
          },
        },
        {
          label: "View: Board",
          keywords: ["kanban", "drag"],
          run: () => {
            setView("board");
            syncUrl();
          },
        },
      ],
    });
  }

  // --- Init ---

  applyUrlToState();
  loadTasks();
});
