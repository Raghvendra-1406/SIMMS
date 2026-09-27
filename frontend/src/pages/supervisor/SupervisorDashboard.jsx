import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function SupervisorDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [healthData, setHealthData] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [faults, setFaults] = useState([]);
  const [tickets, setTickets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supervisorName =
    localStorage.getItem("name") || "Supervisor";

  const supervisorEmail =
    localStorage.getItem("email") || "";

  const token = localStorage.getItem("access_token");

  const navigateTo = (path) => {
    window.location.href = path;
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (!token) {
        window.location.href = "/";
        return;
      }

      setLoading(true);
      setError("");

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [
          healthResponse,
          classroomsResponse,
          faultsResponse,
          ticketsResponse,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/health/classrooms`, {
            headers,
          }),
          fetch(`${API_BASE_URL}/classrooms`, {
            headers,
          }),
          fetch(`${API_BASE_URL}/faults/active`, {
            headers,
          }),
          fetch(`${API_BASE_URL}/tickets/open`, {
            headers,
          }),
        ]);

        if (!healthResponse.ok) {
          throw new Error("Unable to load classroom health.");
        }

        if (!classroomsResponse.ok) {
          throw new Error("Unable to load classrooms.");
        }

        if (!faultsResponse.ok) {
          throw new Error("Unable to load active faults.");
        }

        if (!ticketsResponse.ok) {
          throw new Error("Unable to load open tickets.");
        }

        const healthResult = await healthResponse.json();
        const classroomsResult = await classroomsResponse.json();
        const faultsResult = await faultsResponse.json();
        const ticketsResult = await ticketsResponse.json();

        setHealthData(
          Array.isArray(healthResult)
            ? healthResult
            : []
        );

        setClassrooms(
          Array.isArray(classroomsResult)
            ? classroomsResult
            : []
        );

        setFaults(
          Array.isArray(faultsResult)
            ? faultsResult
            : []
        );

        setTickets(
          Array.isArray(ticketsResult)
            ? ticketsResult
            : []
        );
      } catch (err) {
        setError(
          err.message ||
            "Unable to load supervisor dashboard."
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [token]);

  const classroomMap = useMemo(() => {
    const map = {};

    classrooms.forEach((classroom) => {
      map[classroom.room_id] = classroom;
    });

    return map;
  }, [classrooms]);

  const healthSummary = useMemo(() => {
    let normal = 0;
    let warning = 0;
    let critical = 0;

    healthData.forEach((health) => {
      const status = String(
        health.health_status || ""
      ).toUpperCase();

      if (status === "NORMAL") {
        normal += 1;
      } else if (status === "WARNING") {
        warning += 1;
      } else if (status === "CRITICAL") {
        critical += 1;
      }
    });

    return {
      normal,
      warning,
      critical,
    };
  }, [healthData]);

  const totalActiveFaults = useMemo(() => {
    return healthData.reduce(
      (total, health) =>
        total + Number(health.active_fault_count || 0),
      0
    );
  }, [healthData]);

  const getClassroomName = (roomId) => {
    const classroom = classroomMap[roomId];

    if (!classroom) {
      return `Room ${roomId}`;
    }

    return (
      classroom.room_name ||
      `Room ${roomId}`
    );
  };

  const getHealthBadge = (status) => {
    const normalized = String(
      status || ""
    ).toUpperCase();

    if (normalized === "NORMAL") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (normalized === "WARNING") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }

    if (normalized === "CRITICAL") {
      return "border-red-200 bg-red-50 text-red-700";
    }

    return "border-slate-200 bg-slate-50 text-slate-600";
  };

  const getHealthDot = (status) => {
    const normalized = String(
      status || ""
    ).toUpperCase();

    if (normalized === "NORMAL") {
      return "bg-emerald-500";
    }

    if (normalized === "WARNING") {
      return "bg-amber-500";
    }

    if (normalized === "CRITICAL") {
      return "bg-red-500";
    }

    return "bg-slate-400";
  };

  const formatNumber = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      return value;
    }

    return Number.isInteger(number)
      ? number
      : number.toFixed(1);
  };

  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
              active
              collapsed={sidebarCollapsed}
              navigateTo={navigateTo}
            />

            <NavigationItem
              icon="▣"
              label="Classrooms"
              path="/supervisor/classrooms"
              collapsed={sidebarCollapsed}
              navigateTo={navigateTo}
            />

            <NavigationItem
              icon="⌁"
              label="Monitoring"
              path="/supervisor/monitoring"
              collapsed={sidebarCollapsed}
              navigateTo={navigateTo}
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
              navigateTo={navigateTo}
            />

            <NavigationItem
              icon="⌘"
              label="Tickets"
              path="/supervisor/tickets"
              collapsed={sidebarCollapsed}
              navigateTo={navigateTo}
            />

            <NavigationItem
              icon="◉"
              label="Notifications"
              path="/supervisor/notifications"
              collapsed={sidebarCollapsed}
              navigateTo={navigateTo}
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
                SIMMS is connected to the
                classroom infrastructure
                monitoring system.
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
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-4">
              {/* Mobile brand */}
              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950">
                  S
                </div>

                <div>
                  <p className="font-black tracking-[0.16em] text-slate-900">
                    SIMMS
                  </p>

                  <p className="text-[9px] uppercase tracking-[0.12em] text-slate-400">
                    Supervisor
                  </p>
                </div>
              </div>

              <div className="hidden lg:block">
                <p className="text-sm font-semibold text-slate-900">
                  Supervisor Dashboard
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  Classroom infrastructure overview
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-slate-700">
                  {supervisorName}
                </p>

                <p className="text-[10px] text-slate-400">
                  Supervisor
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-cyan-300">
                {supervisorName
                  .charAt(0)
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-5 py-7 sm:px-8">
          {/* Heading */}
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">
              Operations overview
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Classroom monitoring
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Monitor classroom health, active faults,
              and maintenance activity from one place.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-semibold text-red-700">
                {error}
              </p>

              <p className="mt-1 text-xs text-red-500">
                Please check that the SIMMS backend
                is running and try again.
              </p>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              label="Classrooms"
              value={
                loading
                  ? "—"
                  : classrooms.length
              }
              icon="▣"
            />

            <SummaryCard
              label="Normal"
              value={
                loading
                  ? "—"
                  : healthSummary.normal
              }
              icon="✓"
              valueClass="text-emerald-600"
            />

            <SummaryCard
              label="Warning"
              value={
                loading
                  ? "—"
                  : healthSummary.warning
              }
              icon="!"
              valueClass="text-amber-600"
            />

            <SummaryCard
              label="Critical"
              value={
                loading
                  ? "—"
                  : healthSummary.critical
              }
              icon="⚠"
              valueClass="text-red-600"
            />

            <SummaryCard
              label="Open Tickets"
              value={
                loading
                  ? "—"
                  : tickets.length
              }
              icon="⌘"
            />
          </div>

          {/* Health + faults */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            {/* Classroom health */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Classroom health
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Latest calculated classroom health
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigateTo(
                      "/supervisor/classrooms"
                    )
                  }
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50"
                >
                  View all
                </button>
              </div>

              {loading ? (
                <div className="space-y-3 p-5">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
              ) : healthData.length === 0 ? (
                <EmptyState
                  message="No classroom health data is available."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-left">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Classroom
                        </th>

                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Status
                        </th>

                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Score
                        </th>

                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Faults
                        </th>

                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Occupancy
                        </th>

                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Power
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {healthData.map((health) => (
                        <tr
                          key={health.room_id}
                          className="border-b border-slate-50 transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                navigateTo(
                                  `/supervisor/classrooms/${health.room_id}`
                                )
                              }
                              className="text-left"
                            >
                              <p className="text-sm font-bold text-slate-800 hover:text-cyan-600">
                                {getClassroomName(
                                  health.room_id
                                )}
                              </p>

                              <p className="mt-0.5 text-[10px] text-slate-400">
                                Room ID:{" "}
                                {health.room_id}
                              </p>
                            </button>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold ${getHealthBadge(
                                health.health_status
                              )}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${getHealthDot(
                                  health.health_status
                                )}`}
                              />

                              {health.health_status ||
                                "UNKNOWN"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="text-sm font-bold text-slate-800">
                              {formatNumber(
                                health.health_score
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`text-sm font-semibold ${
                                Number(
                                  health.active_fault_count
                                ) > 0
                                  ? "text-red-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {health.active_fault_count ??
                                0}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {health.occupancy_count ??
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {formatNumber(
                              health.power
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Active faults */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Active faults
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Confirmed faults requiring attention
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigateTo(
                      "/supervisor/faults"
                    )
                  }
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50"
                >
                  View all
                </button>
              </div>

              <div className="p-5">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div
                        key={item}
                        className="h-20 animate-pulse rounded-xl bg-slate-100"
                      />
                    ))}
                  </div>
                ) : faults.length === 0 ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                        ✓
                      </div>

                      <div>
                        <p className="text-sm font-bold text-emerald-800">
                          No active faults
                        </p>

                        <p className="mt-1 text-xs text-emerald-600">
                          No confirmed fault is currently
                          requiring attention.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {faults
                      .slice(0, 5)
                      .map((fault) => (
                        <button
                          type="button"
                          key={fault.fault_id}
                          onClick={() =>
                            navigateTo(
                              `/supervisor/faults/${fault.fault_id}`
                            )
                          }
                          className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-red-200 hover:bg-red-50/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-red-600">
                                {fault.fault_type ||
                                  "FAULT"}
                              </p>

                              <p className="mt-1 text-sm font-semibold text-slate-800">
                                {getClassroomName(
                                  fault.room_id
                                )}
                              </p>

                              {fault.device_id !==
                                null &&
                                fault.device_id !==
                                  undefined && (
                                  <p className="mt-1 text-[10px] text-slate-400">
                                    Device ID:{" "}
                                    {fault.device_id}
                                  </p>
                                )}
                            </div>

                            <span className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-bold text-red-600">
                              {fault.status ||
                                "ACTIVE"}
                            </span>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              Confidence:{" "}
                              {formatNumber(
                                Number(
                                  fault.confidence || 0
                                ) * 100
                              )}
                              %
                            </span>

                            <span>
                              {formatDate(
                                fault.detected_at
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Environmental overview */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <h2 className="text-sm font-bold text-slate-900">
                Classroom environment
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                Latest temperature, humidity, occupancy,
                and power values
              </p>
            </div>

            {loading ? (
              <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-28 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : healthData.length === 0 ? (
              <EmptyState message="No environmental data is available." />
            ) : (
              <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                {healthData.slice(0, 8).map((health) => (
                  <div
                    key={health.room_id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="truncate text-xs font-bold text-slate-700">
                        {getClassroomName(
                          health.room_id
                        )}
                      </p>

                      <span
                        className={`h-2 w-2 rounded-full ${getHealthDot(
                          health.health_status
                        )}`}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric
                        label="Temperature"
                        value={
                          health.temperature !==
                            null &&
                          health.temperature !==
                            undefined
                            ? `${formatNumber(
                                health.temperature
                              )}°C`
                            : "—"
                        }
                      />

                      <Metric
                        label="Humidity"
                        value={
                          health.humidity !==
                            null &&
                          health.humidity !==
                            undefined
                            ? `${formatNumber(
                                health.humidity
                              )}%`
                            : "—"
                        }
                      />

                      <Metric
                        label="Occupancy"
                        value={
                          health.occupancy_count ??
                          "—"
                        }
                      />

                      <Metric
                        label="Power"
                        value={
                          health.power !== null &&
                          health.power !== undefined
                            ? `${formatNumber(
                                health.power
                              )} W`
                            : "—"
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Open tickets */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Open maintenance tickets
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Tickets currently requiring maintenance
                  attention
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigateTo(
                    "/supervisor/tickets"
                  )
                }
                className="rounded-lg px-3 py-2 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50"
              >
                View all
              </button>
            </div>

            {loading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState message="No open maintenance tickets." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Ticket
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Fault
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Priority
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </th>

                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Created
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {tickets
                      .slice(0, 6)
                      .map((ticket) => (
                        <tr
                          key={ticket.ticket_id}
                          onClick={() =>
                            navigateTo(
                              `/supervisor/tickets/${ticket.ticket_id}`
                            )
                          }
                          className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-slate-800">
                              #{ticket.ticket_id}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm text-slate-600">
                              {ticket.fault_id
                                ? `Fault #${ticket.fault_id}`
                                : "—"}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                              {ticket.priority ||
                                "—"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-700">
                              {ticket.status ||
                                "OPEN"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-400">
                            {formatDate(
                              ticket.created_at
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Footer stats */}
          <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              SIMMS Supervisor Console
            </p>

            <p>
              {loading
                ? "Loading monitoring data..."
                : `${totalActiveFaults} active fault${
                    totalActiveFaults === 1
                      ? ""
                      : "s"
                  } currently reported`}
            </p>
          </div>
        </main>
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
  navigateTo,
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
  valueClass = "text-slate-900",
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>

        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500">
          {icon}
        </div>
      </div>

      <p
        className={`mt-4 text-2xl font-black tracking-tight ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-700">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        —
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-600">
        {message}
      </p>
    </div>
  );
}

export default SupervisorDashboard;