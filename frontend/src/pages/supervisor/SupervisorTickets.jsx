import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  IconTile,
  RefreshButton,
  SearchInput,
  Segmented,
  SkeletonRows,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { navigateTo } from "../../lib/session";
import { usePolling } from "../../lib/usePolling";

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
    BOARD_NEEDS_CLEANING: "Board needs cleaning",
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

const STATUS_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "REOPENED", label: "Reopened" },
  { value: "AUTO_RESOLVED", label: "Auto-resolved" },
];

export default function SupervisorTickets() {
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
    loadTickets();
  }, []);

  // Keep the page in sync with live data without flashing skeletons.
  usePolling(loadTickets, 10000);

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

  async function loadTickets({ silent = false } = {}) {
    if (!silent) setLoading(true);
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

  function countByStatus(value) {
    return tickets.filter(
      (ticket) =>
        String(
          ticket.status || ""
        ).toUpperCase() === value
    ).length;
  }

  const openCount = countByStatus("OPEN");
  const inProgressCount = countByStatus("IN_PROGRESS");
  const resolvedCount = countByStatus("RESOLVED");
  const reopenedCount = countByStatus("REOPENED");

  const statusOptions = STATUS_OPTIONS.map((option) => ({
    ...option,
    count: loading
      ? undefined
      : option.value === "ALL"
        ? tickets.length
        : countByStatus(option.value),
  }));

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
  }

  function openTicket(ticketId) {
    navigateTo(
      `/supervisor/tickets/${ticketId}`
    );
  }

  // Load failed and nothing to show: KPI cards display "—" instead of misleading zeros.

  const loadFailed = Boolean(error) && tickets.length === 0;


  return (
    <AppShell
      eyebrow="Operations"
      title="Tickets"
      actions={<RefreshButton onClick={loadTickets} loading={loading} />}
    >
      <p className="-mt-1 mb-6 max-w-2xl text-sm text-slate-500">
        Maintenance work generated from confirmed classroom faults — status,
        priority, classroom context and progress.
      </p>

      {error && (
        <Alert tone="danger" title="Unable to load tickets" onRetry={loadTickets} className="mb-6">
          {error}
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Ticket summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          unavailable={loadFailed}
          label="Open"
          value={openCount}
          hint="Awaiting maintenance action"
          icon="alertCircle"
          tone={openCount > 0 ? "danger" : "neutral"}
          loading={loading}
          onClick={() => setStatusFilter("OPEN")}
        />
        <StatCard
          unavailable={loadFailed}
          label="In progress"
          value={inProgressCount}
          hint="Currently being worked on"
          icon="wrench"
          tone="info"
          loading={loading}
          onClick={() => setStatusFilter("IN_PROGRESS")}
        />
        <StatCard
          unavailable={loadFailed}
          label="Resolved"
          value={resolvedCount}
          hint="Marked as resolved"
          icon="checkCircle"
          tone="success"
          loading={loading}
          onClick={() => setStatusFilter("RESOLVED")}
        />
        <StatCard
          unavailable={loadFailed}
          label="Reopened"
          value={reopenedCount}
          hint="Requiring renewed attention"
          icon="refresh"
          tone={reopenedCount > 0 ? "warning" : "neutral"}
          loading={loading}
          onClick={() => setStatusFilter("REOPENED")}
        />
      </section>

      {/* Tickets */}
      <Card
        className="mt-6"
        title="Ticket records"
        subtitle="Maintenance workflow"
        icon="ticket"
        bodyClassName=""
        actions={
          !loading && (
            <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              {filteredTickets.length} of {tickets.length}
            </span>
          )
        }
      >
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              id="ticket-search"
              label="Search tickets"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by ticket, fault, classroom or notes…"
              className="w-full sm:max-w-sm"
            />

            <div className="flex items-center gap-2 sm:ml-auto">
              <label htmlFor="ticket-priority" className="text-xs font-medium text-slate-500">
                Priority
              </label>
              <select
                id="ticket-priority"
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value
                  )
                }
                className="select h-9 w-auto min-w-[150px]"
              >
                <option value="ALL">All priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <Segmented
            className="self-start"
            ariaLabel="Filter by status"
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon="ticket"
            title="No tickets found"
            description={
              tickets.length === 0
                ? "There are currently no ticket records. Tickets appear when confirmed faults are escalated."
                : "No tickets match the current filters."
            }
            action={
              tickets.length > 0 && hasFilters ? (
                <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm">
                  <Icon name="x" className="h-3.5 w-3.5" />
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="table-wrap hidden md:block">
              <table className="table min-w-[900px]">
                <thead>
                  <tr>
                    <th scope="col">Ticket</th>
                    <th scope="col">Classroom</th>
                    <th scope="col">Fault</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created</th>
                    <th scope="col" className="text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => {
                    const fault = getTicketFault(ticket);

                    return (
                      <tr key={ticket.ticket_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <IconTile icon="ticket" tone="neutral" className="h-8 w-8" />
                            <div>
                              <p className="num text-sm font-semibold text-slate-900">
                                Ticket #{ticket.ticket_id}
                              </p>
                              <p className="num mt-0.5 text-[11px] text-slate-500">
                                Fault #{ticket.fault_id ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td>
                          <p className="font-semibold text-slate-900">
                            {fault?.room_id
                              ? getClassroomName(fault.room_id)
                              : "—"}
                          </p>
                          {fault?.room_id && (
                            <p className="num mt-0.5 text-[11px] text-slate-500">
                              Room #{fault.room_id}
                            </p>
                          )}
                        </td>

                        <td>
                          {fault ? (
                            <span className="text-sm font-medium text-slate-700">
                              {getFaultTypeLabel(fault.fault_type)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Details unavailable
                            </span>
                          )}
                        </td>

                        <td>
                          {ticket.priority ? (
                            <StatusBadge status={ticket.priority} dot={false} size="sm" />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td>
                          {ticket.status ? (
                            <StatusBadge status={ticket.status} />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td>
                          <span className="num whitespace-nowrap text-xs text-slate-600">
                            {formatDateTime(ticket.created_at)}
                          </span>
                        </td>

                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => openTicket(ticket.ticket_id)}
                            className="btn btn-sm btn-secondary"
                          >
                            View
                            <Icon name="arrowRight" className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filteredTickets.map((ticket) => {
                const fault = getTicketFault(ticket);

                return (
                  <li key={ticket.ticket_id}>
                    <button
                      type="button"
                      onClick={() => openTicket(ticket.ticket_id)}
                      className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <IconTile icon="ticket" tone="neutral" className="h-8 w-8" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="num text-sm font-semibold text-slate-900">
                            Ticket #{ticket.ticket_id}
                          </p>
                          {ticket.status ? (
                            <StatusBadge status={ticket.status} size="sm" />
                          ) : (
                            <StatusBadge tone="neutral" label="No status" size="sm" />
                          )}
                        </div>

                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {fault?.room_id
                              ? getClassroomName(fault.room_id)
                              : "Classroom unavailable"}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span className="num">Fault #{ticket.fault_id ?? "—"}</span>
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {ticket.priority ? (
                            <StatusBadge status={ticket.priority} dot={false} size="sm" />
                          ) : (
                            <StatusBadge tone="neutral" label="No priority" dot={false} size="sm" />
                          )}
                          {fault?.fault_type && (
                            <span className="text-xs font-medium text-slate-600">
                              {getFaultTypeLabel(fault.fault_type)}
                            </span>
                          )}
                        </div>

                        <p className="num mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                          <Icon name="clock" className="h-3 w-3" />
                          {formatDateTime(ticket.created_at)}
                        </p>
                      </div>

                      <Icon name="chevronRight" className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </AppShell>
  );
}
