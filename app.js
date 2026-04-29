document.addEventListener("DOMContentLoaded", () => {
  const filters = document.getElementById("filters");
  const viewToggle = document.getElementById("viewToggle");
  const taskList = document.getElementById("taskList");
  const listView = document.getElementById("listView");
  const boardView = document.getElementById("boardView");
  const dateLabel = document.getElementById("dateLabel");

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

  async function loadTasks() {
    state.tasks = await TaskAPI.getAll("all");
    render();
  }

  function getVisibleTasks() {
    if (state.filter === "all") return state.tasks;
    return state.tasks.filter((t) => t.status === state.filter);
  }

  // --- UI rendering ---

  const PRIORITY_LABELS = { high: "High", medium: "Med", low: "Low" };
  const BOARD_STATUSES = ["todo", "in-progress", "done"];

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task-card";
    li.draggable = true;
    li.dataset.status = task.status;
    li.dataset.category = task.category.toLowerCase();
    li.dataset.taskId = String(task.id);

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

    li.addEventListener("dragstart", handleDragStart);
    li.addEventListener("dragend", handleDragEnd);

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
    item.dataset.taskId = String(task.id);
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

  function handleDragStart(e) {
    const el = e.currentTarget;
    if (!el || !el.dataset.taskId) return;
    draggedTaskElement = el;
    draggedTaskElement.classList.add("dragging");
    const id = parseInt(draggedTaskElement.dataset.taskId, 10);
    const status = draggedTaskElement.dataset.status || "todo";
    draggedTask = { id, status };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));

    BOARD_STATUSES.forEach((st) => {
      const column = boardView.querySelector(`[data-board-column="${st}"]`);
      if (column) {
        column.classList.add("drag-target");
      }
    });
  }

  function handleDragEnd() {
    if (draggedTaskElement) {
      draggedTaskElement.classList.remove("dragging");
    }

    BOARD_STATUSES.forEach((st) => {
      const column = boardView.querySelector(`[data-board-column="${st}"]`);
      if (column) {
        column.classList.remove("drag-target", "drag-over");
      }
    });

    draggedTask = null;
    draggedTaskElement = null;
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

  loadTasks();
});
