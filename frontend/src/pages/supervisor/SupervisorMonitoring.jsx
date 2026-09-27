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

function getDeviceStatusClass(status) {
  switch (
    String(status || "").toUpperCase()
  ) {
    case "ACTIVE":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "INACTIVE":
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

function ObservationCard({
  observation,
  type,
}) {
  const data =
    observation?.observation_data;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-700">
            {observation?.observation_type ||
              type}
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            Device #
            {observation?.device_id ??
              "—"}
          </p>
        </div>

        <span className="text-[10px] font-medium text-slate-400">
          {formatDateTime(
            observation?.observed_at
          )}
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
        {typeof data === "object" &&
        data !== null ? (
          <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-600">
            {JSON.stringify(
              data,
              null,
              2
            )}
          </pre>
        ) : (
          <p className="text-xs text-slate-600">
            {getDisplayValue(data)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SupervisorMonitoring() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [supervisorName, setSupervisorName] =
    useState("Supervisor");

  const [supervisorEmail, setSupervisorEmail] =
    useState("");

  const [classrooms, setClassrooms] =
    useState([]);

  const [healthData, setHealthData] =
    useState([]);

  const [faults, setFaults] =
    useState([]);

  const [sensorObservations, setSensorObservations] =
    useState([]);

  const [visionObservations, setVisionObservations] =
    useState([]);

  const [selectedRoomId, setSelectedRoomId] =
    useState("ALL");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

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
    loadMonitoringData();
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

  async function loadMonitoringData() {
    setLoading(true);
    setError("");

    try {
      const [
        classroomsResult,
        healthResult,
        faultsResult,
      ] = await Promise.all([
        fetchApi("/classrooms"),
        fetchApi("/health/classrooms"),
        fetchApi("/faults/active"),
      ]);

      const classroomRows =
        Array.isArray(classroomsResult)
          ? classroomsResult
          : [];

      setClassrooms(
        classroomRows
      );

      setHealthData(
        Array.isArray(healthResult)
          ? healthResult
          : []
      );

      setFaults(
        Array.isArray(faultsResult)
          ? faultsResult
          : []
      );

      /*
       * Sensor and vision APIs are room-specific.
       * Fetch latest observations for every configured
       * classroom in parallel.
       */
      const sensorRequests =
        classroomRows.map(
          async (classroom) => {
            const roomId =
              classroom.room_id;

            try {
              const data =
                await fetchApi(
                  `/sensors/room/${roomId}/latest`
                );

              return Array.isArray(data)
                ? data.map((item) => ({
                    ...item,
                    room_id: roomId,
                  }))
                : data
                  ? [
                      {
                        ...data,
                        room_id: roomId,
                      },
                    ]
                  : [];
            } catch {
              return [];
            }
          }
        );

      const visionRequests =
        classroomRows.map(
          async (classroom) => {
            const roomId =
              classroom.room_id;

            try {
              const data =
                await fetchApi(
                  `/vision/room/${roomId}/latest`
                );

              return Array.isArray(data)
                ? data.map((item) => ({
                    ...item,
                    room_id: roomId,
                  }))
                : data
                  ? [
                      {
                        ...data,
                        room_id: roomId,
                      },
                    ]
                  : [];
            } catch {
              return [];
            }
          }
        );

      const [
        sensorResults,
        visionResults,
      ] = await Promise.all([
        Promise.all(sensorRequests),
        Promise.all(visionRequests),
      ]);

      setSensorObservations(
        sensorResults.flat()
      );

      setVisionObservations(
        visionResults.flat()
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load monitoring data."
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

  const healthByRoom = useMemo(() => {
    const map = new Map();

    healthData.forEach((health) => {
      if (health?.room_id !== undefined) {
        map.set(
          Number(health.room_id),
          health
        );
      }
    });

    return map;
  }, [healthData]);

  const filteredHealth = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return healthData;
    }

    return healthData.filter(
      (health) =>
        Number(health.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    healthData,
    selectedRoomId,
  ]);

  const filteredFaults = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return faults;
    }

    return faults.filter(
      (fault) =>
        Number(fault.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    faults,
    selectedRoomId,
  ]);

  const filteredSensors = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return sensorObservations;
    }

    return sensorObservations.filter(
      (observation) =>
        Number(observation.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    sensorObservations,
    selectedRoomId,
  ]);

  const filteredVision = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return visionObservations;
    }

    return visionObservations.filter(
      (observation) =>
        Number(observation.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    visionObservations,
    selectedRoomId,
  ]);

  const totalPeople = useMemo(() => {
    return filteredHealth.reduce(
      (total, health) =>
        total +
        Number(
          health.occupancy_count || 0
        ),
      0
    );
  }, [filteredHealth]);

  const averageTemperature =
    useMemo(() => {
      const values =
        filteredHealth
          .map((item) =>
            Number(item.temperature)
          )
          .filter((value) =>
            Number.isFinite(value)
          );

      if (values.length === 0) {
        return null;
      }

      return (
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length
      );
    }, [filteredHealth]);

  const averageHumidity =
    useMemo(() => {
      const values =
        filteredHealth
          .map((item) =>
            Number(item.humidity)
          )
          .filter((value) =>
            Number.isFinite(value)
          );

      if (values.length === 0) {
        return null;
      }

      return (
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length
      );
    }, [filteredHealth]);

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
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="⌁"
              label="Monitoring"
              path="/supervisor/monitoring"
              active
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
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                  Supervisor
                </p>

                <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  Live Monitoring
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedRoomId}
                onChange={(event) =>
                  setSelectedRoomId(
                    event.target.value
                  )
                }
                className="max-w-[170px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 sm:max-w-none"
              >
                <option value="ALL">
                  All classrooms
                </option>

                {classrooms.map(
                  (classroom) => (
                    <option
                      key={
                        classroom.room_id
                      }
                      value={
                        classroom.room_id
                      }
                    >
                      {classroom.room_name ||
                        `Room ${classroom.room_id}`}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                onClick={loadMonitoringData}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 disabled:opacity-50"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>
            </div>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8 sm:py-9">
          <div className="mb-7">
            <p className="text-sm font-medium text-slate-500">
              Current sensor and vision information
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Infrastructure Monitoring
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Observe the latest available classroom
              conditions, occupancy, sensor observations,
              vision observations and confirmed faults.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-bold text-red-700">
                Monitoring data could not be loaded
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={loadMonitoringData}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Classrooms"
              value={
                loading
                  ? "—"
                  : selectedRoomId ===
                      "ALL"
                    ? classrooms.length
                    : 1
              }
              icon="▣"
              description="Monitoring scope"
            />

            <MetricCard
              label="Occupancy"
              value={
                loading
                  ? "—"
                  : totalPeople
              }
              icon="♙"
              description="Detected people"
            />

            <MetricCard
              label="Temperature"
              value={
                loading
                  ? "—"
                  : getDisplayValue(
                      averageTemperature !==
                        null
                        ? averageTemperature.toFixed(
                            1
                          )
                        : null,
                      "°C"
                    )
              }
              icon="🌡"
              description="Average available reading"
            />

            <MetricCard
              label="Active faults"
              value={
                loading
                  ? "—"
                  : filteredFaults.length
              }
              icon="⚠"
              description="Confirmed active faults"
            />
          </div>

          {/* Health overview */}
          <section className="mt-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                  Current condition
                </p>

                <h3 className="mt-1 text-xl font-black text-slate-900">
                  Classroom health
                </h3>
              </div>

              <span className="hidden text-xs font-medium text-slate-400 sm:block">
                Latest available health records
              </span>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

                <p className="mt-4 text-sm font-semibold text-slate-500">
                  Loading monitoring data...
                </p>
              </div>
            ) : filteredHealth.length ===
              0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                <p className="text-sm font-bold text-slate-700">
                  No health data available
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  No calculated health record is
                  currently available for the selected
                  classroom.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredHealth.map(
                  (item) => {
                    const classroom =
                      classrooms.find(
                        (room) =>
                          Number(
                            room.room_id
                          ) ===
                          Number(
                            item.room_id
                          )
                      );

                    return (
                      <button
                        type="button"
                        key={
                          item.room_id
                        }
                        onClick={() =>
                          navigateTo(
                            `/supervisor/classrooms/${item.room_id}`
                          )
                        }
                        className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-900">
                              {classroom?.room_name ||
                                `Room ${item.room_id}`}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Room #
                              {
                                item.room_id
                              }
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${getHealthStatusClass(
                              item.health_status
                            )}`}
                          >
                            {item.health_status ||
                              "UNKNOWN"}
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Score
                            </p>

                            <p className="mt-1 text-lg font-black text-slate-800">
                              {getDisplayValue(
                                item.health_score
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Occupancy
                            </p>

                            <p className="mt-1 text-lg font-black text-slate-800">
                              {getDisplayValue(
                                item.occupancy_count
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            🌡{" "}
                            {getDisplayValue(
                              item.temperature,
                              "°C"
                            )}
                          </span>

                          <span className="text-slate-500">
                            💧{" "}
                            {getDisplayValue(
                              item.humidity,
                              "%"
                            )}
                          </span>

                          <span className="text-slate-500">
                            ⚡{" "}
                            {getDisplayValue(
                              item.power,
                              " W"
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </section>

          {/* Sensor and vision */}
          <section className="mt-8 grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                    IoT
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Sensor observations
                  </h3>
                </div>

                <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-600">
                  {filteredSensors.length}
                </span>
              </div>

              {loading ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Loading sensor data...
                </div>
              ) : filteredSensors.length ===
                0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm font-bold text-slate-600">
                    No sensor observations
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    No latest sensor information is
                    available.
                  </p>
                </div>
              ) : (
                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {filteredSensors.map(
                    (observation, index) => (
                      <ObservationCard
                        key={
                          observation.observation_id ||
                          `${observation.room_id}-${index}`
                        }
                        observation={
                          observation
                        }
                        type="SENSOR"
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Vision
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Vision observations
                  </h3>
                </div>

                <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-600">
                  {filteredVision.length}
                </span>
              </div>

              {loading ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Loading vision data...
                </div>
              ) : filteredVision.length ===
                0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm font-bold text-slate-600">
                    No vision observations
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    No latest vision information is
                    available.
                  </p>
                </div>
              ) : (
                <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                  {filteredVision.map(
                    (observation, index) => (
                      <ObservationCard
                        key={
                          observation.vision_observation_id ||
                          `${observation.room_id}-${index}`
                        }
                        observation={
                          observation
                        }
                        type="VISION"
                      />
                    )
                  )}
                </div>
              )}
            </div>
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
                  {filteredFaults.length}
                </span>
              </div>
            </div>

            {filteredFaults.length ===
            0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                  ✓
                </div>

                <p className="mt-3 text-sm font-bold text-slate-700">
                  No active faults
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  No confirmed active faults are
                  currently in the selected monitoring
                  scope.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredFaults.map(
                  (fault) => {
                    const classroom =
                      classrooms.find(
                        (room) =>
                          Number(
                            room.room_id
                          ) ===
                          Number(
                            fault.room_id
                          )
                      );

                    return (
                      <button
                        type="button"
                        key={
                          fault.fault_id
                        }
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
                            {classroom?.room_name ||
                              `Room ${fault.room_id}`}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {fault.device_id
                              ? `Device #${fault.device_id}`
                              : "Room-level fault"}{" "}
                            · Detected{" "}
                            {formatDateTime(
                              fault.detected_at
                            )}
                          </p>
                        </div>

                        <span className="shrink-0 text-sm font-bold text-cyan-600">
                          View →
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}