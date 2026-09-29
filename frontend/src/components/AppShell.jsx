import { useEffect, useState } from "react";
import Icon from "./Icon";
import { logout } from "../lib/session";

const API_BASE_URL = "http://localhost:8000";
const COLLAPSE_KEY = "simms.sidebarCollapsed";

// Navigation per role. `match` decides the active item by path prefix.
const NAVIGATION = {
  ADMIN: {
    console: "Admin Console",
    home: "/admin/dashboard",
    sections: [
      {
        title: "Overview",
        items: [
          { label: "Dashboard", icon: "dashboard", path: "/admin/dashboard" },
          { label: "Live monitor", icon: "activity", path: "/admin/monitoring" },
        ],
      },
      {
        title: "Infrastructure",
        items: [
          { label: "Classrooms", icon: "classroom", path: "/admin/rooms" },
          { label: "Devices", icon: "device", path: "/admin/devices" },
          { label: "Calibration", icon: "calibration", path: "/admin/calibration" },
        ],
      },
      {
        title: "Access",
        items: [{ label: "Users", icon: "users", path: "/admin/users" }],
      },
    ],
  },
  SUPERVISOR: {
    console: "Supervisor Console",
    home: "/supervisor/dashboard",
    sections: [
      {
        title: "Overview",
        items: [
          { label: "Dashboard", icon: "dashboard", path: "/supervisor/dashboard" },
          { label: "Classrooms", icon: "classroom", path: "/supervisor/classrooms" },
          { label: "Live monitor", icon: "activity", path: "/supervisor/monitoring" },
        ],
      },
      {
        title: "Operations",
        items: [
          { label: "Faults", icon: "alert", path: "/supervisor/faults" },
          { label: "Tickets", icon: "ticket", path: "/supervisor/tickets" },
          {
            label: "Notifications",
            icon: "bell",
            path: "/supervisor/notifications",
            badgeKey: "unread",
          },
        ],
      },
    ],
  },
  MAINTENANCE_STAFF: {
    console: "Maintenance Console",
    home: "/maintenance/dashboard",
    sections: [
      {
        title: "Workspace",
        items: [
          { label: "Dashboard", icon: "dashboard", path: "/maintenance/dashboard" },
          { label: "My tickets", icon: "wrench", path: "/maintenance/tickets" },
        ],
      },
    ],
  },
};

const ROLE_LABELS = {
  ADMIN: "Administrator",
  SUPERVISOR: "Supervisor",
  MAINTENANCE_STAFF: "Maintenance",
};

function isActive(itemPath, currentPath) {
  if (currentPath === itemPath) return true;
  // Dashboards only match exactly; list pages also own their detail pages.
  if (itemPath.endsWith("/dashboard")) return false;
  return currentPath.startsWith(`${itemPath}/`);
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function initials(name) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "U"
  );
}

export function BrandMark({ className = "h-9 w-9", textClass = "text-base" }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 font-extrabold text-white shadow-[0_6px_16px_-6px_rgb(66_99_235/0.7)] ring-1 ring-white/15 ${className} ${textClass}`}
    >
      <span className="relative z-10">S</span>
      <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-white/20 blur-[6px]" />
    </div>
  );
}

function NavLink({ item, active, collapsed, badge, onNavigate }) {
  return (
    <a
      href={item.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex h-10 items-center rounded-lg text-[13px] font-medium transition-colors duration-150 ${
        collapsed ? "justify-center px-0" : "gap-3 px-3"
      } ${
        active
          ? "bg-white/[0.08] text-white"
          : "text-ink-300 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-400" />
      )}

      <Icon
        name={item.icon}
        className={`h-[18px] w-[18px] ${
          active ? "text-brand-300" : "text-ink-400 group-hover:text-ink-200"
        }`}
      />

      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

      {badge > 0 &&
        (collapsed ? (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-ink-950" />
        ) : (
          <span className="num rounded-full bg-red-500/90 px-1.5 py-px text-[10px] font-semibold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ))}

      {badge > 0 && <span className="sr-only">, {badge} unread</span>}
    </a>
  );
}

function SidebarContent({ nav, currentPath, collapsed, badges, onNavigate, onToggleCollapse, onClose, user }) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-white/[0.06] ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        <a href={nav.home} className="flex min-w-0 items-center gap-3" aria-label="SIMMS home">
          <BrandMark />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="text-[15px] font-bold tracking-[0.14em] text-white">SIMMS</p>
              <p className="truncate text-[11px] font-medium text-ink-400">{nav.console}</p>
            </div>
          )}
        </a>

        {onClose && (
          <button type="button" onClick={onClose} className="btn-icon text-ink-300 hover:bg-white/10 hover:text-white" aria-label="Close navigation">
            <Icon name="x" className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Primary" className="hide-scrollbar flex-1 overflow-y-auto px-3 py-5">
        {nav.sections.map((section, index) => (
          <div key={section.title} className={index > 0 ? "mt-6" : ""}>
            {collapsed ? (
              index > 0 && <div className="mx-3 mb-3 h-px bg-white/[0.06]" />
            ) : (
              <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    item={item}
                    active={isActive(item.path, currentPath)}
                    collapsed={collapsed}
                    badge={item.badgeKey ? badges[item.badgeKey] : 0}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {!collapsed && (
          <div className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-xs font-semibold text-ink-100">Monitoring active</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">
              Sensors and vision pipeline are reporting to SIMMS.
            </p>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div className={`flex items-center ${collapsed ? "flex-col gap-2" : "gap-3 px-1"}`}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-ink-100 ring-1 ring-white/10"
            title={collapsed ? `${user.name} · ${user.roleLabel}` : undefined}
          >
            {initials(user.name)}
          </div>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11px] text-ink-400">{user.email || user.roleLabel}</p>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className="btn-icon h-8 w-8 text-ink-400 hover:bg-red-500/10 hover:text-red-300"
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon name="logout" className="h-[18px] w-[18px]" />
          </button>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`mt-2 flex h-8 w-full items-center rounded-lg text-xs font-medium text-ink-400 transition-colors hover:bg-white/[0.04] hover:text-white ${
              collapsed ? "justify-center" : "gap-2 px-2"
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <Icon name={collapsed ? "chevronRight" : "chevronLeft"} className="h-4 w-4" />
            {!collapsed && "Collapse"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Shared application frame: sidebar navigation, sticky top bar and page container.
 *
 * Props
 *  - title        page title shown in the top bar (required)
 *  - eyebrow      small context label above the title (e.g. "Operations")
 *  - backHref     renders a back button linking to this path (detail pages)
 *  - actions      nodes rendered on the right side of the top bar
 *  - unreadCount  overrides the sidebar notification badge (supervisor)
 *  - wide         use full-width container instead of the default max width
 */
export default function AppShell({ title, eyebrow, backHref, actions, unreadCount, wide = false, children }) {
  const role = localStorage.getItem("role") || "ADMIN";
  const nav = NAVIGATION[role] || NAVIGATION.ADMIN;
  const currentPath = window.location.pathname;

  const user = {
    name: localStorage.getItem("name") || ROLE_LABELS[role] || "User",
    email: localStorage.getItem("email") || "",
    roleLabel: ROLE_LABELS[role] || role,
  };

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fetchedUnread, setFetchedUnread] = useState(0);

  const badges = { unread: unreadCount ?? fetchedUnread };

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  // Supervisor sidebar shows the unread notification count.
  useEffect(() => {
    if (role !== "SUPERVISOR" || unreadCount !== undefined) return;

    let cancelled = false;
    const token = localStorage.getItem("access_token");

    // Refreshed periodically so new-ticket notifications show up
    // without reloading the page.
    const fetchUnread = () => {
      if (document.hidden) return;

      fetch(`${API_BASE_URL}/notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          const count = Array.isArray(data) ? data.length : Number(data.count ?? data.unread_count ?? 0);
          setFetchedUnread(Number.isFinite(count) ? count : 0);
        })
        .catch(() => {});
    };

    fetchUnread();
    const timer = setInterval(fetchUnread, 15000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [role, unreadCount]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event) => event.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    document.title = title ? `${title} · SIMMS` : "SIMMS";
  }, [title]);

  return (
    <div className="min-h-dvh bg-canvas text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-raised"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden bg-ink-950 transition-[width] duration-200 ease-out lg:block ${
          collapsed ? "w-[72px]" : "w-60"
        }`}
      >
        <SidebarContent
          nav={nav}
          currentPath={currentPath}
          collapsed={collapsed}
          badges={badges}
          user={user}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-in-left bg-ink-950 shadow-overlay">
            <SidebarContent
              nav={nav}
              currentPath={currentPath}
              collapsed={false}
              badges={badges}
              user={user}
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className={`min-h-dvh transition-[padding] duration-200 ease-out ${collapsed ? "lg:pl-[72px]" : "lg:pl-60"}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/75">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="btn-icon -ml-1 lg:hidden"
              aria-label="Open navigation"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>

            {backHref && (
              <a href={backHref} className="btn-icon border border-slate-200 bg-white shadow-xs" aria-label="Go back">
                <Icon name="arrowLeft" className="h-4 w-4" />
              </a>
            )}

            <div className="min-w-0 flex-1">
              {eyebrow && <p className="truncate text-[11px] font-medium text-slate-500">{eyebrow}</p>}
              <h1 className="truncate text-[17px] font-bold tracking-tight text-slate-900">{title}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className={`mx-auto w-full px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8 ${wide ? "" : "max-w-[1440px]"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
