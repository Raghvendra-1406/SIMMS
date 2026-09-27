import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export default function MaintenanceTicketDetails() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [ticket, setTicket] = useState(null);
  const [fault, setFault] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [history, setHistory] = useState([]);

  const [maintenanceNotes, setMaintenanceNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const ticketId = Number(
    window.location.pathname.split("/").filter(Boolean).pop()
  );

  useEffect(() => {
    if (!ticketId || Number.isNaN(ticketId)) {
      setError("Invalid ticket ID.");
      setLoading(false);
      return;
    }

    loadTicketDetails();
  }, [ticketId]);

  async function loadTicketDetails() {
    try {
      setLoading(true);
      setError("");

      const headers = getAuthHeaders();

      const ticketResponse = await fetch(
        `${API_BASE_URL}/tickets/${ticketId}`,
        {
          headers,
        }
      );

      if (!ticketResponse.ok) {
        const data = await ticketResponse.json().catch(() => ({}));

        throw new Error(
          data.detail || "Failed to load ticket details."
        );
      }

      const ticketData = await ticketResponse.json();

      setTicket(ticketData);
      setMaintenanceNotes(ticketData.maintenance_notes || "");

      const requests = [];

      if (ticketData.fault_id) {
        requests.push(
          fetch(
            `${API_BASE_URL}/faults/${ticketData.fault_id}`,
            {
              headers,
            }
          ).then(async (response) => {
            if (!response.ok) {
              return null;
            }

            return response.json();
          })
        );
      } else {
        requests.push(Promise.resolve(null));
      }

      requests.push(
        fetch(
          `${API_BASE_URL}/ticket-history/ticket/${ticketId}`,
          {
            headers,
          }
        ).then(async (response) => {
          if (!response.ok) {
            return [];
          }

          return response.json();
        })
      );

      const [faultData, historyData] = await Promise.all(requests);

      setFault(faultData);
      setHistory(Array.isArray(historyData) ? historyData : []);

      if (faultData?.room_id) {
        const classroomResponse = await fetch(
          `${API_BASE_URL}/classrooms/${faultData.room_id}`,
          {
            headers,
          }
        );

        if (classroomResponse.ok) {
          const classroomData = await classroomResponse.json();
          setClassroom(classroomData);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load ticket details.");
    } finally {
      setLoading(false);
    }
  }

  async function updateTicketStatus(newStatus) {
    if (!ticket) {
      return;
    }

    if (ticket.status === "CLOSED") {
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticket.ticket_id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: newStatus,
            maintenance_notes: maintenanceNotes,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to update ticket status."
        );
      }

      setTicket(data);
      setMaintenanceNotes(data.maintenance_notes || "");

      setSuccessMessage(
        `Ticket status changed to ${formatStatus(newStatus)}.`
      );

      await loadTicketDetails();
    } catch (err) {
      setActionError(
        err.message || "Failed to update ticket status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function saveMaintenanceNotes() {
    if (!ticket || ticket.status === "CLOSED") {
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticket.ticket_id}/notes`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            maintenance_notes: maintenanceNotes,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to save maintenance notes."
        );
      }

      setTicket(data);
      setMaintenanceNotes(data.maintenance_notes || "");

      setSuccessMessage("Maintenance notes saved.");
    } catch (err) {
      setActionError(
        err.message || "Failed to save maintenance notes."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handleLogout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  function goTo(path) {
    window.location.href = path;
  }

  if (loading) {
    return (
      <MaintenanceLayout
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        handleLogout={handleLogout}
        goTo={goTo}
      >
        <PageLoading />
      </MaintenanceLayout>
    );
  }

  if (error) {
    return (
      <MaintenanceLayout
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        handleLogout={handleLogout}
        goTo={goTo}
      >
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <button
            onClick={() => goTo("/maintenance/tickets")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            ← Back to tickets
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-semibold text-red-700">
              Unable to load ticket
            </p>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      </MaintenanceLayout>
    );
  }

  if (!ticket) {
    return (
      <MaintenanceLayout
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        handleLogout={handleLogout}
        goTo={goTo}
      >
        <EmptyState />
      </MaintenanceLayout>
    );
  }

  const isClosed = ticket.status === "CLOSED";
  const canResolve =
    ticket.status === "OPEN" ||
    ticket.status === "REOPENED";

  const canClose = ticket.status === "RESOLVED";

  return (
    <MaintenanceLayout
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      handleLogout={handleLogout}
      goTo={goTo}
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          onClick={() => goTo("/maintenance/tickets")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          ← Back to tickets
        </button>

        {/* Header */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-slate-400">
                  TICKET #{ticket.ticket_id}
                </span>

                <StatusBadge status={ticket.status} />

                <PriorityBadge priority={ticket.priority} />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Maintenance Ticket
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Review the confirmed fault, perform the required maintenance,
                record maintenance notes, and update the ticket status.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {canResolve && (
                <button
                  onClick={() => updateTicketStatus("RESOLVED")}
                  disabled={actionLoading}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading
                    ? "Updating..."
                    : "Mark as Resolved"}
                </button>
              )}

              {canClose && (
                <button
                  onClick={() => updateTicketStatus("CLOSED")}
                  disabled={actionLoading}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading
                    ? "Updating..."
                    : "Close Ticket"}
                </button>
              )}

              {isClosed && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-500">
                  Ticket closed
                </div>
              )}
            </div>
          </div>

          {actionError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {actionError}
            </div>
          )}

          {successMessage && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {successMessage}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            {/* Fault details */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                eyebrow="SOURCE FAULT"
                title="Confirmed fault"
              />

              {fault ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <InfoCard
                    label="Fault type"
                    value={formatFaultType(fault.fault_type)}
                  />

                  <InfoCard
                    label="Fault ID"
                    value={`#${fault.fault_id}`}
                  />

                  <InfoCard
                    label="Device"
                    value={
                      fault.device_id !== null &&
                      fault.device_id !== undefined
                        ? `Device #${fault.device_id}`
                        : "Room-level fault"
                    }
                  />

                  <InfoCard
                    label="Confidence"
                    value={
                      fault.confidence !== null &&
                      fault.confidence !== undefined
                        ? `${Number(fault.confidence).toFixed(0)}%`
                        : "—"
                    }
                  />

                  <InfoCard
                    label="Abnormal observations"
                    value={
                      fault.abnormal_count !== null &&
                      fault.abnormal_count !== undefined
                        ? `${fault.abnormal_count} / 5`
                        : "—"
                    }
                  />

                  <InfoCard
                    label="Detected at"
                    value={formatDateTime(fault.detected_at)}
                  />

                  <InfoCard
                    label="Confirmed at"
                    value={formatDateTime(fault.confirmed_at)}
                  />

                  <InfoCard
                    label="Fault status"
                    value={formatStatus(fault.status)}
                  />
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Fault information is not available.
                </div>
              )}
            </section>

            {/* Classroom */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                eyebrow="CLASSROOM"
                title="Location"
              />

              {classroom ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoCard
                    label="Room"
                    value={classroom.room_name}
                  />

                  <InfoCard
                    label="Building"
                    value={classroom.building}
                  />

                  <InfoCard
                    label="Floor"
                    value={classroom.floor}
                  />

                  <InfoCard
                    label="Room type"
                    value={classroom.room_type}
                  />

                  <InfoCard
                    label="Capacity"
                    value={
                      classroom.capacity !== null &&
                      classroom.capacity !== undefined
                        ? String(classroom.capacity)
                        : "—"
                    }
                  />

                  <InfoCard
                    label="Room status"
                    value={classroom.status}
                  />
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  Classroom information is not available.
                </div>
              )}
            </section>

            {/* Maintenance notes */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeading
                  eyebrow="MAINTENANCE"
                  title="Maintenance notes"
                />

                {!isClosed && (
                  <button
                    onClick={saveMaintenanceNotes}
                    disabled={actionLoading}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save notes
                  </button>
                )}
              </div>

              <div className="mt-6">
                <textarea
                  value={maintenanceNotes}
                  onChange={(event) =>
                    setMaintenanceNotes(event.target.value)
                  }
                  disabled={isClosed || actionLoading}
                  rows={7}
                  placeholder={
                    isClosed
                      ? "No further changes can be made to a closed ticket."
                      : "Describe the maintenance work performed, observations, replacement, repair, or verification details..."
                  }
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {/* Ticket summary */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                eyebrow="TICKET"
                title="Work details"
              />

              <div className="mt-6 space-y-4">
                <DetailRow
                  label="Ticket ID"
                  value={`#${ticket.ticket_id}`}
                />

                <DetailRow
                  label="Priority"
                  value={formatPriority(ticket.priority)}
                />

                <DetailRow
                  label="Status"
                  value={formatStatus(ticket.status)}
                />

                <DetailRow
                  label="Created"
                  value={formatDateTime(ticket.created_at)}
                />

                <DetailRow
                  label="Resolved"
                  value={formatDateTime(ticket.resolved_at)}
                />

                <DetailRow
                  label="Closed"
                  value={formatDateTime(ticket.closed_at)}
                />
              </div>
            </section>

            {/* Workflow */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                eyebrow="WORKFLOW"
                title="Ticket progress"
              />

              <div className="mt-6 space-y-4">
                <WorkflowStep
                  label="OPEN"
                  description="Confirmed fault requires maintenance."
                  active={ticket.status === "OPEN"}
                  completed={
                    ticket.status === "RESOLVED" ||
                    ticket.status === "CLOSED"
                  }
                />

                <WorkflowStep
                  label="RESOLVED"
                  description="Maintenance confirms the issue is fixed."
                  active={ticket.status === "RESOLVED"}
                  completed={ticket.status === "CLOSED"}
                />

                <WorkflowStep
                  label="CLOSED"
                  description="Maintenance closes the completed ticket."
                  active={ticket.status === "CLOSED"}
                  completed={ticket.status === "CLOSED"}
                />
              </div>

              {ticket.status === "REOPENED" && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">
                    Ticket reopened
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    The fault persists and requires maintenance verification
                    again before the ticket can be resolved.
                  </p>
                </div>
              )}
            </section>

            {/* History */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SectionHeading
                eyebrow="AUDIT TRAIL"
                title="Status history"
              />

              {history.length > 0 ? (
                <div className="mt-6 space-y-5">
                  {history.map((item, index) => (
                    <HistoryItem
                      key={item.history_id || index}
                      item={item}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
                  No ticket history is available yet.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </MaintenanceLayout>
  );
}

/* ---------------------------------------------------------
   MAINTENANCE LAYOUT
--------------------------------------------------------- */

function MaintenanceLayout({
  children,
  sidebarCollapsed,
  setSidebarCollapsed,
  handleLogout,
  goTo,
}) {
  const currentPath = window.location.pathname;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden border-r border-slate-800/70 bg-slate-950 text-white transition-all duration-300 lg:flex lg:flex-col ${
          sidebarCollapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {/* Brand */}
        <div
          className={`flex h-20 items-center border-b border-slate-800/70 ${
            sidebarCollapsed
              ? "justify-center px-3"
              : "justify-between px-5"
          }`}
        >
          <button
            onClick={() => goTo("/maintenance/dashboard")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-slate-950">
              S
            </div>

            {!sidebarCollapsed && (
              <div className="text-left">
                <p className="text-sm font-black tracking-wide">
                  SIMMS
                </p>

                <p className="text-[11px] font-medium text-slate-400">
                  Maintenance Console
                </p>
              </div>
            )}
          </button>

          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Collapse sidebar"
            >
              ‹
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="absolute -right-3 top-24 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm text-slate-300 shadow-lg transition hover:bg-slate-800 hover:text-white"
            aria-label="Expand sidebar"
          >
            ›
          </button>
        )}

        {/* Navigation */}
        <div className="hide-scrollbar flex-1 overflow-y-auto px-3 py-7">
          {!sidebarCollapsed && (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Main
            </p>
          )}

          <nav className="space-y-1">
            <NavigationItem
              collapsed={sidebarCollapsed}
              label="Dashboard"
              icon="▦"
              active={currentPath === "/maintenance/dashboard"}
              onClick={() => goTo("/maintenance/dashboard")}
            />

            <NavigationItem
              collapsed={sidebarCollapsed}
              label="Tickets"
              icon="⌘"
              active={
                currentPath === "/maintenance/tickets" ||
                currentPath.startsWith("/maintenance/tickets/")
              }
              onClick={() => goTo("/maintenance/tickets")}
            />
          </nav>

          {/* Monitoring */}
          <div className="mt-8">
            {!sidebarCollapsed ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </span>

                  <div>
                    <p className="text-xs font-bold text-emerald-300">
                      Monitoring active
                    </p>

                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Infrastructure system online
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center py-4">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]" />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/70 p-3">
          {!sidebarCollapsed ? (
            <div className="rounded-2xl bg-slate-900 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300">
                  {getInitials(
                    localStorage.getItem("name") || "Maintenance"
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">
                    {localStorage.getItem("name") || "Maintenance Staff"}
                  </p>

                  <p className="truncate text-[10px] text-slate-500">
                    {localStorage.getItem("email") || ""}
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className="text-slate-500 transition hover:text-red-400"
                  title="Logout"
                >
                  ↪
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="flex w-full justify-center rounded-xl py-3 text-slate-500 transition hover:bg-slate-900 hover:text-red-400"
              title="Logout"
            >
              ↪
            </button>
          )}
        </div>
      </aside>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
          <button
            onClick={() => goTo("/maintenance/dashboard")}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950">
              S
            </div>

            <div className="text-left">
              <p className="text-sm font-black text-slate-950">
                SIMMS
              </p>

              <p className="text-[10px] text-slate-500">
                Maintenance Console
              </p>
            </div>
          </button>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600"
          >
            ☰
          </button>
        </div>

        {sidebarCollapsed && (
          <div className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
            <NavigationItem
              collapsed={false}
              label="Dashboard"
              icon="▦"
              active={currentPath === "/maintenance/dashboard"}
              onClick={() => {
                setSidebarCollapsed(false);
                goTo("/maintenance/dashboard");
              }}
            />

            <NavigationItem
              collapsed={false}
              label="Tickets"
              icon="⌘"
              active={
                currentPath === "/maintenance/tickets" ||
                currentPath.startsWith("/maintenance/tickets/")
              }
              onClick={() => {
                setSidebarCollapsed(false);
                goTo("/maintenance/tickets");
              }}
            />
          </div>
        )}
      </div>

      {/* Main */}
      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-64"
        }`}
      >
        {/* Desktop top header */}
        <header className="sticky top-0 z-30 hidden h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-8 backdrop-blur lg:flex">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Maintenance
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-700">
              Ticket details
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />

            <span className="text-xs font-semibold text-slate-500">
              System monitoring active
            </span>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */

function NavigationItem({
  collapsed,
  label,
  icon,
  active,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center rounded-xl transition ${
        collapsed
          ? "justify-center px-2 py-3"
          : "gap-3 px-3 py-3"
      } ${
        active
          ? "bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/10"
          : "text-slate-400 hover:bg-slate-900 hover:text-white"
      }`}
      title={collapsed ? label : undefined}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ${
          active
            ? "bg-slate-950/10"
            : "bg-slate-900 group-hover:bg-slate-800"
        }`}
      >
        {icon}
      </span>

      {!collapsed && (
        <span className="text-sm font-semibold">
          {label}
        </span>
      )}
    </button>
  );
}

/* ---------------------------------------------------------
   COMPONENTS
--------------------------------------------------------- */

function SectionHeading({ eyebrow, title }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-600">
        {eyebrow}
      </p>

      <h2 className="mt-1 text-lg font-bold text-slate-950">
        {title}
      </h2>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-bold text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <span className="text-xs font-semibold text-slate-400">
        {label}
      </span>

      <span className="text-right text-sm font-bold text-slate-800">
        {value || "—"}
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    OPEN: "bg-blue-50 text-blue-700 border-blue-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REOPENED: "bg-amber-50 text-amber-700 border-amber-200",
    CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
        styles[status] ||
        "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {formatStatus(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    HIGH: "bg-red-50 text-red-700 border-red-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    LOW: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
        styles[priority] ||
        "border-slate-200 bg-slate-100 text-slate-600"
      }`}
    >
      {formatPriority(priority)}
    </span>
  );
}

function WorkflowStep({
  label,
  description,
  active,
  completed,
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : active
            ? "border-cyan-500 bg-cyan-50 text-cyan-700"
            : "border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        {completed ? "✓" : "•"}
      </div>

      <div>
        <p
          className={`text-sm font-bold ${
            active || completed
              ? "text-slate-800"
              : "text-slate-400"
          }`}
        >
          {formatStatus(label)}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function HistoryItem({ item }) {
  return (
    <div className="relative pl-5">
      <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-cyan-400" />

      <p className="text-sm font-bold text-slate-800">
        {item.previous_status
          ? `${formatStatus(item.previous_status)} → ${formatStatus(
              item.new_status
            )}`
          : formatStatus(item.new_status)}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {formatDateTime(item.changed_at)}
      </p>

      {item.note && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {item.note}
        </p>
      )}
    </div>
  );
}

function PageLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-6 w-32 rounded bg-slate-200" />

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="h-8 w-64 rounded bg-slate-200" />

          <div className="mt-4 h-4 w-full max-w-xl rounded bg-slate-100" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="h-72 rounded-3xl bg-white" />
          <div className="h-72 rounded-3xl bg-white" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          Ticket not found.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function formatStatus(status) {
  if (!status) {
    return "—";
  }

  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPriority(priority) {
  if (!priority) {
    return "—";
  }

  return (
    priority.charAt(0) +
    priority.slice(1).toLowerCase()
  );
}

function formatFaultType(faultType) {
  if (!faultType) {
    return "—";
  }

  return faultType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
