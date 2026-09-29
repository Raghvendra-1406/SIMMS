import { useEffect, useRef } from "react";

/**
 * Call `load` every `intervalMs` while the page is visible.
 *
 * - `load` is called as load({ silent: true }), so pages can refresh
 *   without flashing their loading skeletons.
 * - Calls never overlap: a slow request delays the next tick.
 * - Polling pauses while the tab is hidden and refreshes once
 *   when it becomes visible again.
 * - By default the first load is the page's own job (its mount effect);
 *   pass { immediate: true } to have the hook do it (silently).
 */
export function usePolling(load, intervalMs, { enabled = true, immediate = false } = {}) {
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    let timer = null;
    let running = false;
    let stopped = false;

    const schedule = () => {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    const tick = async () => {
      if (stopped) return;

      if (document.hidden || running) {
        schedule();
        return;
      }

      running = true;

      try {
        await loadRef.current?.({ silent: true });
      } catch {
        // Pages show their own errors; keep polling.
      } finally {
        running = false;
        schedule();
      }
    };

    const onVisible = () => {
      if (!document.hidden && !running) {
        clearTimeout(timer);
        tick();
      }
    };

    if (immediate) {
      tick();
    } else {
      schedule();
    }

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled, immediate]);
}
