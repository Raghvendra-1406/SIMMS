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
    case "HIGH":
    case "URGENT":
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

      <p className="mt-3 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function SupervisorTickets() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [supervisorName, setSupervisorName] =
    useState("Supervisor");

  const [supervisorEmail, setSupervisorEmail] =
    useState("");

  const [tickets, setTickets] =
    useState([]);

  const [classrooms, setClassrooms] =
    useState([]);

  const [faultsById, setFaultsById] =
    useState({});

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [priorityFilter, setPriorityFilter] =
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
    loadTickets();
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
        // Keep default error.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function loadTickets() {
    setLoading(true);
    setError("");

    try {
      const [
        ticketsResult,
        classroomsResult,
      ] = await Promise.all([
        fetchApi("/tickets"),
        fetchApi("/classrooms"),
      ]);

      const ticketList = Array.isArray(
        ticketsResult
      )
        ? ticketsResult
        : ticketsResult?.data &&
            Array.isArray(ticketsResult.data)
          ? ticketsResult.data
          : [];

      const classroomList =
        Array.isArray(classroomsResult)
          ? classroomsResult
          : [];

      setTickets(ticketList);
      setClassrooms(classroomList);

      /*
       * Fetch fault information only for tickets
       * that contain a fault_id.
       *
       * This is used only to show additional context
       * in the ticket list. Ticket loading itself does
       * not depend on fault lookup succeeding.
       */
      const faultIds = [
        ...new Set(
          ticketList
            .map(
              (ticket) =>
                ticket.fault_id
            )
            .filter(
              (faultId) =>
                faultId !== null &&
                faultId !== undefined
            )
        ),
      ];

      if (faultIds.length > 0) {
        const faultResults =
          await Promise.all(
            faultIds.map(
              async (faultId) => {
                try {
                  const fault =
                    await fetchApi(
                      `/faults/${faultId}`
                    );

                  return [
                    String(faultId),
                    fault,
                  ];
                } catch {
                  return [
                    String(faultId),
                    null,
                  ];
                }
              }
            )
          );

        const faultMap = {};

        faultResults.forEach(
          ([faultId, fault]) => {
            if (fault) {
              faultMap[faultId] =
                fault;
            }
          }
        );

        setFaultsById(faultMap);
      } else {
        setFaultsById({});
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load tickets."
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
      (roomId
        ? `Room ${roomId}`
        : "—")
    );
  }

  function getTicketFault(ticket) {
    if (!ticket?.fault_id) {
      return null;
    }

    return (
      faultsById[
        String(ticket.fault_id)
      ] || null
    );
  }

  const filteredTickets = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const status =
        String(
          ticket.status || ""
        ).toUpperCase();

      const priority =
        String(
          ticket.priority || ""
        ).toUpperCase();

      if (
        statusFilter !== "ALL" &&
        status !== statusFilter
      ) {
        return false;
      }

      if (
        priorityFilter !== "ALL" &&
        priority !== priorityFilter
      ) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const fault =
        getTicketFault(ticket);

      const classroomName =
        fault?.room_id
          ? getClassroomName(
              fault.room_id
            )
          : "";

      const searchableText = [
        ticket.ticket_id,
        ticket.fault_id,
        ticket.status,
        ticket.priority,
        ticket.maintenance_notes,
        fault?.fault_type,
        getFaultTypeLabel(
          fault?.fault_type
        ),
        classroomName,
        fault?.room_id,
        fault?.device_id,
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
    tickets,
    classrooms,
    faultsById,
    search,
    statusFilter,
    priorityFilter,
  ]);

  const openCount = tickets.filter(
    (ticket) =>
      String(
        ticket.status || ""
      ).toUpperCase() === "OPEN"
  ).length;

  const inProgressCount = tickets.filter(
    (ticket) =>
      String(
        ticket.status || ""
      ).toUpperCase() === "IN_PROGRESS"
  ).length;

  const resolvedCount = tickets.filter(
    (ticket) =>
      String(
        ticket.status || ""
      ).toUpperCase() === "RESOLVED"
  ).length;

  const reopenedCount = tickets.filter(
    (ticket) =>
      String(
        ticket.status || ""
      ).toUpperCase() === "REOPENED"
  ).length;

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
                  Operations
                </p>

                <h1 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  Maintenance Tickets
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={loadTickets}
              disabled={loading}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 disabled:opacity-50"
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
              Monitor maintenance work generated from
              confirmed classroom faults
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Ticket Management
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Review ticket status, priority, classroom
              context and maintenance progress.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-sm font-bold text-red-700">
                Unable to load tickets
              </p>

              <p className="mt-1 text-xs leading-5 text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={loadTickets}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Open"
              value={
                loading
                  ? "—"
                  : openCount
              }
              icon="!"
              description="Tickets awaiting maintenance action"
            />

            <SummaryCard
              label="In progress"
              value={
                loading
                  ? "—"
                  : inProgressCount
              }
              icon="⌁"
              description="Tickets currently being worked on"
            />

            <SummaryCard
              label="Resolved"
              value={
                loading
                  ? "—"
                  : resolvedCount
              }
              icon="✓"
              description="Tickets marked as resolved"
            />

            <SummaryCard
              label="Reopened"
              value={
                loading
                  ? "—"
                  : reopenedCount
              }
              icon="↻"
              description="Tickets requiring renewed attention"
            />
          </div>

          {/* Filters */}
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1fr_200px_200px]">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Search tickets
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
                    placeholder="Search by ticket, fault, classroom or notes..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Status
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
                >
                  <option value="ALL">
                    All statuses
                  </option>

                  <option value="OPEN">
                    Open
                  </option>

                  <option value="IN_PROGRESS">
                    In progress
                  </option>

                  <option value="RESOLVED">
                    Resolved
                  </option>

                  <option value="CLOSED">
                    Closed
                  </option>

                  <option value="REOPENED">
                    Reopened
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Priority
                </label>

                <select
                  value={priorityFilter}
                  onChange={(event) =>
                    setPriorityFilter(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-400/10"
                >
                  <option value="ALL">
                    All priorities
                  </option>

                  <option value="URGENT">
                    Urgent
                  </option>

                  <option value="HIGH">
                    High
                  </option>

                  <option value="MEDIUM">
                    Medium
                  </option>

                  <option value="LOW">
                    Low
                  </option>
                </select>
              </div>
            </div>
          </section>

          {/* Tickets */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-600">
                  Maintenance workflow
                </p>

                <h3 className="mt-1 text-lg font-black text-slate-900">
                  Ticket records
                </h3>
              </div>

              <span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700">
                {filteredTickets.length}
              </span>
            </div>

            {loading ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

                <p className="mt-4 text-sm font-semibold text-slate-500">
                  Loading tickets...
                </p>
              </div>
            ) : filteredTickets.length ===
              0 ? (
              <div className="px-6 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-400">
                  ⌘
                </div>

                <p className="mt-3 text-sm font-bold text-slate-700">
                  No tickets found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {tickets.length === 0
                    ? "There are currently no ticket records."
                    : "No tickets match the current filters."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[1050px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Ticket
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Classroom
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Fault
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Priority
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Status
                        </th>

                        <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Created
                        </th>

                        <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredTickets.map(
                        (ticket) => {
                          const fault =
                            getTicketFault(
                              ticket
                            );

                          return (
                            <tr
                              key={
                                ticket.ticket_id
                              }
                              className="transition hover:bg-slate-50"
                            >
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                                    ⌘
                                  </div>

                                  <div>
                                    <p className="text-sm font-bold text-slate-800">
                                      Ticket #
                                      {
                                        ticket.ticket_id
                                      }
                                    </p>

                                    <p className="mt-1 text-[10px] text-slate-400">
                                      Fault #
                                      {ticket.fault_id ??
                                        "—"}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-6 py-5">
                                <p className="text-sm font-bold text-slate-700">
                                  {fault?.room_id
                                    ? getClassroomName(
                                        fault.room_id
                                      )
                                    : "—"}
                                </p>

                                {fault?.room_id && (
                                  <p className="mt-1 text-[10px] text-slate-400">
                                    Room #
                                    {
                                      fault.room_id
                                    }
                                  </p>
                                )}
                              </td>

                              <td className="px-6 py-5">
                                {fault ? (
                                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                                    {getFaultTypeLabel(
                                      fault.fault_type
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    Fault details unavailable
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-5">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${getPriorityClass(
                                    ticket.priority
                                  )}`}
                                >
                                  {ticket.priority ||
                                    "—"}
                                </span>
                              </td>

                              <td className="px-6 py-5">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${getStatusClass(
                                    ticket.status
                                  )}`}
                                >
                                  {ticket.status ||
                                    "—"}
                                </span>
                              </td>

                              <td className="px-6 py-5">
                                <p className="text-xs font-medium text-slate-600">
                                  {formatDateTime(
                                    ticket.created_at
                                  )}
                                </p>
                              </td>

                              <td className="px-6 py-5 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigateTo(
                                      `/supervisor/tickets/${ticket.ticket_id}`
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600"
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

                {/* Mobile */}
                <div className="divide-y divide-slate-100 lg:hidden">
                  {filteredTickets.map(
                    (ticket) => {
                      const fault =
                        getTicketFault(
                          ticket
                        );

                      return (
                        <button
                          type="button"
                          key={
                            ticket.ticket_id
                          }
                          onClick={() =>
                            navigateTo(
                              `/supervisor/tickets/${ticket.ticket_id}`
                            )
                          }
                          className="w-full px-5 py-5 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                                ⌘
                              </div>

                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800">
                                  Ticket #
                                  {
                                    ticket.ticket_id
                                  }
                                </p>

                                <p className="mt-1 truncate text-xs font-semibold text-slate-600">
                                  {fault?.room_id
                                    ? getClassroomName(
                                        fault.room_id
                                      )
                                    : "Classroom unavailable"}
                                </p>

                                <p className="mt-1 text-[10px] text-slate-400">
                                  Fault #
                                  {ticket.fault_id ??
                                    "—"}
                                </p>
                              </div>
                            </div>

                            <span className="shrink-0 text-xs font-bold text-cyan-600">
                              View →
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${getPriorityClass(
                                ticket.priority
                              )}`}
                            >
                              {ticket.priority ||
                                "No priority"}
                            </span>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${getStatusClass(
                                ticket.status
                              )}`}
                            >
                              {ticket.status ||
                                "No status"}
                            </span>

                            {fault?.fault_type && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                                {getFaultTypeLabel(
                                  fault.fault_type
                                )}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 rounded-xl bg-slate-50 p-3">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                              Created
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-600">
                              {formatDateTime(
                                ticket.created_at
                              )}
                            </p>
                          </div>
                        </button>
                      );
                    }
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