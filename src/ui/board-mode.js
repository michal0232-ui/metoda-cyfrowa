import "./board-mode.css";

export function mountBoardMode() {
  const root = document.documentElement;
  const enter = document.getElementById("board-enter");
  const exit = document.getElementById("board-exit");
  const toolbar = document.getElementById("board-toolbar");
  const settingsButton = document.getElementById("board-settings");
  const dialog = document.getElementById("board-settings-dialog");
  const settings = document.querySelector(".settings");
  const placeholder = document.createComment("Normal settings position");
  settings.before(placeholder);
  let active = false;
  let hadFullscreen = false;

  function restoreSettings() {
    placeholder.after(settings);
  }
  function leaveLayout() {
    active = false;
    hadFullscreen = false;
    if (dialog.open) dialog.close();
    restoreSettings();
    root.classList.remove("board-mode");
    toolbar.hidden = true;
    enter.setAttribute("aria-pressed", "false");
    enter.focus({ preventScroll: true });
  }

  enter.addEventListener("click", () => {
    active = true;
    root.classList.add("board-mode");
    toolbar.hidden = false;
    enter.setAttribute("aria-pressed", "true");
    window.scrollTo(0, 0);
    exit.focus({ preventScroll: true });
    // Must run in the click handler, before any await; rejection keeps the layout.
    try {
      const request = root.requestFullscreen?.();
      request?.catch(() => {});
    } catch {
      // Unsupported or blocked fullscreen: viewport layout remains available.
    }
  });
  exit.addEventListener("click", () => {
    leaveLayout();
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === root) {
      if (active) hadFullscreen = true;
      else document.exitFullscreen?.().catch(() => {});
    } else if (active && hadFullscreen) {
      leaveLayout();
    }
  });
  settingsButton.addEventListener("click", () => {
    // Move the existing controls; preserve values, listeners and disabled states.
    document.getElementById("board-settings-content").append(settings);
    dialog.showModal();
  });
  document
    .getElementById("board-settings-close")
    .addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    restoreSettings();
    if (active) settingsButton.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      active &&
      !dialog.open &&
      !document.fullscreenElement
    ) {
      leaveLayout();
    }
  });
}
