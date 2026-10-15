import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { toggleTheme, useTheme } from "../lib/theme";
import { DURATION, EASE_IN, SPRING_SOFT } from "../lib/motion";

const ICON_MOTION = {
  initial: { opacity: 0, rotate: -90, scale: 0.4 },
  animate: { opacity: 1, rotate: 0, scale: 1, transition: SPRING_SOFT },
  exit: { opacity: 0, rotate: 90, scale: 0.4, transition: { duration: DURATION.exit, ease: EASE_IN } },
};

/**
 * Light / dark theme switch. The new theme is revealed as a circle
 * growing from the button (instant when reduced motion is preferred).
 */
export default function ThemeToggle({ className = "" }) {
  const theme = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  const handleClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    toggleTheme({ origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`btn-icon border border-slate-200 bg-surface text-slate-600 shadow-xs hover:border-slate-300 hover:bg-slate-50 ${className}`}
      aria-label={label}
      title={label}
    >
      {/* Positioning context for the outgoing icon; keeps the button free to be placed absolutely */}
      <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={theme} className="flex items-center justify-center" {...ICON_MOTION}>
            <Icon name={isDark ? "moon" : "sun"} className="h-[18px] w-[18px]" />
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
