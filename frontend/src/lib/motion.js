// Shared Framer Motion tokens. Keep durations and easings here so every
// animation in the app moves with the same rhythm.
// Reduced motion is handled globally by <MotionConfig reducedMotion="user">
// in main.jsx (transforms are dropped, opacity fades remain).

/** Decelerate on arrival. */
export const EASE_OUT = [0.22, 1, 0.36, 1];
/** Accelerate on exit. */
export const EASE_IN = [0.4, 0, 1, 1];

export const DURATION = {
  exit: 0.16,
  fast: 0.2,
  base: 0.32,
  slow: 0.5,
};

/** Snappy, critically damped spring for UI that follows the pointer (pills, indicators). */
export const SPRING_SNAPPY = { type: "spring", stiffness: 520, damping: 42, mass: 0.7 };
/** Softer spring for panels and dialogs. */
export const SPRING_SOFT = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 };

/**
 * Page content: children with `revealItem` variants cascade in 40ms apart.
 * Items that mount later (after data loads) animate in on their own.
 */
export const revealContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const revealItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};
