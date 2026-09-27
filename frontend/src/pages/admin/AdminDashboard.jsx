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

  return value.replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const styles = {
    EXCELLENT: "bg-emerald-50 text-emerald-700 border-emerald-100",
    GOOD: "bg-green-50 text-green-700 border-green-100",
    WARNING: "bg-amber-50 text-amber-700 border-amber-100",
    CRITICAL: "bg-red-50 text-red-700 border-red-100",

    OPEN: "bg-red-50 text-red-700 border-red-100",
    IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-100",
    RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-100",
    CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
    REOPENED: "bg-orange-50 text-orange-700 border-orange-100",

    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
    INACTIVE: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        styles[status] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  iconStyle,
  valueStyle = "text-slate-900",
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </p>

          <p
            className={`mt-3 text-3xl font-black tracking-tight ${valueStyle}`}
          >
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

function SectionTitle({
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      {eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-600">
          {eyebrow}
        </p>
      )}

      <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [classrooms, setClassrooms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [faults, setFaults] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [healthScores, setHealthScores] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const adminName =
    localStorage.getItem("name") || "Administrator";

  const adminEmail =
    localStorage.getItem("email") || "";

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = getAuthHeaders();

      const [
        classroomsResponse,
        devicesResponse,
        faultsResponse,
        ticketsResponse,
        healthResponse,
        usersResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/classrooms`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/devices`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/faults/active`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/tickets`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/health/classrooms`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/users`, {
          headers,
        }),
      ]);

      if (
        !classroomsResponse.ok ||
        !devicesResponse.ok ||
        !faultsResponse.ok ||
        !ticketsResponse.ok ||
        !healthResponse.ok ||
        !usersResponse.ok
      ) {
        throw new Error(
          "Unable to load dashboard data from the SIMMS backend."
        );
      }

      const [
        classroomsData,
        devicesData,
        faultsData,
        ticketsData,
        healthData,
        usersData,
      ] = await Promise.all([
        classroomsResponse.json(),
        devicesResponse.json(),
        faultsResponse.json(),
        ticketsResponse.json(),
        healthResponse.json(),
        usersResponse.json(),
      ]);

      setClassrooms(
        Array.isArray(classroomsData)
          ? classroomsData
          : []
      );

      setDevices(
        Array.isArray(devicesData)
          ? devicesData
          : []
      );

      setFaults(
        Array.isArray(faultsData)
          ? faultsData
          : []
      );

      setTickets(
        Array.isArray(ticketsData)
          ? ticketsData
          : []
      );

      setHealthScores(
        Array.isArray(healthData)
          ? healthData
          : []
      );

      setUsers(
        Array.isArray(usersData)
          ? usersData
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
    loadDashboardData();
  }, []);

  const activeClassrooms = classrooms.filter(
    (classroom) => classroom.status === "ACTIVE"
  );

  const activeDevices = devices.filter(
    (device) => device.status === "ACTIVE"
  );

  const activeUsers = users.filter(
    (user) => user.is_active
  );

  const openTickets = tickets.filter(
    (ticket) =>
      ticket.status === "OPEN" ||
      ticket.status === "IN_PROGRESS" ||
      ticket.status === "REOPENED"
  );

  const healthSummary = useMemo(() => {
    return {
      excellent: healthScores.filter(
        (item) => item.health_status === "EXCELLENT"
      ).length,

      good: healthScores.filter(
        (item) => item.health_status === "GOOD"
      ).length,

      warning: healthScores.filter(
        (item) => item.health_status === "WARNING"
      ).length,

      critical: healthScores.filter(
        (item) => item.health_status === "CRITICAL"
      ).length,
    };
  }, [healthScores]);

  const getRoomName = (roomId) => {
    const room = classrooms.find(
      (item) => item.room_id === roomId
    );

    return (
      room?.room_name ||
      `Room ${roomId}`
    );
  };

  const getDeviceName = (deviceId) => {
    if (!deviceId) {
      return "Room-level";
    }

    const device = devices.find(
      (item) => item.device_id === deviceId
    );

    return (
      device?.device_name ||
      `Device ${deviceId}`
    );
  };

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
    <div className="min-h-screen bg-slate-100 text-slate-900">

      {/* ===================================================== */}
      {/* SIDEBAR */}
      {/* ===================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-950 transition-all duration-300 lg:flex ${
          sidebarCollapsed
            ? "w-[76px]"
            : "w-64"
        }`}
      >

        {/* BRAND + COLLAPSE BUTTON */}
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
              active
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

          {/* MONITORING STATUS */}
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

        {/* SIDEBAR FOOTER */}
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
            title={sidebarCollapsed ? "Logout" : undefined}
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

      {/* ===================================================== */}
      {/* MAIN AREA */}
      {/* ===================================================== */}

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

              {/* MOBILE BRAND */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400">
                  Administration
                </p>

                <h1 className="text-lg font-bold text-slate-900">
                  System Dashboard
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">

              {/* CONNECTION STATUS */}
              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-semibold text-emerald-700">
                  System connected
                </span>
              </div>

              {/* REFRESH */}
              <button
                type="button"
                onClick={loadDashboardData}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              {/* PROFILE */}
              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700 ring-1 ring-cyan-100 sm:flex">
                {adminName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              {/* MOBILE LOGOUT */}
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 lg:hidden"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* ================================================= */}
        {/* PAGE CONTENT */}
        {/* ================================================= */}

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
                    Infrastructure overview
                  </span>
                </div>

                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Welcome back,{" "}
                  <span className="text-cyan-300">
                    {adminName.split(" ")[0]}
                  </span>
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Manage classrooms, connected devices,
                  users, and calibration settings from the
                  SIMMS administration console.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      navigateTo("/admin/rooms")
                    }
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-50"
                  >
                    Manage classrooms →
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      navigateTo("/admin/devices")
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                    View devices
                  </button>

                </div>
              </div>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">

              <p className="text-sm font-bold text-red-800">
                Dashboard data could not be loaded
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={loadDashboardData}
                className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Try again
              </button>

            </div>
          )}

          {loading ? (
            <div className="flex min-h-[500px] items-center justify-center rounded-3xl border border-slate-200 bg-white">

              <div className="text-center">

                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />

                <p className="mt-4 text-sm font-semibold text-slate-600">
                  Loading dashboard
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Fetching live SIMMS data...
                </p>

              </div>
            </div>
          ) : (
            <>

              {/* ================================================= */}
              {/* STAT CARDS */}
              {/* ================================================= */}

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <StatCard
                  title="Classrooms"
                  value={classrooms.length}
                  description={`${activeClassrooms.length} active classrooms`}
                  icon="▣"
                  iconStyle="bg-cyan-50 text-cyan-700"
                />

                <StatCard
                  title="Devices"
                  value={devices.length}
                  description={`${activeDevices.length} active devices`}
                  icon="⌁"
                  iconStyle="bg-blue-50 text-blue-700"
                />

                <StatCard
                  title="Active faults"
                  value={faults.length}
                  description="Confirmed infrastructure faults"
                  icon="!"
                  iconStyle="bg-red-50 text-red-600"
                  valueStyle={
                    faults.length > 0
                      ? "text-red-600"
                      : "text-slate-900"
                  }
                />

                <StatCard
                  title="Open tickets"
                  value={openTickets.length}
                  description="Maintenance attention required"
                  icon="✓"
                  iconStyle="bg-amber-50 text-amber-700"
                  valueStyle={
                    openTickets.length > 0
                      ? "text-amber-600"
                      : "text-slate-900"
                  }
                />

              </section>

              {/* ================================================= */}
              {/* HEALTH + SYSTEM */}
              {/* ================================================= */}

              <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">

                {/* HEALTH */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <div className="mb-6 flex items-start justify-between gap-4">

                    <SectionTitle
                      eyebrow="Monitoring"
                      title="Classroom health"
                      description="Latest health status calculated from classroom monitoring data."
                    />

                    <span className="hidden rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-400 sm:block">
                      {healthScores.length} classrooms monitored
                    </span>

                  </div>

                  {/* HEALTH SUMMARY */}

                  <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        Excellent
                      </p>

                      <p className="mt-1 text-xl font-black text-emerald-700">
                        {healthSummary.excellent}
                      </p>
                    </div>

                    <div className="rounded-xl bg-green-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">
                        Good
                      </p>

                      <p className="mt-1 text-xl font-black text-green-700">
                        {healthSummary.good}
                      </p>
                    </div>

                    <div className="rounded-xl bg-amber-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                        Warning
                      </p>

                      <p className="mt-1 text-xl font-black text-amber-700">
                        {healthSummary.warning}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                        Critical
                      </p>

                      <p className="mt-1 text-xl font-black text-red-700">
                        {healthSummary.critical}
                      </p>
                    </div>

                  </div>

                  {healthScores.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">

                      <p className="text-sm font-semibold text-slate-600">
                        No health data available
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Health information will appear after
                        monitoring records are generated.
                      </p>

                    </div>
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full min-w-[680px] text-left">

                        <thead>
                          <tr className="border-b border-slate-100">

                            <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Classroom
                            </th>

                            <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Status
                            </th>

                            <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Score
                            </th>

                            <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Faults
                            </th>

                            <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Environment
                            </th>

                          </tr>
                        </thead>

                        <tbody>

                          {healthScores
                            .slice(0, 8)
                            .map((health) => (
                              <tr
                                key={health.room_id}
                                className="border-b border-slate-50 last:border-0"
                              >

                                <td className="py-4">

                                  <p className="text-sm font-bold text-slate-700">
                                    {getRoomName(
                                      health.room_id
                                    )}
                                  </p>

                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    Room ID{" "}
                                    {health.room_id}
                                  </p>

                                </td>

                                <td className="py-4">
                                  <StatusBadge
                                    status={
                                      health.health_status
                                    }
                                  />
                                </td>

                                <td className="py-4">

                                  <div className="flex items-center gap-3">

                                    <span className="w-8 text-sm font-black text-slate-700">
                                      {health.health_score ??
                                        "—"}
                                    </span>

                                    {health.health_score !=
                                      null && (
                                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">

                                        <div
                                          className="h-full rounded-full bg-cyan-500"
                                          style={{
                                            width: `${Math.min(
                                              Math.max(
                                                health.health_score,
                                                0
                                              ),
                                              100
                                            )}%`,
                                          }}
                                        />

                                      </div>
                                    )}

                                  </div>

                                </td>

                                <td className="py-4 text-sm font-semibold text-slate-600">
                                  {health.active_fault_count ??
                                    0}
                                </td>

                                <td className="py-4">

                                  <p className="text-xs font-semibold text-slate-600">
                                    {health.temperature !=
                                    null
                                      ? `${health.temperature}°C`
                                      : "—"}
                                  </p>

                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    {health.humidity != null
                                      ? `${health.humidity}% RH`
                                      : "No humidity"}
                                  </p>

                                </td>

                              </tr>
                            ))}

                        </tbody>
                      </table>

                    </div>
                  )}

                </div>

                {/* SYSTEM OVERVIEW */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <SectionTitle
                    eyebrow="Platform"
                    title="System overview"
                    description="Current SIMMS administration statistics."
                  />

                  <div className="mt-6 space-y-3">

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                          ▣
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            Active classrooms
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Currently operational
                          </p>
                        </div>

                      </div>

                      <span className="text-lg font-black text-slate-900">
                        {activeClassrooms.length}
                      </span>

                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                          ⌁
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            Active devices
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Connected infrastructure
                          </p>
                        </div>

                      </div>

                      <span className="text-lg font-black text-slate-900">
                        {activeDevices.length}
                      </span>

                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                          ◉
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            Active users
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Registered system users
                          </p>
                        </div>

                      </div>

                      <span className="text-lg font-black text-slate-900">
                        {activeUsers.length}
                      </span>

                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                          !
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-700">
                            Active faults
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Confirmed faults
                          </p>
                        </div>

                      </div>

                      <span className="text-lg font-black text-red-600">
                        {faults.length}
                      </span>

                    </div>

                  </div>

                  {/* QUICK ACTIONS */}

                  <div className="mt-6 border-t border-slate-100 pt-5">

                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Quick actions
                    </p>

                    <div className="grid grid-cols-2 gap-2">

                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(
                            "/admin/users"
                          )
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        Manage users
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(
                            "/admin/calibration"
                          )
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                      >
                        Calibration
                      </button>

                    </div>
                  </div>

                </div>

              </section>

              {/* ================================================= */}
              {/* ACTIVE FAULTS */}
              {/* ================================================= */}

              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                <div className="mb-6 flex items-start justify-between">

                  <SectionTitle
                    eyebrow="Attention required"
                    title="Active faults"
                    description="Confirmed infrastructure faults currently reported by SIMMS."
                  />

                  <div className="rounded-xl bg-red-50 px-3 py-2">
                    <span className="text-xs font-black text-red-600">
                      {faults.length} active
                    </span>
                  </div>

                </div>

                {faults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">

                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-lg text-emerald-600">
                      ✓
                    </div>

                    <p className="mt-4 text-sm font-bold text-slate-700">
                      No active faults
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      The monitoring system currently reports
                      no confirmed active faults.
                    </p>

                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">

                    {faults
                      .slice(0, 6)
                      .map((fault) => (
                        <div
                          key={fault.fault_id}
                          className="rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-red-100 hover:bg-red-50/30"
                        >

                          <div className="flex items-start justify-between gap-4">

                            <div className="flex items-start gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 font-bold text-red-600">
                                !
                              </div>

                              <div>

                                <p className="text-sm font-bold text-slate-800">
                                  {formatStatus(
                                    fault.fault_type
                                  )}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {getRoomName(
                                    fault.room_id
                                  )}
                                </p>

                                <p className="mt-1 text-[10px] text-slate-400">
                                  {getDeviceName(
                                    fault.device_id
                                  )}
                                </p>

                              </div>
                            </div>

                            <StatusBadge
                              status={fault.status}
                            />

                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3">

                            <span className="text-[10px] text-slate-400">
                              Detected{" "}
                              {formatDate(
                                fault.detected_at
                              )}
                            </span>

                            <span className="text-xs font-bold text-slate-600">
                              {fault.confidence !=
                              null
                                ? `${(
                                    fault.confidence *
                                    100
                                  ).toFixed(1)}% confidence`
                                : "Confidence —"}
                            </span>

                          </div>

                        </div>
                      ))}

                  </div>
                )}

              </section>

              {/* ================================================= */}
              {/* TICKETS + USERS */}
              {/* ================================================= */}

              <section className="mt-6 grid gap-6 xl:grid-cols-2">

                {/* TICKETS */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <SectionTitle
                    eyebrow="Maintenance"
                    title="Recent tickets"
                    description="Latest maintenance records available to administration."
                  />

                  <div className="mt-5 space-y-3">

                    {tickets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">

                        <p className="text-sm font-semibold text-slate-600">
                          No tickets available
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Ticket records will appear here
                          when available.
                        </p>

                      </div>
                    ) : (
                      tickets
                        .slice(0, 6)
                        .map((ticket) => (
                          <div
                            key={ticket.ticket_id}
                            className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4 transition hover:bg-slate-50"
                          >

                            <div>

                              <p className="text-sm font-bold text-slate-700">
                                Ticket #
                                {ticket.ticket_id}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                Fault #
                                {ticket.fault_id}
                              </p>

                            </div>

                            <div className="text-right">

                              <StatusBadge
                                status={ticket.status}
                              />

                              <p className="mt-2 text-[10px] text-slate-400">
                                {ticket.priority ||
                                  "No priority"}
                              </p>

                            </div>

                          </div>
                        ))
                    )}

                  </div>
                </div>

                {/* USERS */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                  <SectionTitle
                    eyebrow="Administration"
                    title="System users"
                    description="Users currently registered in the SIMMS platform."
                  />

                  <div className="mt-5 space-y-2">

                    {users.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">

                        <p className="text-sm font-semibold text-slate-600">
                          No users available
                        </p>

                      </div>
                    ) : (
                      users
                        .slice(0, 6)
                        .map((user) => (
                          <div
                            key={user.user_id}
                            className="flex items-center justify-between gap-3 rounded-xl p-3 transition hover:bg-slate-50"
                          >

                            <div className="flex min-w-0 items-center gap-3">

                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600">
                                {user.name
                                  ?.charAt(0)
                                  .toUpperCase() ||
                                  "U"}
                              </div>

                              <div className="min-w-0">

                                <p className="truncate text-sm font-bold text-slate-700">
                                  {user.name || "—"}
                                </p>

                                <p className="truncate text-[10px] text-slate-400">
                                  {user.email || "—"}
                                </p>

                              </div>

                            </div>

                            <div className="shrink-0 text-right">

                              <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                {formatStatus(
                                  user.role
                                )}
                              </p>

                              <StatusBadge
                                status={
                                  user.is_active
                                    ? "ACTIVE"
                                    : "INACTIVE"
                                }
                              />

                            </div>

                          </div>
                        ))
                    )}

                  </div>
                </div>

              </section>

              {/* FOOTER */}

              <footer className="mt-8 border-t border-slate-200 py-6">

                <div className="flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">

                  <p>
                    SIMMS · Smart Classroom Infrastructure
                    Monitoring System
                  </p>

                  <p>
                    Administration Console · v1.0
                  </p>

                </div>

              </footer>

            </>
          )}

        </main>
      </div>
    </div>
  );
}