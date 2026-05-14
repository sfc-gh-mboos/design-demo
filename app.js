document.addEventListener("DOMContentLoaded", () => {
  const filters = document.getElementById("filters");
  const viewToggle = document.getElementById("viewToggle");
  const taskList = document.getElementById("taskList");
  const listView = document.getElementById("listView");
  const boardView = document.getElementById("boardView");
  const dateLabel = document.getElementById("dateLabel");
  const authPanel = document.getElementById("authPanel");
  const appShell = document.getElementById("appShell");
  const profileActions = document.getElementById("profileActions");
  const profileName = document.getElementById("profileName");
  const logoutBtn = document.getElementById("logoutBtn");
  const authForm = document.getElementById("authForm");
  const authNameField = document.getElementById("authNameField");
  const authNameInput = document.getElementById("authNameInput");
  const authEmailInput = document.getElementById("authEmailInput");
  const authPasswordInput = document.getElementById("authPasswordInput");
  const authError = document.getElementById("authError");
  const authSubmitBtn = document.getElementById("authSubmitBtn");
  const authModeBtns = document.querySelectorAll("[data-auth-mode]");

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

  const AuthAPI = {
    async getProfile() {
      const res = await fetch("/api/profile");
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `Failed to fetch profile: ${res.statusText}`);
      }
      return res.json();
    },

    async getStats() {
      const res = await fetch("/api/profile/stats");
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `Failed to fetch stats: ${res.statusText}`);
      }
      return res.json();
    },

    async signup(data) {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `Failed to sign up: ${res.statusText}`);
      }
      return res.json();
    },

    async login(data) {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || `Failed to log in: ${res.statusText}`);
      }
      return res.json();
    },

    async logout() {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        throw new Error(`Failed to log out: ${res.statusText}`);
      }
    },
  };

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
    authMode: "signup",
    user: null,
  };

  async function loadTasks() {
    state.tasks = await TaskAPI.getAll(state.filter);
    render();
    await loadStats();
  }

  async function loadStats() {
    const stats = await AuthAPI.getStats();
    updateStats(stats);
  }

  // --- UI rendering ---

  const PRIORITY_LABELS = { high: "High", medium: "Med", low: "Low" };
  const BOARD_STATUSES = ["todo", "in-progress", "done"];

  function updateStats(stats) {
    document.getElementById("statTotal").textContent = stats.total_tasks;
    document.getElementById("statCompletion").textContent = `${stats.completion_rate}%`;
    document.getElementById("statDone").textContent = stats.completed_tasks;
    document.getElementById("statHighPriority").textContent = stats.high_priority_tasks;
  }

  function setAuthMode(mode) {
    state.authMode = mode;
    authModeBtns.forEach((button) => {
      const isActive = button.dataset.authMode === mode;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    authNameField.classList.toggle("hidden", mode === "login");
    authNameInput.required = mode === "signup";
    authPasswordInput.autocomplete = mode === "signup" ? "new-password" : "current-password";
    authSubmitBtn.textContent = mode === "signup" ? "Create profile" : "Log in";
    authError.textContent = "";
  }

  function showSignedOut() {
    state.user = null;
    state.tasks = [];
    authPanel.classList.remove("hidden");
    appShell.classList.add("hidden");
    profileActions.classList.add("hidden");
    profileName.textContent = "";
    render();
  }

  async function showSignedIn(user) {
    state.user = user;
    profileName.textContent = user.name;
    profileActions.classList.remove("hidden");
    authPanel.classList.add("hidden");
    appShell.classList.remove("hidden");
    await loadTasks();
  }

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task-card";
    li.dataset.status = task.status;
    li.dataset.category = task.category.toLowerCase();
    li.dataset.id = task.id;

    const statusDot = document.createElement("div");
    statusDot.className = `status-indicator status-${task.status}`;
    statusDot.style.cursor = "pointer";
    statusDot.title = "Cycle status";
    statusDot.addEventListener("click", (e) => {
      e.stopPropagation();
      cycleStatus(task);
    });

    const body = document.createElement("div");
    body.className = "task-body";
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = task.category;
    body.append(title, meta);

    const priority = document.createElement("span");
    priority.className = `priority priority-${task.priority}`;
    priority.textContent = PRIORITY_LABELS[task.priority] || task.priority;

    li.append(statusDot, body, priority);
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

    const header = document.createElement("div");
    header.className = "board-task-header";
    const title = document.createElement("span");
    title.className = `board-task-title ${isDone ? "done" : ""}`.trim();
    title.textContent = task.title;
    const priority = document.createElement("span");
    priority.className = `board-task-priority priority-${task.priority}`;
    priority.textContent = priorityLabel;
    header.append(title, priority);

    const meta = document.createElement("span");
    meta.className = "board-task-meta";
    meta.textContent = task.category;
    item.append(header, meta);
    
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

  async function bootstrapAuth() {
    setAuthMode("signup");
    try {
      const profile = await AuthAPI.getProfile();
      await showSignedIn(profile.user);
    } catch (error) {
      showSignedOut();
    }
  }

  // --- Event listeners ---

  authModeBtns.forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.textContent = "";
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    const name = authNameInput.value.trim();

    try {
      const result =
        state.authMode === "signup"
          ? await AuthAPI.signup({ name, email, password })
          : await AuthAPI.login({ email, password });
      authForm.reset();
      await showSignedIn(result.user);
    } catch (error) {
      authError.textContent = error.message || "Authentication failed.";
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await AuthAPI.logout();
      showSignedOut();
    } catch (error) {
      showErrorFeedback(error.message || "Failed to log out.");
    }
  });

  filters.addEventListener("click", (e) => {
    if (!e.target.matches(".filter-btn")) return;
    setFilter(e.target.dataset.filter);
    loadTasks();
  });

  viewToggle.addEventListener("click", (e) => {
    if (!e.target.matches(".view-toggle-btn")) return;
    setView(e.target.dataset.view);
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

  // --- Init ---

  bootstrapAuth();
});
