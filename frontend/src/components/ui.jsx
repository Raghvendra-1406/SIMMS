import { useEffect, useId, useMemo, useRef } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import Icon from "./Icon";
import { STATUS_TONE, formatLabel } from "../lib/format";
import { DURATION, EASE_IN, EASE_OUT, SPRING_SNAPPY, SPRING_SOFT, revealItem } from "../lib/motion";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const TONES = {
  success: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", dot: "bg-emerald-500" },
  positive: { badge: "bg-green-50 text-green-700 ring-green-600/15", dot: "bg-green-500" },
  warning: { badge: "bg-amber-50 text-amber-800 ring-amber-600/20", dot: "bg-amber-500" },
  orange: { badge: "bg-orange-50 text-orange-700 ring-orange-600/15", dot: "bg-orange-500" },
  danger: { badge: "bg-red-50 text-red-700 ring-red-600/15", dot: "bg-red-500" },
  info: { badge: "bg-sky-50 text-sky-700 ring-sky-600/15", dot: "bg-sky-500" },
  brand: { badge: "bg-brand-50 text-brand-700 ring-brand-600/15", dot: "bg-brand-500" },
  violet: { badge: "bg-violet-50 text-violet-700 ring-violet-600/15", dot: "bg-violet-500" },
  neutral: { badge: "bg-slate-100 text-slate-600 ring-slate-500/15", dot: "bg-slate-400" },
};

/**
 * Pill with a leading dot. Tone is inferred from `status` unless `tone` is given.
 * Colour is never the only signal: the label is always rendered.
 */
export function StatusBadge({ status, tone, label, dot = true, size = "md", className = "" }) {
  const key = String(status ?? "").toUpperCase();
  const palette = TONES[tone || STATUS_TONE[key] || "neutral"];
  const sizing = size === "sm" ? "h-5 px-1.5 text-[10.5px]" : "h-6 px-2 text-[11.5px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-semibold ring-1 ring-inset ${sizing} ${palette.badge} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} aria-hidden="true" />}
      {label ?? formatLabel(status)}
    </span>
  );
}


// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** In-page heading block: title, description and right-aligned actions. */
export function PageHeader({ eyebrow, title, description, actions, className = "" }) {
  return (
    <motion.div variants={revealItem} className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

/** Card with optional header row. Joins the page's entrance cascade. */
export function Card({ title, subtitle, actions, icon, children, className = "", bodyClassName = "card-body", as: Tag = "section" }) {
  const MotionTag = motion[Tag] ?? motion.section;

  return (
    <MotionTag variants={revealItem} className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon name={icon} className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="card-title truncate">{title}</h3>}
              {subtitle && <p className="card-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </MotionTag>
  );
}

const STAT_TONES = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  info: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
};

// "1,284" / "92%" / "-3.5 kWh" → { prefix, number, suffix, decimals, grouped }.
// Anything else (dates, "—", nodes) is rendered as-is.
function parseNumeric(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const decimals = Math.min((String(value).split(".")[1] || "").length, 3);
    return { prefix: "", number: value, suffix: "", decimals, grouped: false };
  }
  if (typeof value !== "string") return null;
  const match = value.match(/^(\D*?)(-?\d{1,3}(?:,\d{3})+|-?\d+)(\.\d+)?(\D*)$/);
  if (!match) return null;
  const [, prefix, whole, fraction = "", suffix] = match;
  return {
    prefix,
    number: Number(whole.replace(/,/g, "") + fraction),
    suffix,
    decimals: fraction ? fraction.length - 1 : 0,
    grouped: whole.includes(","),
  };
}

function formatNumeric(parsed, current) {
  const options = { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals, useGrouping: parsed.grouped };
  return `${parsed.prefix}${current.toLocaleString("en-US", options)}${parsed.suffix}`;
}

/** Counts up to numeric KPI values on reveal and tweens between polled updates. */
function AnimatedValue({ value }) {
  const parsed = useMemo(() => parseNumeric(value), [value]);
  const reduceMotion = useReducedMotion();
  const count = useMotionValue(0);
  // useTransform re-subscribes each render, so this always formats with the latest `parsed`.
  const text = useTransform(count, (current) => (parsed ? formatNumeric(parsed, current) : ""));

  useEffect(() => {
    if (!parsed) return undefined;
    if (reduceMotion) {
      count.set(parsed.number);
      return undefined;
    }
    const controls = animate(count, parsed.number, { duration: 0.9, ease: EASE_OUT });
    return () => controls.stop();
  }, [parsed, reduceMotion, count]);

  if (!parsed) return value;
  return <motion.span>{text}</motion.span>;
}

/** KPI tile. `value` renders in tabular mono figures; numeric values count up. */
/** `unavailable` replaces value + hint when the data behind the card failed to load. */
export function StatCard({ label, value, hint, icon, tone = "neutral", onClick, loading = false, unavailable = false, footer }) {
  const Tag = onClick ? motion.button : motion.div;

  return (
    <Tag
      variants={revealItem}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`card flex w-full min-w-0 flex-col p-3.5 text-left sm:p-5 ${onClick ? "card-hover" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[13px] font-medium leading-snug text-slate-500">{label}</p>
        {icon && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${STAT_TONES[unavailable ? "neutral" : tone] || STAT_TONES.neutral}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        )}
      </div>
      {loading ? (
        <span className="skeleton mt-2 h-8 w-16" />
      ) : unavailable ? (
        <p className="num mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-300 sm:text-[28px]" aria-label="Unavailable">—</p>
      ) : (
        <p className="num mt-1 truncate text-2xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-[28px]">
          <AnimatedValue value={value} />
        </p>
      )}
      {unavailable ? (
        <p className="mt-1 text-xs leading-snug text-slate-500">Data unavailable</p>
      ) : (
        hint && <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>
      )}
      {footer && <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div>}
    </Tag>
  );
}

/** Label/value pair for detail pages. */
export function DetailItem({ label, children, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold text-slate-900 ${mono ? "num" : ""}`}>{children ?? "—"}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function Spinner({ className = "h-4 w-4" }) {
  return <Icon name="loader" className={`animate-spin ${className}`} />;
}

export function EmptyState({ icon = "inbox", title, description, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      <motion.span
        className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/70"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING_SOFT}
      >
        <Icon name={icon} className="h-5 w-5" />
      </motion.span>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const ALERT_TONES = {
  danger: { wrap: "border-red-200 bg-red-50 text-red-800", icon: "alertCircle", iconClass: "text-red-500" },
  warning: { wrap: "border-amber-200 bg-amber-50 text-amber-900", icon: "alert", iconClass: "text-amber-500" },
  success: { wrap: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: "checkCircle", iconClass: "text-emerald-500" },
  info: { wrap: "border-sky-200 bg-sky-50 text-sky-800", icon: "info", iconClass: "text-sky-500" },
};

/** Inline banner for errors / success messages. Pass `onRetry` to show a retry action. */
export function Alert({ tone = "danger", title, children, onRetry, onDismiss, className = "" }) {
  const palette = ALERT_TONES[tone] || ALERT_TONES.danger;
  if (!children && !title) return null;

  return (
    <motion.div
      variants={revealItem}
      initial="hidden"
      animate="show"
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${palette.wrap} ${className}`}
    >
      <Icon name={palette.icon} className={`mt-0.5 h-[18px] w-[18px] ${palette.iconClass}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-sm btn-secondary">
          <Icon name="refresh" className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="btn-icon h-7 w-7 -mr-1" aria-label="Dismiss">
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}

/** Loading placeholder rows for tables / lists. */
export function SkeletonRows({ rows = 5, className = "" }) {
  return (
    <div className={`space-y-3 p-5 ${className}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <span className="skeleton h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <span className="skeleton block h-3 w-1/3" />
            <span className="skeleton block h-3 w-1/2" />
          </div>
          <span className="skeleton h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Top-bar refresh button with loading state. */
export function RefreshButton({ onClick, loading, label = "Refresh" }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className="btn btn-secondary">
      <Icon name="refresh" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{loading ? "Refreshing…" : label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Search input with leading icon. */
export function SearchInput({ value, onChange, placeholder = "Search…", className = "", id, label = "Search" }) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input id={id} type="search" value={value} onChange={onChange} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}

/** Segmented control for filters. options: [{ value, label, count? }]. The active pill slides between options. */
export function Segmented({ options, value, onChange, ariaLabel = "Filter", className = "" }) {
  const layoutScope = useId();

  return (
    <LayoutGroup id={layoutScope}>
      <div role="tablist" aria-label={ariaLabel} className={`segmented max-w-full flex-wrap ${className}`}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.value)}
              className={`segmented-item whitespace-nowrap ${active ? "text-slate-900" : ""}`}
            >
              {active && <motion.span layoutId="segmented-pill" className="segmented-pill" transition={SPRING_SNAPPY} aria-hidden="true" />}
              <span className="relative flex items-center gap-1.5">
                {option.label}
                {option.count !== undefined && (
                  <span className={`num rounded px-1 text-[10.5px] ${active ? "bg-slate-100 text-slate-700" : "text-slate-400"}`}>{option.count}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

/**
 * Accessible modal dialog. Closes on Escape and backdrop click.
 * `footer` renders a right-aligned action row. Scales in from the centre
 * (slides up as a sheet on mobile) and exits faster than it enters.
 */
export function Modal({ open, ...props }) {
  return <AnimatePresence>{open && <ModalDialog {...props} />}</AnimatePresence>;
}

const MODAL_WIDTHS = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

function ModalDialog({ onClose, title, description, children, footer, size = "md" }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest handler without re-running the mount effect,
  // so inline `onClose` props don't steal focus on every render.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const onKey = (event) => event.key === "Escape" && onCloseRef.current?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <motion.div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px] dark:bg-black/60"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: DURATION.fast, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: { duration: DURATION.exit, ease: EASE_IN } }}
      />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`relative flex max-h-[92dvh] w-full ${MODAL_WIDTHS[size] || MODAL_WIDTHS.md} flex-col rounded-t-2xl bg-surface shadow-overlay outline-none sm:rounded-2xl`}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: SPRING_SOFT }}
        exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: DURATION.exit, ease: EASE_IN } }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-2 -mt-1" aria-label="Close dialog">
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>
        <div className="thin-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:rounded-b-2xl sm:px-6">{footer}</div>}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

/** Horizontal meter (0–100). Tone follows the score unless provided. */
export function ScoreBar({ value, tone, className = "" }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  const auto = score >= 85 ? "bg-emerald-500" : score >= 70 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const fill = tone ? (TONES[tone]?.dot ?? auto) : auto;

  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ${className}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
      <motion.div
        className={`h-full w-full rounded-full ${fill}`}
        initial={{ clipPath: "inset(0% 100% 0% 0% round 9999px)" }}
        animate={{ clipPath: `inset(0% ${100 - score}% 0% 0% round 9999px)` }}
        transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      />
    </div>
  );
}

/** Rounded icon tile used in list rows. */
export function IconTile({ icon, tone = "neutral", className = "h-9 w-9" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${STAT_TONES[tone] || STAT_TONES.neutral} ${className}`}>
      <Icon name={icon} className="h-[18px] w-[18px]" />
    </span>
  );
}
