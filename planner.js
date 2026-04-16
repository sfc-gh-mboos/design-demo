document.addEventListener("DOMContentLoaded", () => {
  const weekLabel = document.getElementById("weekLabel");
  const plannerWeekGrid = document.getElementById("plannerWeekGrid");
  const backlogLane = document.getElementById("backlogLane");
  const backlogCount = document.getElementById("backlogCount");
  const capacityInput = document.getElementById("capacityInput");
  const autoPlanBtn = document.getElementById("autoPlanBtn");
  const resetWeekBtn = document.getElementById("resetWeekBtn");
  const currentWeekBtn = document.getElementById("currentWeekBtn");
  const prevWeekBtn = document.getElementById("prevWeekBtn");
  const nextWeekBtn = document.getElementById("nextWeekBtn");

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const priorityLabels = { high: "High", medium: "Med", low: "Low" };

  const state = {
    tasks: [],
    capacityPerDay: 4,
    selectedWeekStart: getStartOfWeek(new Date()),
    dragTaskId: null,
    dragSourceDate: null,
  };

  const PlannerAPI = {
    async getTasks() {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        throw new Error(`Failed to load tasks: ${res.statusText}`);
      }
      return res.json();
    },
    async updateTask(taskId, payload) {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || "Failed to save planner changes");
      }
      return res.json();
    },
    async autoPlan(weekStart, capacityPerDay) {
      const res = await fetch("/api/planner/auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, capacity_per_day: capacityPerDay }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || "Failed to auto-plan tasks");
      }
      return res.json();
    },
    async resetWeek(weekStart) {
      const res = await fetch("/api/planner/reset-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error.error || "Failed to reset week");
      }
      return res.json();
    },
  };

  function getStartOfWeek(value) {
    const date = new Date(value);
    const day = (date.getDay() + 6) % 7;
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return date;
  }

  function formatISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function getWeekDates() {
    return Array.from({ length: 7 }, (_, index) => addDays(state.selectedWeekStart, index));
  }

  function formatWeekHeader(startDate, endDate) {
    const sameMonth = startDate.getMonth() === endDate.getMonth();
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    const monthStart = startDate.toLocaleDateString("en-US", { month: "short" });
    const monthEnd = endDate.toLocaleDateString("en-US", { month: "short" });
    const yearStart = startDate.getFullYear();
    const yearEnd = endDate.getFullYear();
    if (sameMonth && sameYear) {
      return `${monthStart} ${startDate.getDate()}-${endDate.getDate()}, ${yearStart}`;
    }
    if (sameYear) {
      return `${monthStart} ${startDate.getDate()} - ${monthEnd} ${endDate.getDate()}, ${yearStart}`;
    }
    return `${monthStart} ${startDate.getDate()}, ${yearStart} - ${monthEnd} ${endDate.getDate()}, ${yearEnd}`;
  }

  function showErrorFeedback(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-feedback";
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    window.setTimeout(() => {
      errorDiv.remove();
    }, 2800);
  }

  function compareByPriorityAndCreated(a, b) {
    const pa = priorityOrder[a.priority] ?? 99;
    const pb = priorityOrder[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    const ca = Date.parse(a.created_at || "");
    const cb = Date.parse(b.created_at || "");
    if (!Number.isNaN(ca) && !Number.isNaN(cb) && ca !== cb) return ca - cb;
    return a.id - b.id;
  }

  function compareByPlannedOrder(a, b) {
    const ao = Number.isInteger(a.planned_order) ? a.planned_order : Number.MAX_SAFE_INTEGER;
    const bo = Number.isInteger(b.planned_order) ? b.planned_order : Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return compareByPriorityAndCreated(a, b);
  }

  function getBacklogTasks() {
    return state.tasks
      .filter((task) => !task.planned_date)
      .filter((task) => task.status !== "done")
      .sort(compareByPriorityAndCreated);
  }

  function getTasksForDate(dateString) {
    return state.tasks
      .filter((task) => task.planned_date === dateString && task.status !== "done")
      .sort(compareByPlannedOrder);
  }

  function renderTaskCard(task) {
    const card = document.createElement("article");
    card.className = "planner-task-card";
    card.draggable = true;
    card.dataset.taskId = String(task.id);
    card.dataset.plannedDate = task.planned_date || "";
    card.innerHTML = `
      <div class="planner-task-title">${task.title}</div>
      <div class="planner-task-meta">
        <span class="priority priority-${task.priority}">${priorityLabels[task.priority] || task.priority}</span>
        <span>${task.category}</span>
      </div>
    `;
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("drag-over-card");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over-card");
    });
    return card;
  }

  function buildDropLane(dateString) {
    const lane = document.createElement("div");
    lane.className = "planner-drop-lane";
    lane.dataset.plannedDate = dateString || "";
    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("drag-over");
    }, true);
    lane.addEventListener("dragleave", () => {
      lane.classList.remove("drag-over");
    });
    lane.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      lane.classList.remove("drag-over");
      const dropTarget = event.target;
      const targetCard = dropTarget.classList?.contains("planner-task-card")
        ? dropTarget
        : dropTarget.closest?.(".planner-task-card");
      const beforeTaskId = targetCard ? Number(targetCard.dataset.taskId) : null;
      await handleDrop(dateString || null, Number.isFinite(beforeTaskId) ? beforeTaskId : null, event);
    });
    return lane;
  }

  function renderBacklog() {
    backlogLane.innerHTML = "";
    const tasks = getBacklogTasks();
    backlogCount.textContent = String(tasks.length);
    if (tasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "planner-empty";
      empty.textContent = "Backlog is clear for this week.";
      backlogLane.appendChild(empty);
    } else {
      tasks.forEach((task) => backlogLane.appendChild(renderTaskCard(task)));
    }
  }

  function renderDayColumn(dayDate, index) {
    const dateString = formatISODate(dayDate);
    const tasks = getTasksForDate(dateString);
    const used = tasks.length;
    const capacity = Math.max(1, Number(state.capacityPerDay) || 1);
    const percent = Math.min(100, Math.round((used / capacity) * 100));

    const article = document.createElement("article");
    article.className = "planner-day";

    const header = document.createElement("header");
    header.className = "planner-day-header";
    header.innerHTML = `
      <div>
        <h2>${dayNames[index]}</h2>
        <p>${dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
      </div>
      <span class="planner-capacity-count ${used > capacity ? "over" : ""}">${used}/${capacity}</span>
    `;

    const meter = document.createElement("div");
    meter.className = "planner-capacity-meter";
    meter.innerHTML = `<span style="width:${percent}%"></span>`;

    const lane = buildDropLane(dateString);
    if (tasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "planner-empty";
      empty.textContent = "Drop tasks here";
      lane.appendChild(empty);
    } else {
      tasks.forEach((task) => lane.appendChild(renderTaskCard(task)));
    }

    article.appendChild(header);
    article.appendChild(meter);
    article.appendChild(lane);
    article.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("drag-over");
    }, true);
    article.addEventListener("dragleave", (event) => {
      if (!article.contains(event.relatedTarget)) {
        lane.classList.remove("drag-over");
      }
    });
    article.addEventListener("drop", async (event) => {
      if (event.target.closest(".planner-drop-lane")) return;
      event.preventDefault();
      lane.classList.remove("drag-over");
      await handleDrop(dateString, null, event);
    });
    return article;
  }

  function renderWeek() {
    const dates = getWeekDates();
    weekLabel.textContent = formatWeekHeader(dates[0], dates[6]);
    plannerWeekGrid.innerHTML = "";
    dates.forEach((dayDate, index) => plannerWeekGrid.appendChild(renderDayColumn(dayDate, index)));
  }

  function render() {
    renderBacklog();
    renderWeek();
  }

  function initBacklogDropzone() {
    backlogLane.addEventListener("dragover", (event) => {
      event.preventDefault();
      backlogLane.classList.add("drag-over");
    }, true);
    backlogLane.addEventListener("dragleave", () => {
      backlogLane.classList.remove("drag-over");
    });
    backlogLane.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      backlogLane.classList.remove("drag-over");
      const targetCard = event.target.closest(".planner-task-card");
      const beforeTaskId = targetCard ? Number(targetCard.dataset.taskId) : null;
      await handleDrop(null, Number.isFinite(beforeTaskId) ? beforeTaskId : null, event);
    });
    const backlogColumn = backlogLane.closest(".planner-backlog-column");
    if (backlogColumn) {
      backlogColumn.addEventListener("dragover", (event) => {
        event.preventDefault();
        backlogLane.classList.add("drag-over");
      }, true);
      backlogColumn.addEventListener("dragleave", (event) => {
        if (!backlogColumn.contains(event.relatedTarget)) {
          backlogLane.classList.remove("drag-over");
        }
      });
      backlogColumn.addEventListener("drop", async (event) => {
        if (event.target.closest("#backlogLane")) return;
        event.preventDefault();
        backlogLane.classList.remove("drag-over");
        await handleDrop(null, null, event);
      });
    }
  }

  function getDragContext(dropEvent = null) {
    const fromStateTaskId = Number.isInteger(state.dragTaskId) ? state.dragTaskId : null;
    const fromTransferRaw = dropEvent?.dataTransfer?.getData("text/task-id");
    const fromTransferTaskId = fromTransferRaw ? Number(fromTransferRaw) : null;
    const taskId =
      fromStateTaskId ??
      (Number.isFinite(fromTransferTaskId) ? fromTransferTaskId : null);
    const sourceDateFromTransfer = dropEvent?.dataTransfer?.getData("text/source-date");
    const sourceDate =
      state.dragSourceDate ??
      (sourceDateFromTransfer ? sourceDateFromTransfer : null);
    return { taskId, sourceDate };
  }

  function handleDragStart(event) {
    const taskId = Number(event.currentTarget.dataset.taskId);
    state.dragTaskId = taskId;
    const task = state.tasks.find((item) => item.id === taskId);
    state.dragSourceDate = task?.planned_date || null;
    event.currentTarget.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(taskId));
    event.dataTransfer.setData("text/task-id", String(taskId));
    event.dataTransfer.setData("text/source-date", state.dragSourceDate || "");
  }

  function handleDragEnd(event) {
    event.currentTarget.classList.remove("dragging");
    state.dragTaskId = null;
    state.dragSourceDate = null;
  }

  function normalizeOrderingForDate(dateString, ignoreTaskId = null) {
    if (!dateString) return Promise.resolve();
    const orderedIds = getTasksForDate(dateString)
      .map((task) => task.id)
      .filter((id) => id !== ignoreTaskId);
    const updates = orderedIds.map((id, index) =>
      PlannerAPI.updateTask(id, { planned_date: dateString, planned_order: index })
    );
    return Promise.all(updates);
  }

  async function persistOrderedIds(targetDate, orderedIds) {
    const updates = orderedIds.map((id, index) =>
      PlannerAPI.updateTask(id, { planned_date: targetDate, planned_order: index })
    );
    await Promise.all(updates);
  }

  async function handleDrop(targetDate, beforeTaskId = null, dropEvent = null) {
    const { taskId, sourceDate: dragSourceDate } = getDragContext(dropEvent);
    if (!taskId) return;
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const sourceDate = task.planned_date || dragSourceDate || null;
    if (sourceDate === targetDate && beforeTaskId === task.id) return;

    try {
      if (!targetDate) {
        await PlannerAPI.updateTask(task.id, { planned_date: null, planned_order: null });
        await loadTasks();
        await normalizeOrderingForDate(sourceDate, task.id);
      } else {
        const orderedIds = getTasksForDate(targetDate).map((item) => item.id);
        const cleanedIds = orderedIds.filter((id) => id !== task.id);
        const insertIndex = beforeTaskId
          ? Math.max(0, cleanedIds.indexOf(beforeTaskId))
          : cleanedIds.length;
        cleanedIds.splice(insertIndex, 0, task.id);
        await PlannerAPI.updateTask(task.id, { planned_date: targetDate, planned_order: insertIndex });
        await persistOrderedIds(targetDate, cleanedIds);
        if (sourceDate && sourceDate !== targetDate) {
          await loadTasks();
          await normalizeOrderingForDate(sourceDate, task.id);
        }
      }
      await loadTasks();
    } catch (error) {
      await loadTasks();
      showErrorFeedback(error.message || "Unable to move task. Please try again.");
    }
  }

  async function loadTasks() {
    state.tasks = await PlannerAPI.getTasks();
    render();
  }

  function setWeek(offsetInWeeks) {
    state.selectedWeekStart = addDays(state.selectedWeekStart, offsetInWeeks * 7);
    render();
  }

  async function runAutoPlan() {
    const weekStart = formatISODate(state.selectedWeekStart);
    const capacity = Number.parseInt(capacityInput.value, 10);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      showErrorFeedback("Capacity must be a positive number.");
      return;
    }
    state.capacityPerDay = capacity;
    try {
      const response = await PlannerAPI.autoPlan(weekStart, state.capacityPerDay);
      await loadTasks();
      if (response.scheduled_count > 0) {
        showErrorFeedback(`Auto-planned ${response.scheduled_count} tasks.`);
      }
    } catch (error) {
      showErrorFeedback(error.message || "Auto-plan failed.");
    }
  }

  async function runResetWeek() {
    const weekStart = formatISODate(state.selectedWeekStart);
    try {
      const response = await PlannerAPI.resetWeek(weekStart);
      await loadTasks();
      if (response.cleared_count > 0) {
        showErrorFeedback(`Reset ${response.cleared_count} planned tasks this week.`);
      }
    } catch (error) {
      showErrorFeedback(error.message || "Reset failed.");
    }
  }

  prevWeekBtn.addEventListener("click", () => setWeek(-1));
  nextWeekBtn.addEventListener("click", () => setWeek(1));
  currentWeekBtn.addEventListener("click", () => {
    state.selectedWeekStart = getStartOfWeek(new Date());
    render();
  });
  capacityInput.addEventListener("change", () => {
    const capacity = Number.parseInt(capacityInput.value, 10);
    if (Number.isInteger(capacity) && capacity > 0) {
      state.capacityPerDay = capacity;
      render();
    }
  });
  autoPlanBtn.addEventListener("click", runAutoPlan);
  resetWeekBtn.addEventListener("click", runResetWeek);
  initBacklogDropzone();

  loadTasks().catch((error) => {
    showErrorFeedback(error.message || "Failed to initialize planner.");
  });
});
