import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function navigateTo(path) {
  window.location.href = path;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatStatus(value) {
  if (!value) return "—";

  return String(value).replaceAll("_", " ");
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        active
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function RoleBadge({ role }) {
  const styles = {
    ADMIN:
      "bg-cyan-50 text-cyan-700 border-cyan-100",

    SUPERVISOR:
      "bg-violet-50 text-violet-700 border-violet-100",

    MAINTENANCE_STAFF:
      "bg-amber-50 text-amber-700 border-amber-100",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        styles[role] ||
        "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {formatStatus(role)}
    </span>
  );
}

function NavigationItem({
  icon,
  label,
  path,
  active,
  collapsed,
}) {
  return (
    <button
      type="button"
      onClick={() => navigateTo(path)}
      title={collapsed ? label : undefined}
      className={`group flex w-full items-center rounded-xl text-left text-sm font-semibold transition ${
        collapsed
          ? "justify-center px-2 py-2.5"
          : "gap-3 px-3 py-2.5"
      } ${
        active
          ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
          active
            ? "bg-white/15 text-white"
            : "bg-white/5 text-slate-400 group-hover:text-cyan-300"
        }`}
      >
        {icon}
      </span>

      {!collapsed && (
        <span className="truncate">
          {label}
        </span>
      )}
    </button>
  );
}

function Sidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
}) {
  const adminName =
    localStorage.getItem("name") ||
    "Administrator";

  const adminEmail =
    localStorage.getItem("email") || "";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    localStorage.removeItem("is_active");

    window.location.href = "/";
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-950 transition-all duration-300 lg:flex ${
        sidebarCollapsed
          ? "w-[76px]"
          : "w-64"
      }`}
    >
      {/* BRAND */}
      <div
        className={`flex h-20 items-center border-b border-white/10 ${
          sidebarCollapsed
            ? "justify-center px-3"
            : "justify-between px-5"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-slate-950 shadow-lg shadow-cyan-400/20">
            S
          </div>

          {!sidebarCollapsed && (
            <div>
              <p className="font-black tracking-[0.2em] text-white">
                SIMMS
              </p>

              <p className="text-[9px] uppercase tracking-[0.13em] text-slate-500">
                Admin Console
              </p>
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(true)
            }
            title="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            ‹
          </button>
        )}

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() =>
              setSidebarCollapsed(false)
            }
            title="Expand sidebar"
            className="absolute -right-3 top-6 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-cyan-300 shadow-lg transition hover:bg-slate-800"
          >
            ›
          </button>
        )}
      </div>

      {/* NAVIGATION */}
      <div className="hide-scrollbar flex-1 overflow-y-auto px-3 py-7">
        {!sidebarCollapsed && (
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Main
          </p>
        )}

        <nav className="space-y-1">
          <NavigationItem
            icon="▦"
            label="Dashboard"
            path="/admin/dashboard"
            collapsed={sidebarCollapsed}
          />

          <NavigationItem
            icon="▣"
            label="Classrooms"
            path="/admin/rooms"
            collapsed={sidebarCollapsed}
          />

          <NavigationItem
            icon="⌁"
            label="Devices"
            path="/admin/devices"
            collapsed={sidebarCollapsed}
          />

          <NavigationItem
            icon="◉"
            label="Users"
            path="/admin/users"
            active
            collapsed={sidebarCollapsed}
          />
        </nav>

        {!sidebarCollapsed && (
          <p className="mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
            Management
          </p>
        )}

        <nav className="mt-1 space-y-1">
          <NavigationItem
            icon="⌘"
            label="Calibration"
            path="/admin/calibration"
            collapsed={sidebarCollapsed}
          />
        </nav>

        {!sidebarCollapsed && (
          <div className="mt-8 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-xs font-semibold text-slate-300">
                Monitoring active
              </span>
            </div>

            <p className="mt-3 text-[11px] leading-5 text-slate-500">
              SIMMS is connected to the classroom
              infrastructure monitoring system.
            </p>
          </div>
        )}

        {sidebarCollapsed && (
          <div
            title="Monitoring active"
            className="mx-auto mt-8 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="border-t border-white/10 p-3">
        {!sidebarCollapsed && (
          <div className="mb-3 rounded-xl bg-white/5 p-3">
            <p className="truncate text-xs font-semibold text-white">
              {adminName}
            </p>

            <p className="mt-1 truncate text-[10px] text-slate-500">
              {adminEmail || "Administrator"}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          title={
            sidebarCollapsed
              ? "Logout"
              : undefined
          }
          className={`flex w-full items-center rounded-xl text-sm font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300 ${
            sidebarCollapsed
              ? "justify-center px-2 py-2.5"
              : "gap-3 px-3 py-2.5"
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
            ↪
          </span>

          {!sidebarCollapsed && (
            <span>Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  iconStyle,
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${iconStyle}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [roleFilter, setRoleFilter] =
    useState("ALL");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [showModal, setShowModal] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const [statusUpdatingId, setStatusUpdatingId] =
    useState(null);

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "SUPERVISOR",
  });

  const adminName =
    localStorage.getItem("name") ||
    "Administrator";

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/users`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load users from the SIMMS backend."
        );
      }

      const data =
        await response.json();

      setUsers(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the SIMMS backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const roles = useMemo(() => {
    return Array.from(
      new Set(
        users
          .map((user) => user.role)
          .filter(Boolean)
      )
    ).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    const search =
      searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !search ||
        String(user.user_id)
          .toLowerCase()
          .includes(search) ||
        String(user.name || "")
          .toLowerCase()
          .includes(search) ||
        String(user.email || "")
          .toLowerCase()
          .includes(search) ||
        String(user.role || "")
          .toLowerCase()
          .includes(search);

      const matchesRole =
        roleFilter === "ALL" ||
        user.role === roleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" &&
          user.is_active) ||
        (statusFilter === "INACTIVE" &&
          !user.is_active);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [
    users,
    searchTerm,
    roleFilter,
    statusFilter,
  ]);

  const activeUsers = users.filter(
    (user) => user.is_active
  ).length;

  const inactiveUsers =
    users.length - activeUsers;

  const adminUsers = users.filter(
    (user) => user.role === "ADMIN"
  ).length;

  const openAddModal = () => {
    setEditingUser(null);

    setUserForm({
      name: "",
      email: "",
      password: "",
      role: "SUPERVISOR",
    });

    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);

    setUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "SUPERVISOR",
    });

    setShowModal(true);
  };

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setUserForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !userForm.name.trim() ||
      !userForm.email.trim() ||
      !userForm.role
    ) {
      setError(
        "Name, email, and role are required."
      );

      return;
    }

    if (
      !editingUser &&
      !userForm.password.trim()
    ) {
      setError(
        "Password is required when creating a user."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
      };

      /*
       * Password is included only when creating
       * a user or when the user explicitly enters
       * a new password during editing.
       */
      if (
        !editingUser ||
        userForm.password.trim()
      ) {
        payload.password =
          userForm.password.trim();
      }

      const response = editingUser
        ? await fetch(
            `${API_BASE_URL}/users/${editingUser.user_id}`,
            {
              method: "PUT",
              headers: getAuthHeaders(),
              body: JSON.stringify(
                payload
              ),
            }
          )
        : await fetch(
            `${API_BASE_URL}/users`,
            {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(
                payload
              ),
            }
          );

      if (!response.ok) {
        let detail =
          "Unable to save user.";

        try {
          const data =
            await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail ===
              "string"
                ? data.detail
                : JSON.stringify(
                    data.detail
                  );
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      setShowModal(false);

      await loadUsers();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save user."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (
    user
  ) => {
    const nextStatus =
      !user.is_active;

    try {
      setStatusUpdatingId(
        user.user_id
      );

      setError("");

      const response = await fetch(
        `${API_BASE_URL}/users/${user.user_id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            is_active: nextStatus,
          }),
        }
      );

      if (!response.ok) {
        let detail =
          "Unable to update user status.";

        try {
          const data =
            await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail ===
              "string"
                ? data.detail
                : JSON.stringify(
                    data.detail
                  );
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      await loadUsers();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update user status."
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        sidebarCollapsed={
          sidebarCollapsed
        }
        setSidebarCollapsed={
          setSidebarCollapsed
        }
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed
            ? "lg:pl-[76px]"
            : "lg:pl-64"
        }`}
      >
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400">
                  Administration
                </p>

                <h1 className="text-lg font-bold text-slate-900">
                  User Management
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-semibold text-emerald-700">
                  System connected
                </span>
              </div>

              <button
                type="button"
                onClick={loadUsers}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700 ring-1 ring-cyan-100 sm:flex">
                {adminName
                  .charAt(0)
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8">
          {/* HERO */}
          <section className="mb-8 overflow-hidden rounded-3xl bg-slate-950 p-7 shadow-xl shadow-slate-300/30 sm:p-9">
            <div className="relative">
              <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full border-[40px] border-cyan-400/10" />

              <div className="absolute -bottom-40 right-24 h-80 w-80 rounded-full border-[45px] border-blue-400/5" />

              <div className="relative z-10 max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                    Access administration
                  </span>
                </div>

                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Manage SIMMS users
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Create and maintain administrator,
                  supervisor, and maintenance staff
                  accounts for the SIMMS platform.
                </p>

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-50"
                  >
                    + Add user
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-bold text-red-800">
                User data could not be processed
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={loadUsers}
                className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* STATS */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total users"
              value={users.length}
              description="Registered accounts"
              icon="◉"
              iconStyle="bg-cyan-50 text-cyan-700"
            />

            <StatCard
              title="Active"
              value={activeUsers}
              description="Currently active accounts"
              icon="✓"
              iconStyle="bg-emerald-50 text-emerald-700"
            />

            <StatCard
              title="Inactive"
              value={inactiveUsers}
              description="Currently inactive accounts"
              icon="○"
              iconStyle="bg-slate-100 text-slate-600"
            />

            <StatCard
              title="Administrators"
              value={adminUsers}
              description="Admin accounts"
              icon="★"
              iconStyle="bg-violet-50 text-violet-700"
            />
          </section>

          {/* FILTERS */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-600">
                User directory
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Search and filter users
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Search
                </label>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search name, email, role or user ID..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Role
                </label>

                <select
                  value={roleFilter}
                  onChange={(event) =>
                    setRoleFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="ALL">
                    All roles
                  </option>

                  {roles.map((role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {formatStatus(role)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="ALL">
                    All statuses
                  </option>

                  <option value="ACTIVE">
                    Active
                  </option>

                  <option value="INACTIVE">
                    Inactive
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="h-11 self-end rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </section>

          {/* TABLE */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-600">
                Registered accounts
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-900">
                System users
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Showing{" "}
                {filteredUsers.length}{" "}
                of {users.length} users
              </p>
            </div>

            {loading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3, 4, 5].map(
                  (item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-xl bg-slate-100"
                    />
                  )
                )}
              </div>
            ) : filteredUsers.length ===
              0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                  ◉
                </div>

                <p className="mt-4 text-sm font-bold text-slate-700">
                  No users found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  No users match the current
                  search or filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        User
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Email
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Role
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Created
                      </th>

                      <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map(
                      (user) => (
                        <tr
                          key={user.user_id}
                          className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-black text-cyan-700">
                                {user.name
                                  ?.charAt(
                                    0
                                  )
                                  .toUpperCase() ||
                                  "U"}
                              </div>

                              <div>
                                <p className="text-sm font-bold text-slate-700">
                                  {user.name ||
                                    "—"}
                                </p>

                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  User ID{" "}
                                  {
                                    user.user_id
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm text-slate-600">
                              {user.email ||
                                "—"}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <RoleBadge
                              role={
                                user.role
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge
                              active={
                                user.is_active
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-xs font-semibold text-slate-600">
                              {formatDate(
                                user.created_at
                              )}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    user
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={
                                  statusUpdatingId ===
                                  user.user_id
                                }
                                onClick={() =>
                                  toggleUserStatus(
                                    user
                                  )
                                }
                                className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                                  user.is_active
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {statusUpdatingId ===
                                user.user_id
                                  ? "Updating..."
                                  : user.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="mt-8 border-t border-slate-200 py-6">
            <div className="flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">
              <p>
                SIMMS · Smart Classroom
                Infrastructure Monitoring System
              </p>

              <p>
                Administration Console · v1.0
              </p>
            </div>
          </footer>
        </main>
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-600">
                  Account configuration
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {editingUser
                    ? "Edit user"
                    : "Add user"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={userForm.name}
                  onChange={handleChange}
                  placeholder="Full name"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Email
                </label>

                <input
                  type="email"
                  name="email"
                  value={userForm.email}
                  onChange={handleChange}
                  placeholder="user@example.com"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Role
                </label>

                <select
                  name="role"
                  value={userForm.role}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="ADMIN">
                    Admin
                  </option>

                  <option value="SUPERVISOR">
                    Supervisor
                  </option>

                  <option value="MAINTENANCE_STAFF">
                    Maintenance Staff
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  {editingUser
                    ? "New password (optional)"
                    : "Password"}
                </label>

                <input
                  type="password"
                  name="password"
                  value={
                    userForm.password
                  }
                  onChange={handleChange}
                  placeholder={
                    editingUser
                      ? "Leave blank to keep current password"
                      : "Enter password"
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingUser
                    ? "Save changes"
                    : "Create user"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}