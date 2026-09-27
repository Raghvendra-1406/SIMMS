import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function navigateTo(path) {
  window.location.href = path;
}

function getDisplayValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return `${value}${suffix}`;
}

function getHealthStatusClass(status) {
  switch (String(status || "").toUpperCase()) {
    case "NORMAL":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "WARNING":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";

    case "CRITICAL":
      return "border-red-400/20 bg-red-400/10 text-red-300";

    default:
      return "border-slate-700 bg-slate-800 text-slate-400";
  }
}

function getClassroomStatusClass(status) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "INACTIVE":
      return "border-slate-700 bg-slate-800 text-slate-400";

    default:
      return "border-slate-700 bg-slate-800 text-slate-400";
  }
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

function SummaryCard({
  label,
  value,
  icon,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-lg font-bold text-cyan-600">
          {icon}
        </div>
      </div>

      {description && (
        <p className="mt-3 text-xs text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

export default function SupervisorClassrooms() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [supervisorName, setSupervisorName] = useState("Supervisor");
  const [supervisorEmail, setSupervisorEmail] = useState("");

  const [classrooms, setClassrooms] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [faults, setFaults] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedName = localStorage.getItem("name");
    const storedEmail = localStorage.getItem("email");

    if (storedName) {
      setSupervisorName(storedName);
    }

    if (storedEmail) {
      setSupervisorEmail(storedEmail);
    }
  }, []);

  useEffect(() => {
    loadClassroomData();
  }, []);

  async function fetchApi(endpoint) {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      let message = `Request failed with status ${response.status}.`;

      try {
        const data = await response.json();

        if (data?.detail) {
          message = data.detail;
        }
      } catch {
        // Keep default error message.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function loadClassroomData() {
    setLoading(true);
    setError("");

    try {
      const [
        classroomResponse,
        healthResponse,
        faultResponse,
      ] = await Promise.all([
        fetchApi("/classrooms"),
        fetchApi("/health/classrooms"),
        fetchApi("/faults/active"),
      ]);

      setClassrooms(
        Array.isArray(classroomResponse)
          ? classroomResponse
          : []
      );

      setHealthData(
        Array.isArray(healthResponse)
          ? healthResponse
          : []
      );

      setFaults(
        Array.isArray(faultResponse)
          ? faultResponse
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load classroom monitoring data."
      );
    } finally {
      setLoading(false);
    }
  }

  const healthByRoom = useMemo(() => {
    const map = new Map();

    healthData.forEach((health) => {
      if (health?.room_id !== undefined) {
        map.set(Number(health.room_id), health);
      }
    });

    return map;
  }, [healthData]);

  const faultsByRoom = useMemo(() => {
    const map = new Map();

    faults.forEach((fault) => {
      if (fault?.room_id === undefined) {
        return;
      }

      const roomId = Number(fault.room_id);

      if (!map.has(roomId)) {
        map.set(roomId, []);
      }

      map.get(roomId).push(fault);
    });

    return map;
  }, [faults]);

  const classroomRows = useMemo(() => {
    return classrooms.map((classroom) => {
      const roomId = Number(classroom.room_id);

      const health = healthByRoom.get(roomId);

      const roomFaults = faultsByRoom.get(roomId) || [];

      return {
        ...classroom,
        health: health || null,
        roomFaults,
        activeFaultCount: health
          ? Number(health.active_fault_count || 0)
          : roomFaults.length,
      };
    });
  }, [
    classrooms,
    healthByRoom,
    faultsByRoom,
  ]);

  const filteredClassrooms = useMemo(() => {
    const search = searchTerm
      .trim()
      .toLowerCase();

    return classroomRows.filter((classroom) => {
      const matchesSearch =
        !search ||
        String(classroom.room_id || "")
          .toLowerCase()
          .includes(search) ||
        String(classroom.room_name || "")
          .toLowerCase()
          .includes(search) ||
        String(classroom.building || "")
          .toLowerCase()
          .includes(search) ||
        String(classroom.room_type || "")
          .toLowerCase()
          .includes(search);

      const classroomStatus = String(
        classroom.status || ""
      ).toUpperCase();

      const healthStatus = String(
        classroom.health?.health_status || ""
      ).toUpperCase();

      const matchesStatus =
        statusFilter === "ALL" ||
        classroomStatus === statusFilter;

      const matchesHealth =
        healthFilter === "ALL"
          ? true
          : healthFilter === "NO_DATA"
            ? !classroom.health
            : healthStatus === healthFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesHealth
      );
    });
  }, [
    classroomRows,
    searchTerm,
    statusFilter,
    healthFilter,
  ]);

  const statistics = useMemo(() => {
    const total = classrooms.length;

    const active = classrooms.filter(
      (classroom) =>
        String(classroom.status || "")
          .toUpperCase() === "ACTIVE"
    ).length;

    const inactive = classrooms.filter(
      (classroom) =>
        String(classroom.status || "")
          .toUpperCase() === "INACTIVE"
    ).length;

    const normal = classroomRows.filter(
      (classroom) =>
        String(
          classroom.health?.health_status || ""
        ).toUpperCase() === "NORMAL"
    ).length;

    const warning = classroomRows.filter(
      (classroom) =>
        String(
          classroom.health?.health_status || ""
        ).toUpperCase() === "WARNING"
    ).length;

    const critical = classroomRows.filter(
      (classroom) =>
        String(
          classroom.health?.health_status || ""
        ).toUpperCase() === "CRITICAL"
    ).length;

    const noHealthData = classroomRows.filter(
      (classroom) => !classroom.health
    ).length;

    return {
      total,
      active,
      inactive,
      normal,
      warning,
      critical,
      noHealthData,
    };
  }, [classrooms, classroomRows]);

  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    localStorage.removeItem("user_id");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    localStorage.removeItem("is_active");

    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-950 transition-all duration-300 lg:flex ${
          sidebarCollapsed
            ? "w-[76px]"
            : "w-64"
        }`}
      >
        {/* Brand */}
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
                  Supervisor Console
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

        {/* Navigation */}
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
              path="/supervisor/dashboard"
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="▣"
              label="Classrooms"
              path="/supervisor/classrooms"
              active
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="⌁"
              label="Monitoring"
              path="/supervisor/monitoring"
              collapsed={sidebarCollapsed}
            />
          </nav>

          {!sidebarCollapsed && (
            <p className="mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Operations
            </p>
          )}

          <nav className="mt-1 space-y-1">
            <NavigationItem
              icon="⚠"
              label="Faults"
              path="/supervisor/faults"
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="⌘"
              label="Tickets"
              path="/supervisor/tickets"
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="◉"
              label="Notifications"
              path="/supervisor/notifications"
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

        {/* Footer */}
        <div className="border-t border-white/10 p-3">
          {!sidebarCollapsed && (
            <div className="mb-3 rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-white">
                {supervisorName}
              </p>

              <p className="mt-1 truncate text-[10px] text-slate-500">
                {supervisorEmail || "Supervisor"}
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

      {/* Main */}
      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed
            ? "lg:pl-[76px]"
            : "lg:pl-64"
        }`}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                  Supervisor
                </p>

                <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  Classrooms
                </h1>
              </div>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />

              <span className="text-xs font-semibold text-slate-500">
                System monitoring active
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-red-50 hover:text-red-500 sm:hidden"
              title="Logout"
            >
              ↪
            </button>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8 sm:py-9">
          {/* Page heading */}
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Classroom infrastructure overview
              </p>

              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                All Classrooms
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                View classroom configuration together
                with the latest available health,
                environmental and fault information.
              </p>
            </div>

            <button
              type="button"
              onClick={loadClassroomData}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:text-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-red-700">
                    Unable to load classroom data
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-600">
                    {error}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadClassroomData}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Classrooms"
              value={
                loading
                  ? "—"
                  : statistics.total
              }
              icon="▣"
              description="Configured classrooms"
            />

            <SummaryCard
              label="Active"
              value={
                loading
                  ? "—"
                  : statistics.active
              }
              icon="●"
              description="Currently active classrooms"
            />

            <SummaryCard
              label="Normal"
              value={
                loading
                  ? "—"
                  : statistics.normal
              }
              icon="✓"
              description="Latest health status"
            />

            <SummaryCard
              label="Active faults"
              value={
                loading
                  ? "—"
                  : faults.length
              }
              icon="⚠"
              description="Confirmed active faults"
            />
          </div>

          {/* Health status strip */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">
                Normal
              </p>

              <p className="mt-2 text-2xl font-black text-emerald-700">
                {loading
                  ? "—"
                  : statistics.normal}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600">
                Warning
              </p>

              <p className="mt-2 text-2xl font-black text-amber-700">
                {loading
                  ? "—"
                  : statistics.warning}
              </p>
            </div>

            <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-600">
                Critical
              </p>

              <p className="mt-2 text-2xl font-black text-red-700">
                {loading
                  ? "—"
                  : statistics.critical}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                No health data
              </p>

              <p className="mt-2 text-2xl font-black text-slate-700">
                {loading
                  ? "—"
                  : statistics.noHealthData}
              </p>
            </div>
          </div>

          {/* Filters */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  ⌕
                </span>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search by classroom, building, room type or ID..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                >
                  <option value="ALL">
                    All classroom status
                  </option>
                  <option value="ACTIVE">
                    Active
                  </option>
                  <option value="INACTIVE">
                    Inactive
                  </option>
                </select>

                <select
                  value={healthFilter}
                  onChange={(event) =>
                    setHealthFilter(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10"
                >
                  <option value="ALL">
                    All health status
                  </option>
                  <option value="NORMAL">
                    Normal
                  </option>
                  <option value="WARNING">
                    Warning
                  </option>
                  <option value="CRITICAL">
                    Critical
                  </option>
                  <option value="NO_DATA">
                    No health data
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* Classroom table */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Classroom Status
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    {loading
                      ? "Loading classrooms..."
                      : `${filteredClassrooms.length} classroom${
                          filteredClassrooms.length === 1
                            ? ""
                            : "s"
                        } shown`}
                  </p>
                </div>

                {!loading &&
                  filteredClassrooms.length !==
                    classroomRows.length && (
                    <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-600">
                      Filters applied
                    </span>
                  )}
              </div>
            </div>

            {loading ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

                <p className="mt-4 text-sm font-semibold text-slate-500">
                  Loading classroom information...
                </p>
              </div>
            ) : filteredClassrooms.length ===
              0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                  ▣
                </div>

                <h3 className="mt-4 text-sm font-black text-slate-800">
                  No classrooms found
                </h3>

                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">
                  No classroom matches the current
                  search and filter settings.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1050px] w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400 sm:px-6">
                        Classroom
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Location
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Capacity
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Classroom status
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Health
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Environment
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Occupancy
                      </th>

                      <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Faults
                      </th>

                      <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredClassrooms.map(
                      (classroom) => {
                        const health =
                          classroom.health;

                        const healthStatus =
                          health?.health_status;

                        return (
                          <tr
                            key={
                              classroom.room_id
                            }
                            className="border-b border-slate-100 last:border-b-0 transition hover:bg-slate-50/70"
                          >
                            {/* Classroom */}
                            <td className="px-5 py-5 sm:px-6">
                              <button
                                type="button"
                                onClick={() =>
                                  navigateTo(
                                    `/supervisor/classrooms/${classroom.room_id}`
                                  )
                                }
                                className="text-left"
                              >
                                <p className="font-bold text-slate-900 transition hover:text-cyan-600">
                                  {classroom.room_name ||
                                    `Room ${classroom.room_id}`}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  ID #{classroom.room_id}
                                  {classroom.room_type
                                    ? ` · ${classroom.room_type}`
                                    : ""}
                                </p>
                              </button>
                            </td>

                            {/* Location */}
                            <td className="px-5 py-5">
                              <p className="text-sm font-semibold text-slate-700">
                                {classroom.building ||
                                  "—"}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {classroom.floor !==
                                null &&
                                classroom.floor !==
                                  undefined
                                  ? `Floor ${classroom.floor}`
                                  : "Floor —"}
                              </p>
                            </td>

                            {/* Capacity */}
                            <td className="px-5 py-5">
                              <span className="text-sm font-bold text-slate-700">
                                {getDisplayValue(
                                  classroom.capacity
                                )}
                              </span>
                            </td>

                            {/* Classroom status */}
                            <td className="px-5 py-5">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getClassroomStatusClass(
                                  classroom.status
                                )}`}
                              >
                                {classroom.status ||
                                  "UNKNOWN"}
                              </span>
                            </td>

                            {/* Health */}
                            <td className="px-5 py-5">
                              {health ? (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getHealthStatusClass(
                                        healthStatus
                                      )}`}
                                    >
                                      {healthStatus ||
                                        "UNKNOWN"}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-xs font-semibold text-slate-500">
                                    Score:{" "}
                                    {getDisplayValue(
                                      health.health_score
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                    No health data
                                  </span>

                                  <p className="mt-2 text-xs text-slate-400">
                                    Not calculated yet
                                  </p>
                                </div>
                              )}
                            </td>

                            {/* Environment */}
                            <td className="px-5 py-5">
                              {health ? (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-slate-700">
                                    🌡{" "}
                                    {getDisplayValue(
                                      health.temperature,
                                      "°C"
                                    )}
                                  </p>

                                  <p className="text-xs font-semibold text-slate-500">
                                    💧{" "}
                                    {getDisplayValue(
                                      health.humidity,
                                      "%"
                                    )}
                                  </p>

                                  <p className="text-xs font-semibold text-slate-500">
                                    ⚡{" "}
                                    {getDisplayValue(
                                      health.power,
                                      " W"
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Occupancy */}
                            <td className="px-5 py-5">
                              {health ? (
                                <div>
                                  <p className="text-lg font-black text-slate-800">
                                    {getDisplayValue(
                                      health.occupancy_count
                                    )}
                                  </p>

                                  <p className="text-[10px] uppercase tracking-wide text-slate-400">
                                    people
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Faults */}
                            <td className="px-5 py-5">
                              <span
                                className={`inline-flex min-w-8 items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black ${
                                  classroom.activeFaultCount >
                                  0
                                    ? "bg-red-50 text-red-600"
                                    : "bg-emerald-50 text-emerald-600"
                                }`}
                              >
                                {
                                  classroom.activeFaultCount
                                }
                              </span>
                            </td>

                            {/* Action */}
                            <td className="px-5 py-5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  navigateTo(
                                    `/supervisor/classrooms/${classroom.room_id}`
                                  )
                                }
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-600"
                              >
                                View details →
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}