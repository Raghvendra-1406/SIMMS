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

function getStatusClass(status) {
  switch (
    String(status || "").toUpperCase()
  ) {
    case "CONFIRMED":
      return "border-red-200 bg-red-50 text-red-700";

    case "ACTIVE":
      return "border-red-200 bg-red-50 text-red-700";

    case "RESOLVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "CLOSED":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
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

export default function SupervisorFaultDetails() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [supervisorName, setSupervisorName] =
    useState("Supervisor");

  const [supervisorEmail, setSupervisorEmail] =
    useState("");

  const [fault, setFault] =
    useState(null);

  const [classroom, setClassroom] =
    useState(null);

  const [ticket, setTicket] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const faultId =
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
    if (faultId) {
      loadFaultDetails();
    } else {
      setError("Invalid fault ID.");
      setLoading(false);
    }
  }, [faultId]);

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

  async function loadFaultDetails() {
    setLoading(true);
    setError("");

    try {
      const faultData =
        await fetchApi(
          `/faults/${faultId}`
        );

      setFault(faultData);

      const roomId =
        faultData?.room_id;

      if (roomId) {
        try {
          const classroomData =
            await fetchApi(
              `/classrooms/${roomId}`
            );

          setClassroom(
            classroomData
          );
        } catch {
          setClassroom(null);
        }
      }

      try {
        const ticketData =
          await fetchApi(
            `/tickets/fault/${faultId}`
          );

        /*
         * The endpoint may return either:
         * - one ticket object
         * - an array of tickets
         *
         * Keep the frontend tolerant without
         * inventing ticket information.
         */
        if (
          Array.isArray(ticketData)
        ) {
          setTicket(
            ticketData.length > 0
              ? ticketData[0]
              : null
          );
        } else if (
          ticketData?.data
        ) {
          if (
            Array.isArray(
              ticketData.data
            )
          ) {
            setTicket(
              ticketData.data.length > 0
                ? ticketData.data[0]
                : null
            );
          } else {
            setTicket(
              ticketData.data
            );
          }
        } else {
          setTicket(ticketData);
        }
      } catch {
        /*
         * A fault can exist before a ticket
         * has been created. Therefore a failed
         * ticket request should not make the
         * entire fault details page fail.
         */
        setTicket(null);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load fault details."
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
              Loading fault details...
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
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                  Operations / Faults
                </p>

                <h1 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  Fault Details
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={loadFaultDetails}
              disabled={loading}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 disabled:opacity-50"
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
                "/supervisor/faults"
              )
            }
            className="mb-6 text-xs font-bold text-slate-500 transition hover:text-cyan-600"
          >
            ← Back to active faults
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
                    Unable to load fault
                    details
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-red-600">
                    {error}
                  </p>

                  <button
                    type="button"
                    onClick={loadFaultDetails}
                    className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fault */}
          {!error && fault && (
            <>
              {/* Hero */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-6 sm:p-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-500">
                        ⚠
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getFaultTypeClass(
                              fault.fault_type
                            )}`}
                          >
                            {getFaultTypeLabel(
                              fault.fault_type
                            )}
                          </span>

                          <span
                            className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${getStatusClass(
                              fault.status
                            )}`}
                          >
                            {fault.status ||
                              "Unknown"}
                          </span>
                        </div>

                        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                          {getFaultTypeLabel(
                            fault.fault_type
                          )}
                        </h2>

                        <p className="mt-2 text-xs font-medium text-slate-400">
                          Fault #{fault.fault_id}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-red-50 px-5 py-4 lg:min-w-[170px]">
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-400">
                        Confidence
                      </p>

                      <p className="mt-1 text-2xl font-black text-red-700">
                        {getConfidenceLabel(
                          fault.confidence
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Core details */}
                <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
                  <InfoItem
                    label="Classroom"
                    value={
                      classroom?.room_name ||
                      `Room ${fault.room_id}`
                    }
                  />

                  <InfoItem
                    label="Room ID"
                    value={
                      fault.room_id ??
                      "—"
                    }
                  />

                  <InfoItem
                    label="Device"
                    value={
                      fault.device_id
                        ? `Device #${fault.device_id}`
                        : "Room-level fault"
                    }
                  />

                  <InfoItem
                    label="Abnormal observations"
                    value={
                      fault.abnormal_count ??
                      "—"
                    }
                  />
                </div>
              </section>

              {/* Detection information */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Detection timeline
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Fault lifecycle
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <InfoItem
                    label="Detected at"
                    value={formatDateTime(
                      fault.detected_at
                    )}
                  />

                  <InfoItem
                    label="Confirmed at"
                    value={formatDateTime(
                      fault.confirmed_at
                    )}
                  />

                  <InfoItem
                    label="Created at"
                    value={formatDateTime(
                      fault.created_at
                    )}
                  />
                </div>
              </section>

              {/* Classroom */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                      Location
                    </p>

                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Classroom information
                    </h3>
                  </div>

                  {classroom && (
                    <button
                      type="button"
                      onClick={() =>
                        navigateTo(
                          `/supervisor/classrooms/${fault.room_id}`
                        )
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600"
                    >
                      View classroom →
                    </button>
                  )}
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

                    <p className="mt-1 text-xs text-slate-400">
                      The fault record still identifies
                      this classroom as Room #
                      {fault.room_id}.
                    </p>
                  </div>
                )}
              </section>

              {/* Ticket */}
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                    Maintenance
                  </p>

                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    Related ticket
                  </h3>
                </div>

                {ticket ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-slate-800">
                            Ticket #
                            {ticket.ticket_id ??
                              "—"}
                          </span>

                          {ticket.status && (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${getStatusClass(
                                ticket.status
                              )}`}
                            >
                              {
                                ticket.status
                              }
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <InfoItem
                            label="Priority"
                            value={
                              ticket.priority ??
                              "—"
                            }
                          />

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
                        </div>
                      </div>

                      {ticket.ticket_id && (
                        <button
                          type="button"
                          onClick={() =>
                            navigateTo(
                              `/supervisor/tickets/${ticket.ticket_id}`
                            )
                          }
                          className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                        >
                          Open ticket →
                        </button>
                      )}
                    </div>

                    {ticket.maintenance_notes && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Maintenance notes
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {
                            ticket.maintenance_notes
                          }
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-5">
                    <p className="text-sm font-bold text-amber-800">
                      No related ticket found.
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-700">
                      This fault currently does not have
                      a ticket returned by the ticket
                      endpoint.
                    </p>
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
                      Monitoring continues
                    </p>

                    <p className="mt-1 text-xs leading-5 text-cyan-800">
                      SIMMS continues monitoring the
                      classroom independently of this
                      fault record. The fault details shown
                      here are read from the backend fault
                      record.
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