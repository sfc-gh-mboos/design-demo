(function () {
  const STORAGE_KEY = "taskflow-theme";

  function getStoredTheme() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "light" || v === "dark") return v;
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function preferredTheme() {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function applyTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch (_) {
      /* ignore */
    }
    syncToggle(t);
    window.dispatchEvent(new CustomEvent("taskflow-themechange", { detail: { theme: t } }));
  }

  function syncToggle(theme) {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const isDark = theme === "dark";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
    btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    const light = btn.querySelector("[data-theme-icon='light']");
    const dark = btn.querySelector("[data-theme-icon='dark']");
    if (light) light.classList.toggle("theme-toggle__icon--hidden", isDark);
    if (dark) dark.classList.toggle("theme-toggle__icon--hidden", !isDark);
  }

  function initThemeFromStorage() {
    const stored = getStoredTheme();
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
      return stored;
    }
    const p = preferredTheme();
    document.documentElement.setAttribute("data-theme", p);
    return p;
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    if (e.newValue === "light" || e.newValue === "dark") {
      document.documentElement.setAttribute("data-theme", e.newValue);
      syncToggle(e.newValue);
      window.dispatchEvent(
        new CustomEvent("taskflow-themechange", { detail: { theme: e.newValue } })
      );
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    const current =
      document.documentElement.getAttribute("data-theme") || initThemeFromStorage();
    syncToggle(current === "dark" ? "dark" : "light");

    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const next =
          document.documentElement.getAttribute("data-theme") === "dark"
            ? "light"
            : "dark";
        applyTheme(next);
      });
    }
  });
})();
