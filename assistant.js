/**
 * Shared proactive assistance: command palette (⌘/Ctrl+K), optional toasts.
 * Each page calls TaskflowAssist.init({ commands, onPaletteOpen }).
 */
(function () {
  let paletteEl = null;
  let inputEl = null;
  let listEl = null;
  let commands = [];
  let filtered = [];
  let activeIndex = 0;
  let onPaletteOpen = null;

  function normalize(s) {
    return (s || "").toLowerCase();
  }

  function score(cmd, q) {
    if (!q) return 1;
    const hay = normalize(cmd.label + " " + (cmd.keywords || []).join(" "));
    if (hay.includes(q)) return 2;
    const words = q.split(/\s+/).filter(Boolean);
    if (words.every((w) => hay.includes(w))) return 1;
    return 0;
  }

  function filterCommands(q) {
    const n = normalize(q.trim());
    if (!n) return commands.slice();
    const scored = commands
      .map((c) => ({ c, s: score(c, n) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    return scored.map((x) => x.c);
  }

  function renderList() {
    listEl.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("li");
      empty.className = "palette-empty";
      empty.textContent = "No matches. Try another phrase.";
      listEl.appendChild(empty);
      return;
    }
    filtered.forEach((cmd, i) => {
      const li = document.createElement("li");
      li.className = "palette-item" + (i === activeIndex ? " palette-item--active" : "");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      li.dataset.index = String(i);
      const label = document.createElement("span");
      label.className = "palette-item-label";
      label.textContent = cmd.label;
      li.appendChild(label);
      if (cmd.hint) {
        const hint = document.createElement("span");
        hint.className = "palette-item-hint";
        hint.textContent = cmd.hint;
        li.appendChild(hint);
      }
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        runAt(i);
      });
      listEl.appendChild(li);
    });
  }

  function runAt(i) {
    const cmd = filtered[i];
    if (!cmd || typeof cmd.run !== "function") return;
    closePalette();
    try {
      cmd.run();
    } catch (e) {
      console.error(e);
    }
  }

  function openPalette() {
    if (!paletteEl) return;
    paletteEl.classList.remove("hidden");
    paletteEl.setAttribute("aria-hidden", "false");
    activeIndex = 0;
    inputEl.value = "";
    filtered = filterCommands("");
    renderList();
    requestAnimationFrame(() => inputEl.focus());
    if (typeof onPaletteOpen === "function") onPaletteOpen();
  }

  function closePalette() {
    if (!paletteEl) return;
    paletteEl.classList.add("hidden");
    paletteEl.setAttribute("aria-hidden", "true");
    inputEl.value = "";
  }

  function ensurePalette() {
    if (paletteEl) return;
    paletteEl = document.createElement("div");
    paletteEl.id = "commandPalette";
    paletteEl.className = "command-palette hidden";
    paletteEl.setAttribute("role", "dialog");
    paletteEl.setAttribute("aria-modal", "true");
    paletteEl.setAttribute("aria-label", "Quick actions");
    paletteEl.innerHTML = `
      <div class="command-palette-backdrop" data-palette-dismiss></div>
      <div class="command-palette-panel">
        <input type="search" class="command-palette-input" autocomplete="off" spellcheck="false"
          aria-label="Search actions" placeholder="Search actions…" id="commandPaletteInput" />
        <p class="command-palette-hint"><kbd>↑</kbd><kbd>↓</kbd> navigate · <kbd>Enter</kbd> run · <kbd>Esc</kbd> close</p>
        <ul class="command-palette-list" role="listbox" id="commandPaletteList"></ul>
      </div>
    `;
    document.body.appendChild(paletteEl);
    inputEl = paletteEl.querySelector("#commandPaletteInput");
    listEl = paletteEl.querySelector("#commandPaletteList");

    paletteEl.querySelector("[data-palette-dismiss]").addEventListener("click", closePalette);

    inputEl.addEventListener("input", () => {
      filtered = filterCommands(inputEl.value);
      activeIndex = 0;
      renderList();
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length) activeIndex = (activeIndex + 1) % filtered.length;
        renderList();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length)
          activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
        renderList();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runAt(activeIndex);
      }
    });

    document.addEventListener("keydown", (e) => {
      const isK = e.key === "k" || e.key === "K";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        if (paletteEl.classList.contains("hidden")) openPalette();
        else closePalette();
      }
    });
  }

  window.TaskflowAssist = {
    init(opts) {
      commands = (opts && opts.commands) || [];
      onPaletteOpen = opts && opts.onPaletteOpen;
      ensurePalette();
    },
    openPalette,
    closePalette,
    showToast(message, opts) {
      const duration = (opts && opts.duration) || 3200;
      const div = document.createElement("div");
      div.className = "assist-toast";
      div.setAttribute("role", "status");
      div.textContent = message;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), duration);
    },
  };
})();
