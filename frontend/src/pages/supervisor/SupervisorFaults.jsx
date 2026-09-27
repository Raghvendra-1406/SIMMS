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

function getFaultTypeClass(faultType) {
  switch (
    String(faultType || "").toUpperCase()
  ) {
    case "FAN_FAILURE":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "LIGHTS_LEFT_ON":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";

    case "ELECTRICAL_ABNORMALITY":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getConfidenceLabel(confidence) {
  if (
    confidence === null ||
    confidence === undefined
  ) {
    return "—";
  }

  const value = Number(confidence);

  if (Number.isNaN(value)) {
    return confidence;
  }

  return `${(value).toFixed(1)}%`;
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

export default function SupervisorFaults() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [supervisorName, setSupervisorName] =
    useState("Supervisor");

  const [supervisorEmail, setSupervisorEmail] =
    useState("");

  const [faults, setFaults] =
    useState([]);

  const [classrooms, setClassrooms] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [faultTypeFilter, setFaultTypeFilter] =
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
    loadFaults();
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
        // Keep default error message.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function loadFaults() {
    setLoading(true);
    setError("");

    try {
      const [
        faultsResult,
        classroomsResult,
      ] = await Promise.all([
        fetchApi("/faults/active"),
        fetchApi("/classrooms"),
      ]);

      setFaults(
        Array.isArray(faultsResult)
          ? faultsResult
          : []
      );

      setClassrooms(
        Array.isArray(classroomsResult)
          ? classroomsResult
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load active faults."
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

  function getClassroomName(roomId) {
    const classroom =
      classrooms.find(
        (room) =>
          Number(room.room_id) ===
          Number(roomId)
      );

    return (
      classroom?.room_name ||
      `Room ${roomId}`
    );
  }

  const filteredFaults = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return faults.filter((fault) => {
      const matchesType =
        faultTypeFilter === "ALL" ||
        String(
          fault.fault_type || ""
        ).toUpperCase() ===
          faultTypeFilter;

      if (!matchesType) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const classroomName =
        getClassroomName(
          fault.room_id
        );

      const searchableText = [
        fault.fault_id,
        fault.room_id,
        classroomName,
        fault.device_id,
        fault.fault_type,
        getFaultTypeLabel(
          fault.fault_type
        ),
        fault.status,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined
        )
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        searchValue
      );
    });
  }, [
    faults,
    classrooms,
    search,
    faultTypeFilter,
  ]);

  const fanFailures = useMemo(
    () =>
      faults.filter(
        (fault) =>
          String(
            fault.fault_type || ""
          ).toUpperCase() ===
          "FAN_FAILURE"
      ).length,
    [faults]
  );

  const lightsLeftOn = useMemo(
    () =>
      faults.filter(
        (fault) =>
          String(
            fault.fault_type || ""
          ).toUpperCase() ===
          "LIGHTS_LEFT_ON"
      ).length,
    [faults]
  );

  const electricalFaults = useMemo(
    () =>
      faults.filter(
        (fault) =>
          String(
            fault.fault_type || ""
          ).toUpperCase() ===
          "ELECTRICAL_ABNORMALITY"
      ).length,
    [faults]
  );

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
              active
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
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                  Operations
                </p>

                <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  Active Faults
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={loadFaults}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 disabled:opacity-50"
            >
              {loading
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8 sm:py-9">
          {/* Intro */}
          <div className="mb-7">
            <p className="text-sm font-medium text-slate-500">
              Confirmed infrastructure faults requiring
              operational attention
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Fault Management
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Review currently active confirmed faults
              detected by the SIMMS monitoring system.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-bold text-red-700">
                Unable to load faults
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={loadFaults}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Active faults"
              value={
                loading
                  ? "—"
                  : faults.length
              }
              icon="⚠"
              description="All confirmed active faults"
            />

            <SummaryCard
              label="Fan failures"
              value={
                loading
                  ? "—"
                  : fanFailures
              }
              icon="⌁"
              description="Confirmed fan failures"
            />

            <SummaryCard
              label="Lights left on"
              value={
                loading
                  ? "—"
                  : lightsLeftOn
              }
              icon="◉"
              description="Confirmed lighting wastage"
            />

            <SummaryCard
              label="Electrical"
              value={
                loading
                  ? "—"
                  : electricalFaults
              }
              icon="⚡"
              description="Electrical abnormalities"
            />
          </div>

          {/* Filters */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Search faults
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    ⌕
                  </span>

                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search by classroom, fault type, device or ID..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Fault type
                </label>

                <select
                  value={faultTypeFilter}
                  onChange={(event) =>
                    setFaultTypeFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
                >
                  <option value="ALL">
                    All fault types
                  </option>

                  <option value="FAN_FAILURE">
                    Fan failure
                  </option>

                  <option value="LIGHTS_LEFT_ON">
                    Lights left on
                  </option>

                  <option value="ELECTRICAL_ABNORMALITY">
                    Electrical abnormality
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* Fault table */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                  Confirmed
                </p>

                <h3 className="mt-1 text-lg font-black text-slate-900">
                  Active fault records
                </h3>
              </div>

              <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                {filteredFaults.length}
              </span>
            </div>

            {loading ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

                <p className="mt-4 text-sm font-semibold text-slate-500">
                  Loading active faults...
                </p>
              </div>
            ) : filteredFaults.length ===
              0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-500">
                  ✓
                </div>

                <p className="mt-3 text-sm font-bold text-slate-700">
                  No active faults found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {faults.length === 0
                    ? "There are currently no confirmed active faults."
                    : "No faults match the current search or filter."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Fault
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Classroom
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Device
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Detected
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Confidence
                        </th>

                        <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredFaults.map(
                        (fault) => (
                          <tr
                            key={
                              fault.fault_id
                            }
                            className="transition hover:bg-slate-50"
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
                                  ⚠
                                </div>

                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {getFaultTypeLabel(
                                      fault.fault_type
                                    )}
                                  </p>

                                  <p className="mt-1 text-[10px] text-slate-400">
                                    Fault #
                                    {
                                      fault.fault_id
                                    }
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-5">
                              <p className="text-sm font-bold text-slate-700">
                                {getClassroomName(
                                  fault.room_id
                                )}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                Room #
                                {
                                  fault.room_id
                                }
                              </p>
                            </td>

                            <td className="px-6 py-5">
                              {fault.device_id ? (
                                <p className="text-sm font-semibold text-slate-700">
                                  Device #
                                  {
                                    fault.device_id
                                  }
                                </p>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Room-level
                                </span>
                              )}
                            </td>

                            <td className="px-6 py-5">
                              <p className="text-xs font-medium text-slate-600">
                                {formatDateTime(
                                  fault.detected_at
                                )}
                              </p>
                            </td>

                            <td className="px-6 py-5">
                              <div>
                                <p className="text-sm font-bold text-slate-700">
                                  {getConfidenceLabel(
                                    fault.confidence
                                  )}
                                </p>

                                {fault.abnormal_count !==
                                  null &&
                                  fault.abnormal_count !==
                                    undefined && (
                                    <p className="mt-1 text-[10px] text-slate-400">
                                      Abnormal:
                                      {" "}
                                      {
                                        fault.abnormal_count
                                      }
                                    </p>
                                  )}
                              </div>
                            </td>

                            <td className="px-6 py-5 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  navigateTo(
                                    `/supervisor/faults/${fault.fault_id}`
                                  )
                                }
                                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600"
                              >
                                View details →
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredFaults.map(
                    (fault) => (
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
                        className="w-full px-5 py-5 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500">
                              ⚠
                            </div>

                            <div className="min-w-0">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${getFaultTypeClass(
                                  fault.fault_type
                                )}`}
                              >
                                {getFaultTypeLabel(
                                  fault.fault_type
                                )}
                              </span>

                              <p className="mt-2 truncate text-sm font-bold text-slate-800">
                                {getClassroomName(
                                  fault.room_id
                                )}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                Fault #
                                {
                                  fault.fault_id
                                }{" "}
                                ·{" "}
                                {fault.device_id
                                  ? `Device #${fault.device_id}`
                                  : "Room-level"}
                              </p>
                            </div>
                          </div>

                          <span className="shrink-0 text-xs font-bold text-cyan-600">
                            View →
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Detected
                            </p>

                            <p className="mt-1 text-[11px] font-semibold text-slate-600">
                              {formatDateTime(
                                fault.detected_at
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Confidence
                            </p>

                            <p className="mt-1 text-[11px] font-semibold text-slate-600">
                              {getConfidenceLabel(
                                fault.confidence
                              )}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}