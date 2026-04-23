(function () {
  "use strict";

  var STORAGE_KEY = "taskflow.theme";
  var THEMES = ["light", "dark", "synthwave"];
  var LABELS = {
    light: "Light",
    dark: "Dark",
    synthwave: "Synthwave",
  };
  var ICONS = {
    light:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="4"></circle>' +
        '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>' +
      '</svg>',
    dark:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path>' +
      '</svg>',
    synthwave:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3l1.8 4.6L18.5 9l-3.6 3.1.9 4.7L12 14.6 8.2 16.8l.9-4.7L5.5 9l4.7-1.4z"></path>' +
        '<path d="M19 3v3M21 4.5h-3M5 17v3M6.5 18.5h-3"></path>' +
      '</svg>',
  };

  function getStored() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStored(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* ignore */
    }
  }

  function systemPref() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function resolveInitialTheme() {
    var stored = getStored();
    if (stored && THEMES.indexOf(stored) !== -1) return stored;
    return systemPref();
  }

  function applyTheme(theme) {
    if (THEMES.indexOf(theme) === -1) theme = "light";
    document.documentElement.setAttribute("data-theme", theme);
  }

  // Apply ASAP (this script is loaded synchronously in <head>) to avoid FOUC.
  applyTheme(resolveInitialTheme());

  function setTheme(theme, opts) {
    if (THEMES.indexOf(theme) === -1) return;
    applyTheme(theme);
    if (!opts || opts.persist !== false) setStored(theme);
    updateButtons(theme);
    document.dispatchEvent(
      new CustomEvent("themechange", { detail: { theme: theme } })
    );
  }

  function getTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }

  function updateButtons(active) {
    var btns = document.querySelectorAll(".theme-toggle-btn");
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var isActive = b.getAttribute("data-theme-value") === active;
      b.setAttribute("aria-pressed", isActive ? "true" : "false");
      b.setAttribute("tabindex", isActive ? "0" : "-1");
    }
  }

  function buildToggle() {
    var wrap = document.createElement("div");
    wrap.className = "theme-toggle";
    wrap.setAttribute("role", "radiogroup");
    wrap.setAttribute("aria-label", "Theme");

    THEMES.forEach(function (t) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-toggle-btn";
      btn.setAttribute("data-theme-value", t);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-label", LABELS[t] + " theme");
      btn.title = LABELS[t] + " theme";
      btn.innerHTML = ICONS[t];
      btn.addEventListener("click", function () {
        setTheme(t);
      });
      wrap.appendChild(btn);
    });

    return wrap;
  }

  function mountToggle() {
    if (document.querySelector(".theme-toggle")) return;
    var nav =
      document.querySelector("[data-theme-toggle-slot]") ||
      document.querySelector(".topbar-nav") ||
      document.querySelector(".topbar-inner");
    if (!nav) return;
    var toggle = buildToggle();
    nav.appendChild(toggle);
    updateButtons(getTheme());
  }

  function init() {
    mountToggle();
    updateButtons(getTheme());

    // React to OS-level changes only when no explicit user choice is stored.
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var handler = function () {
        if (!getStored()) setTheme(systemPref(), { persist: false });
      };
      if (mq.addEventListener) mq.addEventListener("change", handler);
      else if (mq.addListener) mq.addListener(handler);
    }

    // Sync across tabs.
    window.addEventListener("storage", function (e) {
      if (e.key === STORAGE_KEY && e.newValue && THEMES.indexOf(e.newValue) !== -1) {
        applyTheme(e.newValue);
        updateButtons(e.newValue);
        document.dispatchEvent(
          new CustomEvent("themechange", { detail: { theme: e.newValue } })
        );
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Theme = {
    get: getTheme,
    set: setTheme,
    themes: THEMES.slice(),
  };
})();
