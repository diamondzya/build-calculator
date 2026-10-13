/* UI only. Runs before CSS; never reads or writes calculator/project data. */
(function () {
  "use strict";

  var KEY = "buildcalc-theme";
  var root = document.documentElement;
  var preference = null;
  var systemTheme = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function isTheme(value) {
    return value === "light" || value === "dark";
  }

  try {
    var saved = window.localStorage.getItem(KEY);
    if (isTheme(saved)) preference = saved;
  } catch (error) {
    // Blocked storage must not prevent either the UI or calculators from starting.
  }

  function preferredTheme() {
    return preference || (systemTheme && systemTheme.matches ? "dark" : "light");
  }

  function updateButton(theme) {
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    var action = theme === "dark" ? "light" : "dark";
    button.setAttribute("aria-label", "Switch to " + action + " mode");
    button.title = "Switch to " + action + " mode";
    button.querySelector(".theme-toggle-label").textContent = action === "dark" ? "Dark mode" : "Light mode";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#121212" : "#fafafa";
    updateButton(theme);
  }

  // Synchronous head script: restore the theme before the first styled paint.
  applyTheme(preferredTheme());

  function initControls() {
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    updateButton(preferredTheme());
    button.addEventListener("click", function () {
      preference = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(preference);
      var persisted = true;
      try {
        window.localStorage.setItem(KEY, preference);
      } catch (error) {
        persisted = false;
      }
      var status = document.getElementById("theme-status");
      if (status) {
        status.textContent = (preference === "dark" ? "Dark" : "Light") + " mode enabled." +
          (persisted ? "" : " Preference could not be saved on this device.");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initControls, { once: true });
  } else {
    initControls();
  }

  function followSystem() {
    if (!preference) applyTheme(preferredTheme());
  }
  if (systemTheme) {
    if (systemTheme.addEventListener) systemTheme.addEventListener("change", followSystem);
    else if (systemTheme.addListener) systemTheme.addListener(followSystem);
  }

  window.addEventListener("storage", function (event) {
    if (event.key !== KEY && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch (error) {
      return;
    }
    preference = isTheme(event.newValue) ? event.newValue : null;
    applyTheme(preferredTheme());
  });
})();
