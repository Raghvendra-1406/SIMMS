# SIMMS design system

Source of truth for UI work on the SIMMS frontend. Generated with the ui-ux-pro-max skill (data-dense operations dashboard) and applied across every page.

Project: `D:\mdmproject\SIMMS\frontend` (React 19 + Vite + Tailwind v4 + Framer Motion, no router — navigation is `window.location.href`).
Product: Smart Classroom Infrastructure Monitoring System — internal ops console for ADMIN, SUPERVISOR, MAINTENANCE_STAFF.

Design direction (from ui-ux-pro-max): **data-dense operations dashboard**, light content area, deep navy (`ink-950`) sidebar,
indigo-blue `brand-*` for primary actions/active/focus. Green / amber / red / sky / violet are RESERVED for status meaning.
Fonts: Plus Jakarta Sans (UI), Fira Code (`.num` — numbers, IDs, readings, timestamps where tabular alignment matters).
Style: calm, precise, compact. Rounded-xl cards, 1px slate-200 borders, soft shadows, no heavy gradients, no giant hero banners.
Themes: light (default) and dark (midnight navy, not pure black). The sidebar and login brand panel are dark in both themes.

## Foundation (shared — change here, not per page)
- `src/index.css` — tokens + component classes + the dark-theme palette remap (`.card .card-header .card-title .card-subtitle .card-body .card-hover .eyebrow .btn .btn-sm .btn-lg .btn-primary .btn-secondary .btn-ghost .btn-danger .btn-danger-soft .btn-success .btn-icon .label .input .select .textarea .help-text .error-text .table-wrap .table .segmented .segmented-item .segmented-item-active .chip .chip-active .num .kbd .divider .skeleton`), colours `brand-50..950`, `ink-50..950`, `bg-canvas`, `bg-surface`, solid fills `primary(-hover/-active)`, `danger(-hover/-active)`, `success(-hover)`, `accent`, shadows `shadow-card shadow-raised shadow-overlay`, animations `animate-fade-in animate-slide-up animate-shimmer`.
- `src/components/AppShell.jsx` — default export `AppShell({ title, eyebrow, backHref, actions, unreadCount, wide, children })`. Provides sidebar (role-based nav, active state by path, collapse, mobile drawer), sticky top bar (theme toggle at top-left, title, back button, actions slot), skip link, logout, `<main>` container with padding + max width that runs the entrance cascade. Also exports `BrandMark`.
- `src/components/ThemeToggle.jsx` — light/dark button. Already in the AppShell top bar; standalone screens (login, status) place it `absolute left-5 top-5 sm:left-8 sm:top-8`.
- `src/lib/theme.js` — `useTheme()`, `setTheme(theme, { origin })`, `toggleTheme()`. Choice is stored in `localStorage["simms.theme"]`; without one it follows the OS. `index.html` applies it before first paint (keep both in sync).
- `src/lib/motion.js` — shared motion tokens: `EASE_OUT`, `EASE_IN`, `DURATION`, `SPRING_SNAPPY`, `SPRING_SOFT`, `revealContainer`, `revealItem`.
- `src/components/ui.jsx` — `StatusBadge({status|tone,label,dot,size})`, `PageHeader`, `Card({title,subtitle,icon,actions,bodyClassName,className})`, `StatCard({label,value,hint,icon,tone,onClick,loading,footer})`, `DetailItem({label,mono})` (use inside `<dl>`), `Spinner`, `EmptyState({icon,title,description,action})`, `Alert({tone,title,onRetry,onDismiss})`, `SkeletonRows`, `RefreshButton({onClick,loading})`, `SearchInput`, `Segmented({options:[{value,label,count}],value,onChange})`, `Modal({open,onClose,title,description,footer,size})`, `ScoreBar({value,tone})`, `IconTile({icon,tone})`.
  Motion is built in: `Card`, `StatCard`, `PageHeader` cascade in on page load; `Alert` fades in; numeric `StatCard` values count up and tween on updates; `Segmented` has a sliding pill; `Modal` scales in/out; `ScoreBar` fills on reveal.
- `src/components/Icon.jsx` — `<Icon name="..." className="h-4 w-4" />`. Available names:
  dashboard classroom device users user calibration camera activity alert alertCircle ticket bell wrench logout menu x chevronLeft chevronRight chevronDown chevronUp arrowLeft arrowRight arrowUpRight panelLeft refresh plus search filter edit trash eye eyeOff check checkCircle xCircle info clock calendar history zap lightbulb fan thermometer sun gauge heart shield lock mail wifi wifiOff server layers mapPin building message send play pause save moreHorizontal moreVertical externalLink inbox target crosshair image trendingUp trendingDown barChart cpu power hash clipboard settings loader dot
  Add new icons to `Icon.jsx` using Lucide geometry (24×24, stroke).
- `src/lib/format.js` — `formatLabel(value)` ("IN_PROGRESS" → "In progress"), `STATUS_TONE`, `statusTone(status)`.
- `src/lib/session.js` — `navigateTo(path)`, `logout()`.

**Reference implementation:** `src/pages/admin/AdminDashboard.jsx` and `src/pages/auth/Login.jsx`.

## Theming (light / dark)

Dark mode is a token remap on `:root[data-theme="dark"]`, so pages don't need `dark:` classes. What that relies on:
- Surfaces are `bg-surface` (cards, inputs, popovers, dots' `ring-surface`), never `bg-white`. `text-white` is fine on solid fills.
- Solid fills behind white text use `bg-primary` / `bg-danger` / `bg-success` / `bg-accent`, not `bg-brand-600` / `bg-red-600` etc. In dark mode the palette's 600–950 shades turn light (so `text-brand-600`, `text-red-700` stay readable) and would no longer hold white text.
- Tints `bg-{status}-50/100` and borders `border-{status}-200` become translucent in dark mode; 300/400/500 are unchanged.
- Always-dark areas (sidebar, login brand panel) use `ink-*`, `white/[x]`, and status 300–500 only.
- Use the `dark:` variant only for true one-offs (e.g. an extra border on an always-dark panel).
- Check new UI in both themes; keep text ≥ 4.5:1 in each.

## Motion (Framer Motion)

- One key effect per view: the page's cards/tiles cascade in (40ms stagger, 10px rise). Use the shared primitives and it comes for free; for a custom block that should join, use `<motion.div variants={revealItem}>`.
- Only animate `opacity`/`transform` (or `clip-path` for fills). No width/height/top/left.
- Springs (`SPRING_SNAPPY`) for things that follow input (pills, indicators); `SPRING_SOFT` for panels/dialogs. Exits use `DURATION.exit` + `EASE_IN` and are faster than entrances.
- Skeletons appear instantly (no entrance animation). Live data values tween, they don't re-enter.
- Reduced motion is global (`<MotionConfig reducedMotion="user">` in `main.jsx` + the CSS media query). Don't bypass it.
- Button press feedback is CSS (`active:scale-[0.98]` on `.btn`), not per-button motion.

## Page rules

- Every authenticated page renders inside `<AppShell>` — never build a page-level sidebar or header.
- No unicode glyphs or emoji as icons; use `<Icon>`. Icon-only buttons need `aria-label`.
- Use the shared primitives in `ui.jsx` before writing local ones.
- Layout inside AppShell: optional `PageHeader` (only if it adds info the top bar doesn't — don't just repeat the title), `Alert` for errors (with `onRetry` when a reload fn exists), KPI row of `StatCard`s (`grid gap-4 sm:grid-cols-2 xl:grid-cols-4`), then `Card`s. Section gap `mt-6` / `gap-6`.
- Loading: skeletons (`.skeleton`, `SkeletonRows`) rather than big centred spinners. Buttons doing async work: disabled + `Spinner` + "Saving…" text.
- Empty states: `EmptyState` with a relevant icon + helpful sentence.
- Tables: `.table-wrap > table.table` with `<th scope="col">`; numeric columns right-aligned with `.num`; row click targets remain real `<button>`/`<a>` elements or rows with an explicit button.
- Lists: `ul.divide-y.divide-slate-100` rows with `px-5 py-3.5` inside `Card bodyClassName=""`.
- Filters: `Segmented` or `.chip/.chip-active`; search via `SearchInput` or `.input`.
- Forms: visible `<label className="label" htmlFor>` for every field, `.input/.select/.textarea`, required marked with `<span className="text-red-500">*</span>`, errors near the field with `.error-text`, helper text `.help-text`. Keep `type`, `autoComplete` etc.
- Modals: prefer the shared `Modal` (Escape/backdrop close, focus). Destructive confirmations use `btn-danger`.
- Text: body ≥ 13–14px; labels 11–12px minimum; never below 10.5px. Use slate-500 (not slate-400) for secondary text on white to keep 4.5:1 contrast. Headings `font-semibold`/`font-bold`, avoid `font-black` everywhere.
- Status is never colour-only: badge label always visible.
- Hover/transition 150–200ms, colour/shadow only (no layout-shifting translate on cards). Respect reduced motion (global CSS + MotionConfig already handle it).
- Responsive: must work at 375px — no horizontal page scroll (tables scroll inside `.table-wrap`), grids collapse, top-bar actions stay compact (hide labels with `hidden sm:inline`).
- Detail pages: a summary header card (title, key badges, primary actions), then a 2-column grid `lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]` with details `<dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">` using `DetailItem`, timelines as vertical lists with a left rail (`border-l border-slate-200` + dot markers).
- Live/real-time readings: `.num` values, units in slate-500, "Updated …" timestamp when available.
