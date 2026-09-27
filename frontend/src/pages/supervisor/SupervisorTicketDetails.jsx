import { useEffect, useState } from "react";

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

function getStatusClass(status) {
  switch (
    String(status || "").toUpperCase()
  ) {
    case "OPEN":
      return "border-red-200 bg-red-50 text-red-700";

    case "REOPENED":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "RESOLVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "CLOSED":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getPriorityClass(priority) {
  switch (
    String(priority || "").toUpperCase()
  ) {
    case "URGENT":
    case "HIGH":
      return "border-red-200 bg-red-50 text-red-700";

    case "MEDIUM":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "LOW":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
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

function getHistoryActionLabel(action) {
  if (!action) {
    return "Ticket updated";
  }

  return String(action)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function InfoItem({
  label,
  value,
  valueClass = "text-slate-800",
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-sm font-bold ${valueClass}`}
      >
        {value}
      </p>
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

export default function SupervisorTicketDetails() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [supervisorName, setSupervisorName] =
    useState("Supervisor");

  const [supervisorEmail, setSupervisorEmail] =
    useState("");

  const [ticket, setTicket] =
    useState(null);

  const [fault, setFault] =
    useState(null);

  const [classroom, setClassroom] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const ticketId =
    window.location.pathname.split("/").pop();

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
    if (ticketId) {
      loadTicketDetails();
    } else {
      setError("Invalid ticket ID.");
      setLoading(false);
    }
  }, [ticketId]);

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
        // Keep default error.
      }

      throw new Error(message);
    }

    return response.json();
  }

  function normalizeListResponse(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (
      data &&
      Array.isArray(data.data)
    ) {
      return data.data;
    }

    return [];
  }

  async function loadTicketDetails() {
    setLoading(true);
    setError("");

    try {
      const ticketData =
        await fetchApi(
          `/tickets/${ticketId}`
        );

      setTicket(
        ticketData?.data &&
          !Array.isArray(
            ticketData.data
          )
          ? ticketData.data
          : ticketData
      );

      const actualTicket =
        ticketData?.data &&
        !Array.isArray(
          ticketData.data
        )
          ? ticketData.data
          : ticketData;

      /*
       * Load related fault.
       */
      if (actualTicket?.fault_id) {
        try {
          const faultData =
            await fetchApi(
              `/faults/${actualTicket.fault_id}`
            );

          setFault(
            faultData?.data &&
              !Array.isArray(
                faultData.data
              )
              ? faultData.data
              : faultData
          );

          const actualFault =
            faultData?.data &&
            !Array.isArray(
              faultData.data
            )
              ? faultData.data
              : faultData;

          /*
           * Load classroom from the fault's
           * room_id.
           */
          if (actualFault?.room_id) {
            try {
              const classroomData =
                await fetchApi(
                  `/classrooms/${actualFault.room_id}`
                );

              setClassroom(
                classroomData?.data &&
                  !Array.isArray(
                    classroomData.data
                  )
                  ? classroomData.data
                  : classroomData
              );
            } catch {
              setClassroom(null);
            }
          }
        } catch {
          setFault(null);
        }
      }

      /*
       * Ticket history is useful for the
       * operational timeline.
       */
      try {
        const historyData =
          await fetchApi(
            `/ticket-history/ticket/${ticketId}`
          );

        setHistory(
          normalizeListResponse(
            historyData
          )
        );
      } catch {
        /*
         * Keep the main ticket page usable
         * if history is unavailable.
         */
        setHistory([]);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load ticket details."
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

            <p className="mt-4 text-sm font-semibold text-slate-500">
              Loading ticket details...
            </p>
          </div>
        </div>
      </div>
    );
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
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="⌘"
              label="Tickets"
              path="/supervisor/tickets"
              active
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
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-600">
                  Operations / Tickets
                </p>

                <h1 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  Ticket Details
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={loadTicketDetails}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        <main className="px-5 py-7 sm:px-8 sm:py-9">
          {/* Back */}
          <button
            type="button"
            onClick={() =>
              navigateTo(
                "/supervisor/tickets"
              )
            }
            className="mb-6 text-xs font-bold text-slate-500 transition hover:text-cyan-600"
          >
            ← Back to tickets
          </button>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  ⚠
                </div>

                <div>
                  <h2 className="text-sm font-black text-red-800">
                    Unable to load ticket
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-red-600">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={loadTicketDetails}
                    className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {!error && ticket && (
            <>
              {/* Ticket header */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6 sm:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-2xl text-cyan-600">
                        ⌘
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getStatusClass(
                              ticket.status
                            )}`}
                          >
                            {ticket.status ||
                              "Unknown"}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getPriorityClass(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority ||
                              "No priority"}
                          </span>
                        </div>

                        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                          Ticket #
                          {ticket.ticket_id}
                        </h2>

                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Maintenance ticket generated
                          from a classroom fault
                        </p>
                      </div>
                    </div>

                    {fault && (
                      <button
                        type="button"
                        onClick={() =>
                          navigateTo(
                            `/supervisor/faults/${fault.fault_id}`
                          )
                        }
                        className="shrink-0 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600"
                      >
                        View related fault →
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4 sm:p-8">
                  <InfoItem
                    label="Ticket ID"
                    value={
                      ticket.ticket_id ??
                      "—"
                    }
                  />

                  <InfoItem
                    label="Fault ID"
                    value={
                      ticket.fault_id ??
                      "—"
                    }
                  />

                  <InfoItem
                    label="Priority"
                    value={
                      ticket.priority ??
                      "—"
                    }
                  />

                  <InfoItem
                    label="Status"
                    value={
                      ticket.status ??
                      "—"
                    }
                  />
                </div>
              </section>

              {/* Timeline */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Ticket timeline
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Maintenance lifecycle
                  </h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <InfoItem
                    label="Created"
                    value={formatDateTime(
                      ticket.created_at
                    )}
                  />

                  <InfoItem
                    label="Resolved"
                    value={formatDateTime(
                      ticket.resolved_at
                    )}
                  />

                  <InfoItem
                    label="Closed"
                    value={formatDateTime(
                      ticket.closed_at
                    )}
                  />
                </div>
              </section>

              {/* Fault context */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500">
                      Source fault
                    </p>

                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Fault context
                    </h3>
                  </div>

                  {fault && (
                    <span
                      className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide ${getStatusClass(
                        fault.status
                      )}`}
                    >
                      {fault.status ||
                        "Unknown"}
                    </span>
                  )}
                </div>

                {fault ? (
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                        {getFaultTypeLabel(
                          fault.fault_type
                        )}
                      </span>

                      <span className="text-xs text-slate-400">
                        Fault #
                        {fault.fault_id}
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <InfoItem
                        label="Classroom"
                        value={
                          classroom?.room_name ||
                          `Room ${fault.room_id}`
                        }
                      />

                      <InfoItem
                        label="Device"
                        value={
                          fault.device_id
                            ? `Device #${fault.device_id}`
                            : "Room-level"
                        }
                      />

                      <InfoItem
                        label="Confidence"
                        value={
                          fault.confidence !==
                            null &&
                          fault.confidence !==
                            undefined
                            ? `${(
                                Number(
                                  fault.confidence
                                )
                              ).toFixed(1)}%`
                            : "—"
                        }
                      />

                      <InfoItem
                        label="Abnormal count"
                        value={
                          fault.abnormal_count ??
                          "—"
                        }
                      />

                      <InfoItem
                        label="Detected"
                        value={formatDateTime(
                          fault.detected_at
                        )}
                      />

                      <InfoItem
                        label="Confirmed"
                        value={formatDateTime(
                          fault.confirmed_at
                        )}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-5">
                    <p className="text-sm font-bold text-amber-800">
                      Fault information is
                      unavailable.
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-700">
                      The ticket still contains Fault #
                      {ticket.fault_id ??
                        "—"}.
                    </p>
                  </div>
                )}
              </section>

              {/* Classroom */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Location
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Classroom information
                  </h3>
                </div>

                {classroom ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <InfoItem
                      label="Room name"
                      value={
                        classroom.room_name ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Room type"
                      value={
                        classroom.room_type ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Building"
                      value={
                        classroom.building ||
                        "—"
                      }
                    />

                    <InfoItem
                      label="Floor"
                      value={
                        classroom.floor ??
                        "—"
                      }
                    />

                    <InfoItem
                      label="Capacity"
                      value={
                        classroom.capacity ??
                        "—"
                      }
                    />

                    <InfoItem
                      label="Status"
                      value={
                        classroom.status ||
                        "—"
                      }
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-600">
                      Classroom information is
                      unavailable.
                    </p>

                    {fault?.room_id && (
                      <p className="mt-1 text-xs text-slate-400">
                        Fault belongs to Room #
                        {fault.room_id}.
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Maintenance notes */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Maintenance
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Maintenance notes
                  </h3>
                </div>

                {ticket.maintenance_notes ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {
                        ticket.maintenance_notes
                      }
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-500">
                      No maintenance notes have
                      been recorded.
                    </p>
                  </div>
                )}
              </section>

              {/* History */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Activity
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Ticket history
                  </h3>
                </div>

                {history.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-500">
                      No ticket history records are
                      available.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {history.map(
                      (entry, index) => (
                        <div
                          key={
                            entry.history_id ??
                            entry.id ??
                            index
                          }
                          className="relative flex gap-4"
                        >
                          {index <
                            history.length -
                              1 && (
                            <div className="absolute left-4 top-9 h-[calc(100%+1.25rem)] w-px bg-slate-200" />
                          )}

                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-xs font-bold text-cyan-600">
                            ✓
                          </div>

                          <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-sm font-bold text-slate-800">
                                {getHistoryActionLabel(
                                  entry.action ||
                                    entry.action_type ||
                                    entry.status
                                )}
                              </p>

                              <p className="text-[10px] font-medium text-slate-400">
                                {formatDateTime(
                                  entry.created_at ||
                                    entry.changed_at ||
                                    entry.timestamp
                                )}
                              </p>
                            </div>

                            {entry.status && (
                              <p className="mt-2 text-xs text-slate-500">
                                Status:{" "}
                                <span className="font-semibold text-slate-700">
                                  {
                                    entry.status
                                  }
                                </span>
                              </p>
                            )}

                            {entry.notes && (
                              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                                {
                                  entry.notes
                                }
                              </p>
                            )}

                            {entry.changed_by && (
                              <p className="mt-2 text-[10px] text-slate-400">
                                Updated by:{" "}
                                {
                                  entry.changed_by
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              {/* Operational note */}
              <section className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                    i
                  </div>

                  <div>
                    <p className="text-sm font-black text-cyan-900">
                      Supervisor view
                    </p>

                    <p className="mt-1 text-xs leading-5 text-cyan-800">
                      This page provides operational
                      visibility into the maintenance ticket,
                      its source fault and the ticket history.
                      Physical maintenance actions remain part
                      of the maintenance workflow.
                    </p>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}