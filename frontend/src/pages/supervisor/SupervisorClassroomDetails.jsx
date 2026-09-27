import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}

function navigateTo(path) {
  window.location.href = path;
}

function getDisplayValue(value, suffix = "") {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return `${value}${suffix}`;
}

function getHealthStatusClass(status) {
  switch (
    String(status || "").toUpperCase()
  ) {
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

function getStatusClass(status) {
  switch (
    String(status || "").toUpperCase()
  ) {
    case "ACTIVE":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "INACTIVE":
      return "border-slate-700 bg-slate-800 text-slate-400";

    case "OPEN":
      return "border-red-400/20 bg-red-400/10 text-red-300";

    case "RESOLVED":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";

    case "CLOSED":
      return "border-slate-700 bg-slate-800 text-slate-400";

    default:
      return "border-slate-700 bg-slate-800 text-slate-400";
  }
}

function getFaultTypeLabel(faultType) {
  const labels = {
    FAN_FAILURE: "Fan failure",
    LIGHTS_LEFT_ON: "Lights left on",
    ELECTRICAL_ABNORMALITY:
      "Electrical abnormality",
  };

  return (
    labels[faultType] ||
    String(faultType || "Unknown").replaceAll(
      "_",
      " "
    )
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
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
      title={
        collapsed ? label : undefined
      }
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

function MetricCard({
  label,
  value,
  icon,
  description,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </p>

          <p className="mt-3 text-2xl font-black tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
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

export default function SupervisorClassroomDetails() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [supervisorName, setSupervisorName] =
    useState("Supervisor");

  const [supervisorEmail, setSupervisorEmail] =
    useState("");

  const [classroom, setClassroom] =
    useState(null);

  const [devices, setDevices] = useState([]);
  const [health, setHealth] = useState(null);
  const [faults, setFaults] = useState([]);
  const [sensorData, setSensorData] = useState([]);
  const [visionData, setVisionData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const roomId = useMemo(() => {
    const pathParts =
      window.location.pathname.split(
        "/"
      );

    const roomIndex =
      pathParts.indexOf("classrooms");

    if (
      roomIndex === -1 ||
      !pathParts[roomIndex + 1]
    ) {
      return null;
    }

    const parsed = Number(
      pathParts[roomIndex + 1]
    );

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }, []);

  useEffect(() => {
    const storedName =
      localStorage.getItem("name");

    const storedEmail =
      localStorage.getItem("email");

    if (storedName) {
      setSupervisorName(storedName);
    }

    if (storedEmail) {
      setSupervisorEmail(storedEmail);
    }
  }, []);

  useEffect(() => {
    if (roomId === null) {
      setError(
        "Invalid classroom ID."
      );
      setLoading(false);
      return;
    }

    loadClassroomData();
  }, [roomId]);

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
        const data =
          await response.json();

        if (data?.detail) {
          message = data.detail;
        }
      } catch {
        // Keep default message.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function loadClassroomData() {
    if (roomId === null) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const results =
        await Promise.allSettled([
          fetchApi(
            `/classrooms/${roomId}`
          ),

          fetchApi(
            `/devices/room/${roomId}`
          ),

          fetchApi(
            "/health/classrooms"
          ),

          fetchApi(
            `/faults/room/${roomId}/active`
          ),

          fetchApi(
            `/sensors/room/${roomId}/latest`
          ),

          fetchApi(
            `/vision/room/${roomId}/latest`
          ),
        ]);

      const [
        classroomResult,
        devicesResult,
        healthResult,
        faultsResult,
        sensorsResult,
        visionResult,
      ] = results;

      if (
        classroomResult.status ===
        "rejected"
      ) {
        throw classroomResult.reason;
      }

      setClassroom(
        classroomResult.value
      );

      if (
        devicesResult.status ===
        "fulfilled"
      ) {
        setDevices(
          Array.isArray(
            devicesResult.value
          )
            ? devicesResult.value
            : []
        );
      } else {
        setDevices([]);
      }

      if (
        healthResult.status ===
        "fulfilled"
      ) {
        const healthRows =
          Array.isArray(
            healthResult.value
          )
            ? healthResult.value
            : [];

        const matchingHealth =
          healthRows.find(
            (item) =>
              Number(item.room_id) ===
              Number(roomId)
          );

        setHealth(
          matchingHealth || null
        );
      } else {
        setHealth(null);
      }

      if (
        faultsResult.status ===
        "fulfilled"
      ) {
        setFaults(
          Array.isArray(
            faultsResult.value
          )
            ? faultsResult.value
            : []
        );
      } else {
        setFaults([]);
      }

      if (
        sensorsResult.status ===
        "fulfilled"
      ) {
        setSensorData(
          Array.isArray(
            sensorsResult.value
          )
            ? sensorsResult.value
            : sensorsResult.value
              ? [sensorsResult.value]
              : []
        );
      } else {
        setSensorData([]);
      }

      if (
        visionResult.status ===
        "fulfilled"
      ) {
        setVisionData(
          Array.isArray(
            visionResult.value
          )
            ? visionResult.value
            : visionResult.value
              ? [visionResult.value]
              : []
        );
      } else {
        setVisionData([]);
      }

      const optionalFailures =
        results.filter(
          (result) =>
            result.status ===
            "rejected"
        ).length;

      if (optionalFailures > 0) {
        console.warn(
          "Some classroom monitoring endpoints were unavailable."
        );
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load classroom information."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(
      "access_token"
    );
    localStorage.removeItem(
      "token_type"
    );
    localStorage.removeItem("user_id");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    localStorage.removeItem("is_active");

    window.location.href = "/";
  }

  const activeDevices = devices.filter(
    (device) =>
      String(device.status || "")
        .toUpperCase() === "ACTIVE"
  ).length;

  const healthStatus =
    health?.health_status || null;

  const totalFaults =
    health?.active_fault_count !==
    undefined &&
    health?.active_fault_count !== null
      ? health.active_fault_count
      : faults.length;

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

        <div className="border-t border-white/10 p-3">
          {!sidebarCollapsed && (
            <div className="mb-3 rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-white">
                {supervisorName}
              </p>

              <p className="mt-1 truncate text-[10px] text-slate-500">
                {supervisorEmail ||
                  "Supervisor"}
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
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/supervisor/classrooms"
                  )
                }
                className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-cyan-300 hover:text-cyan-600 sm:flex"
                title="Back to classrooms"
              >
                ←
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                  Classroom details
                </p>

                <h1 className="max-w-[240px] truncate text-xl font-black tracking-tight text-slate-900 sm:max-w-none sm:text-2xl">
                  {classroom?.room_name ||
                    (roomId
                      ? `Room ${roomId}`
                      : "Classroom")}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-semibold text-slate-500">
                  Monitoring active
                </span>
              </div>

              <button
                type="button"
                onClick={loadClassroomData}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 disabled:opacity-50"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-red-50 hover:text-red-500 sm:hidden"
                title="Logout"
              >
                ↪
              </button>
            </div>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8 sm:py-9">
          {/* Back */}
          <button
            type="button"
            onClick={() =>
              navigateTo(
                "/supervisor/classrooms"
              )
            }
            className="mb-5 text-sm font-bold text-slate-500 transition hover:text-cyan-600"
          >
            ← Back to classrooms
          </button>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-bold text-red-700">
                Unable to load classroom
                information
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={loadClassroomData}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

              <p className="mt-4 text-sm font-semibold text-slate-500">
                Loading classroom information...
              </p>
            </div>
          ) : classroom ? (
            <>
              {/* Hero */}
              <section className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
                <div className="relative p-6 sm:p-8">
                  <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

                  <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getStatusClass(
                            classroom.status
                          )}`}
                        >
                          {classroom.status ||
                            "UNKNOWN"}
                        </span>

                        {health ? (
                          <span
                            className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getHealthStatusClass(
                              healthStatus
                            )}`}
                          >
                            Health:{" "}
                            {healthStatus}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            No health data
                          </span>
                        )}
                      </div>

                      <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
                        {classroom.room_name ||
                          `Room ${classroom.room_id}`}
                      </h2>

                      <p className="mt-2 text-sm text-slate-400">
                        Classroom ID #
                        {classroom.room_id}
                        {classroom.room_type
                          ? ` · ${classroom.room_type}`
                          : ""}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          Building
                        </p>

                        <p className="mt-1 text-sm font-bold text-white">
                          {classroom.building ||
                            "—"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          Floor
                        </p>

                        <p className="mt-1 text-sm font-bold text-white">
                          {getDisplayValue(
                            classroom.floor
                          )}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          Capacity
                        </p>

                        <p className="mt-1 text-sm font-bold text-white">
                          {getDisplayValue(
                            classroom.capacity
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Metrics */}
              <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Health score"
                  value={
                    health
                      ? getDisplayValue(
                          health.health_score
                        )
                      : "—"
                  }
                  icon="◈"
                  description={
                    health
                      ? healthStatus
                      : "No health calculation available"
                  }
                />

                <MetricCard
                  label="Occupancy"
                  value={
                    health
                      ? getDisplayValue(
                          health.occupancy_count
                        )
                      : "—"
                  }
                  icon="♙"
                  description="Detected people"
                />

                <MetricCard
                  label="Active faults"
                  value={totalFaults}
                  icon="⚠"
                  description="Confirmed active faults"
                />

                <MetricCard
                  label="Active devices"
                  value={`${activeDevices}/${devices.length}`}
                  icon="⌁"
                  description="Configured devices"
                />
              </section>

              {/* Environment */}
              <section className="mt-8">
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Environment
                  </p>

                  <h3 className="mt-1 text-xl font-black text-slate-900">
                    Current classroom conditions
                  </h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Temperature
                    </p>

                    <p className="mt-3 text-2xl font-black text-slate-900">
                      {health
                        ? getDisplayValue(
                            health.temperature,
                            "°C"
                          )
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Humidity
                    </p>

                    <p className="mt-3 text-2xl font-black text-slate-900">
                      {health
                        ? getDisplayValue(
                            health.humidity,
                            "%"
                          )
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Power
                    </p>

                    <p className="mt-3 text-2xl font-black text-slate-900">
                      {health
                        ? getDisplayValue(
                            health.power,
                            " W"
                          )
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Last calculation
                    </p>

                    <p className="mt-3 text-sm font-bold text-slate-900">
                      {health
                        ? formatDateTime(
                            health.calculated_at
                          )
                        : "—"}
                    </p>
                  </div>
                </div>
              </section>

              {/* Devices */}
              <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                        Infrastructure
                      </p>

                      <h3 className="mt-1 text-lg font-black text-slate-900">
                        Devices
                      </h3>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
                      {devices.length} total
                    </span>
                  </div>
                </div>

                {devices.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      ⌁
                    </div>

                    <p className="mt-3 text-sm font-bold text-slate-700">
                      No devices configured
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      No devices are currently
                      assigned to this classroom.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[700px] w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Device
                          </th>

                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Type
                          </th>

                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Status
                          </th>

                          <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Last seen
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {devices.map(
                          (device) => (
                            <tr
                              key={
                                device.device_id
                              }
                              className="border-b border-slate-100 last:border-b-0"
                            >
                              <td className="px-5 py-4">
                                <p className="text-sm font-bold text-slate-800">
                                  {device.device_name ||
                                    `Device ${device.device_id}`}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  ID #
                                  {
                                    device.device_id
                                  }
                                </p>
                              </td>

                              <td className="px-5 py-4">
                                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-600">
                                  {
                                    device.device_type
                                  }
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusClass(
                                    device.status
                                  )}`}
                                >
                                  {device.status ||
                                    "UNKNOWN"}
                                </span>
                              </td>

                              <td className="px-5 py-4 text-xs font-medium text-slate-500">
                                {formatDateTime(
                                  device.last_seen
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Active faults */}
              <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                        Operations
                      </p>

                      <h3 className="mt-1 text-lg font-black text-slate-900">
                        Active faults
                      </h3>
                    </div>

                    <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                      {faults.length} active
                    </span>
                  </div>
                </div>

                {faults.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                      ✓
                    </div>

                    <p className="mt-3 text-sm font-bold text-slate-700">
                      No active faults
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      No confirmed active faults
                      are currently associated
                      with this classroom.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {faults.map(
                      (fault) => (
                        <button
                          type="button"
                          key={fault.fault_id}
                          onClick={() =>
                            navigateTo(
                              `/supervisor/faults/${fault.fault_id}`
                            )
                          }
                          className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left transition hover:bg-slate-50 sm:px-6"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase text-red-600">
                                {getFaultTypeLabel(
                                  fault.fault_type
                                )}
                              </span>

                              <span className="text-xs text-slate-400">
                                Fault #
                                {
                                  fault.fault_id
                                }
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-bold text-slate-800">
                              {fault.device_id
                                ? `Device #${fault.device_id}`
                                : "Room-level fault"}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Detected{" "}
                              {formatDateTime(
                                fault.detected_at
                              )}
                            </p>
                          </div>

                          <span className="shrink-0 text-sm font-bold text-cyan-600">
                            View →
                          </span>
                        </button>
                      )
                    )}
                  </div>
                )}
              </section>

              {/* Latest raw monitoring information */}
              <section className="mt-8 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                      Sensor monitoring
                    </p>

                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Latest sensor observations
                    </h3>
                  </div>

                  {sensorData.length ===
                  0 ? (
                    <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
                      <p className="text-sm font-bold text-slate-600">
                        No sensor observation
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        No latest sensor data is
                        available.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sensorData.map(
                        (sensor, index) => (
                          <div
                            key={
                              sensor.observation_id ||
                              index
                            }
                            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                                {
                                  sensor.observation_type
                                }
                              </p>

                              <span className="text-[10px] text-slate-400">
                                {formatDateTime(
                                  sensor.observed_at
                                )}
                              </span>
                            </div>

                            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-600">
                              {typeof sensor.observation_data ===
                              "object"
                                ? JSON.stringify(
                                    sensor.observation_data,
                                    null,
                                    2
                                  )
                                : String(
                                    sensor.observation_data ??
                                      "—"
                                  )}
                            </pre>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                      Vision monitoring
                    </p>

                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Latest vision observations
                    </h3>
                  </div>

                  {visionData.length ===
                  0 ? (
                    <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
                      <p className="text-sm font-bold text-slate-600">
                        No vision observation
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        No latest vision data is
                        available.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visionData.map(
                        (vision, index) => (
                          <div
                            key={
                              vision.vision_observation_id ||
                              index
                            }
                            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                                {
                                  vision.observation_type
                                }
                              </p>

                              <span className="text-[10px] text-slate-400">
                                {formatDateTime(
                                  vision.observed_at
                                )}
                              </span>
                            </div>

                            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-600">
                              {typeof vision.observation_data ===
                              "object"
                                ? JSON.stringify(
                                    vision.observation_data,
                                    null,
                                    2
                                  )
                                : String(
                                    vision.observation_data ??
                                      "—"
                                  )}
                            </pre>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-700">
                Classroom not found
              </p>

              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/supervisor/classrooms"
                  )
                }
                className="mt-4 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-cyan-600"
              >
                Back to classrooms
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}