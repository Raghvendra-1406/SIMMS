import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

// The initial theme is applied by the inline script in index.html before
// first paint, so this module only reads and updates <html data-theme>.
const STORAGE_KEY = "simms.theme";
const THEME_COLOR = { light: "#0a0f1e", dark: "#0b1020" };
const REVEAL_MS = 520;

const listeners = new Set();

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  // Flush so React-rendered parts of the new theme (e.g. the toggle icon)
  // are in the DOM before the View Transition captures its snapshot.
  flushSync(() => listeners.forEach((listener) => listener()));
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Switch theme and remember the choice.
 * `origin` ({ x, y } in viewport px) grows the new theme as a circle from that
 * point. Falls back to an instant swap without View Transitions or when the
 * user prefers reduced motion.
 */
export function setTheme(theme, { origin } = {}) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable: theme still applies for this page */
  }

  if (theme === getTheme()) return;

  const root = document.documentElement;
  if (!origin || !document.startViewTransition || prefersReducedMotion()) {
    root.classList.add("theme-switching");
    applyTheme(theme);
    // Force a style flush so the swap happens with transitions disabled.
    void window.getComputedStyle(root).color;
    requestAnimationFrame(() => root.classList.remove("theme-switching"));
    return;
  }

  const { x, y } = origin;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  root.classList.add("theme-switching");
  const transition = document.startViewTransition(() => applyTheme(theme));

  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {});

  transition.finished.finally(() => root.classList.remove("theme-switching"));
}

export function toggleTheme(options) {
  setTheme(getTheme() === "dark" ? "light" : "dark", options);
}

function attachGlobalListeners() {
  // Follow the OS setting until the user picks a theme explicitly.
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (!readStored()) applyTheme(systemTheme());
  };
  // Keep other open tabs in sync.
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) applyTheme(readStored() || systemTheme());
  };

  media?.addEventListener?.("change", onSystemChange);
  window.addEventListener("storage", onStorage);

  return () => {
    media?.removeEventListener?.("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

let detachGlobalListeners = null;

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) detachGlobalListeners = attachGlobalListeners();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detachGlobalListeners?.();
      detachGlobalListeners = null;
    }
  };
}

/** Current theme ("light" | "dark"), re-rendering on change. */
export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}
