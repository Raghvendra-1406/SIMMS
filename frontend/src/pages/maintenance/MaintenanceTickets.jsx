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
import { formatLabel, statusTone } from "../../lib/format";
import { navigateTo } from "../../lib/session";
import { usePolling } from "../../lib/usePolling";

const API_BASE_URL = "http://localhost:8000";

function PriorityBadge({ priority, size = "md" }) {
    if (!priority) {
        return null;
    }

    return (
        <StatusBadge
            status={priority}
            tone={
                String(priority).toUpperCase() === "CRITICAL"
                    ? "danger"
                    : undefined
            }
            label={`${formatLabel(priority)} priority`}
            size={size}
        />
    );
}

function iconToneForPriority(priority) {
    const tone = statusTone(priority);
    if (String(priority || "").toUpperCase() === "CRITICAL") return "danger";
    return tone === "orange" ? "warning" : tone;
}

function MaintenanceTickets() {
    const [tickets, setTickets] = useState([]);
    const [faults, setFaults] = useState({});
    const [classrooms, setClassrooms] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");

    const token = localStorage.getItem("access_token");

    const fetchTickets = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            setError("");

            if (!token) {
                window.location.href = "/";
                return;
            }

            const headers = {
                Authorization: `Bearer ${token}`,
            };

            const response = await fetch(
                `${API_BASE_URL}/tickets/open`,
                {
                    headers,
                }
            );

            if (response.status === 401) {
                localStorage.clear();
                window.location.href = "/";
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Unable to load maintenance tickets."
                );
            }

            const ticketData = await response.json();

            const safeTickets = Array.isArray(ticketData)
                ? ticketData
                : [];

            setTickets(safeTickets);

            const faultMap = {};
            const classroomMap = {};

            const uniqueFaultIds = [
                ...new Set(
                    safeTickets
                        .map((ticket) => ticket.fault_id)
                        .filter(Boolean)
                ),
            ];

            await Promise.all(
                uniqueFaultIds.map(async (faultId) => {
                    try {
                        const faultResponse = await fetch(
                            `${API_BASE_URL}/faults/${faultId}`,
                            {
                                headers,
                            }
                        );

                        if (faultResponse.ok) {
                            const faultData =
                                await faultResponse.json();

                            faultMap[faultId] = faultData;

                            if (faultData.room_id) {
                                try {
                                    const classroomResponse =
                                        await fetch(
                                            `${API_BASE_URL}/classrooms/${faultData.room_id}`,
                                            {
                                                headers,
                                            }
                                        );

                                    if (classroomResponse.ok) {
                                        const classroomData =
                                            await classroomResponse.json();

                                        classroomMap[
                                            faultData.room_id
                                        ] = classroomData;
                                    }
                                } catch {
                                    // Classroom information is supplementary.
                                }
                            }
                        }
                    } catch {
                        // Fault information is supplementary.
                    }
                })
            );

            setFaults(faultMap);
            setClassrooms(classroomMap);
        } catch (err) {
            setError(
                err.message ||
                    "Unable to load maintenance tickets."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    // Keep the page in sync with live data without flashing skeletons.
    usePolling(fetchTickets, 10000);

    const enrichedTickets = useMemo(() => {
        return tickets.map((ticket) => {
            const fault = faults[ticket.fault_id];

            const classroom = fault
                ? classrooms[fault.room_id]
                : null;

            return {
                ...ticket,
                fault,
                classroom,
            };
        });
    }, [tickets, faults, classrooms]);

    const filteredTickets = useMemo(() => {
        return enrichedTickets.filter((ticket) => {
            const fault = ticket.fault;

            const roomName =
                ticket.classroom?.room_name ||
                fault?.room_id ||
                "";

            const faultType = fault?.fault_type || "";

            const searchText = `
                ${ticket.ticket_id}
                ${roomName}
                ${faultType}
                ${ticket.priority}
                ${ticket.status}
            `.toLowerCase();

            const matchesSearch =
                searchText.includes(
                    search.toLowerCase()
                );

            const matchesStatus =
                statusFilter === "ALL" ||
                ticket.status === statusFilter;

            const matchesPriority =
                priorityFilter === "ALL" ||
                ticket.priority === priorityFilter;

            return (
                matchesSearch &&
                matchesStatus &&
                matchesPriority
            );
        });
    }, [
        enrichedTickets,
        search,
        statusFilter,
        priorityFilter,
    ]);

    const openCount = tickets.filter(
        (ticket) => ticket.status === "OPEN"
    ).length;

    const resolvedCount = tickets.filter(
        (ticket) => ticket.status === "RESOLVED"
    ).length;

    const highPriorityCount = tickets.filter(
        (ticket) => ticket.priority === "HIGH"
    ).length;

    const getFaultLabel = (faultType) => {
        if (!faultType) {
            return "Unknown Fault";
        }

        switch (faultType) {
            case "FAN_FAILURE":
                return "Fan Failure";

            case "LIGHTS_LEFT_ON":
                return "Lights Left On";

            case "BOARD_NEEDS_CLEANING":
                return "Board Needs Cleaning";

            case "ELECTRICAL_ABNORMALITY":
                return "Electrical Abnormality";

            default:
                return faultType.replaceAll("_", " ");
        }
    };


    const formatDate = (value) => {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString();
    };


    const getRoomLabel = (ticket) =>
        ticket.classroom?.room_name ||
        `Room ${ticket.fault?.room_id || "—"}`;

    const getRoomMeta = (room) => {
        if (!room?.building) {
            return "";
        }

        return `${room.building}${
            room.floor !== undefined ? ` · Floor ${room.floor}` : ""
        }`;
    };

    const statusOptions = [
        { value: "ALL", label: "All", count: tickets.length },
        { value: "OPEN", label: "Open", count: openCount },
        { value: "RESOLVED", label: "Resolved", count: resolvedCount },
    ];

    const priorityOptions = [
        { value: "ALL", label: "Any priority" },
        { value: "HIGH", label: "High" },
        { value: "MEDIUM", label: "Medium" },
        { value: "LOW", label: "Low" },
    ];

    // Load failed and nothing to show: KPI cards display "—" instead of misleading zeros.

    const loadFailed = Boolean(error) && tickets.length === 0;


    return (
        <AppShell
            eyebrow="Maintenance"
            title="My tickets"
            actions={
                <RefreshButton
                    onClick={fetchTickets}
                    loading={loading}
                />
            }
        >
            {error && (
                <Alert
                    tone="danger"
                    title={error}
                    onRetry={fetchTickets}
                    className="mb-6"
                >
                    Please check that the SIMMS backend is running and
                    try again.
                </Alert>
            )}

            {/* KPIs */}
            <section
                aria-label="Ticket summary"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
                <StatCard
                    unavailable={loadFailed}
                    label="Open tickets"
                    value={openCount}
                    loading={loading}
                    hint={openCount > 0 ? "Awaiting maintenance" : "Queue is clear"}
                    icon="ticket"
                    tone={openCount > 0 ? "brand" : "success"}
                />
                <StatCard
                    unavailable={loadFailed}
                    label="Resolved tickets"
                    value={resolvedCount}
                    loading={loading}
                    hint="Ready to be closed"
                    icon="checkCircle"
                    tone="success"
                />
                <StatCard
                    unavailable={loadFailed}
                    label="High priority"
                    value={highPriorityCount}
                    loading={loading}
                    hint={highPriorityCount > 0 ? "Handle these first" : "No urgent work"}
                    icon="zap"
                    tone={highPriorityCount > 0 ? "warning" : "success"}
                />
            </section>

            {/* Work queue */}
            <Card
                className="mt-6"
                title="Work queue"
                subtitle={
                    loading
                        ? "Loading maintenance tickets…"
                        : `${filteredTickets.length} ticket${
                              filteredTickets.length !== 1 ? "s" : ""
                          } displayed`
                }
                icon="wrench"
                bodyClassName=""
            >
                {/* Filters */}
                <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center">
                    <SearchInput
                        id="ticket-search"
                        label="Search tickets"
                        value={search}
                        onChange={(event) =>
                            setSearch(event.target.value)
                        }
                        placeholder="Search ticket, classroom, fault…"
                        className="lg:max-w-sm lg:flex-1"
                    />

                    <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                        <Segmented
                            ariaLabel="Filter by status"
                            options={statusOptions}
                            value={statusFilter}
                            onChange={setStatusFilter}
                        />
                        <Segmented
                            ariaLabel="Filter by priority"
                            options={priorityOptions}
                            value={priorityFilter}
                            onChange={setPriorityFilter}
                        />
                    </div>
                </div>

                {loading ? (
                    <SkeletonRows rows={5} />
                ) : filteredTickets.length === 0 ? (
                    <EmptyState
                        icon={tickets.length === 0 ? "checkCircle" : "search"}
                        title="No maintenance tickets found"
                        description="There are no tickets matching the current search and filter criteria."
                    />
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="table-wrap hidden lg:block">
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
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredTickets.map((ticket) => {
                                        const fault = ticket.fault;
                                        const room = ticket.classroom;

                                        return (
                                            <tr key={ticket.ticket_id}>
                                                <td>
                                                    <p className="num font-semibold text-slate-900">
                                                        #{ticket.ticket_id}
                                                    </p>
                                                    <p className="num mt-0.5 text-[11px] text-slate-500">
                                                        Fault #{ticket.fault_id}
                                                    </p>
                                                </td>

                                                <td>
                                                    <p className="font-semibold text-slate-900">
                                                        {getRoomLabel(ticket)}
                                                    </p>
                                                    {room?.building && (
                                                        <p className="mt-0.5 text-xs text-slate-500">
                                                            {getRoomMeta(room)}
                                                        </p>
                                                    )}
                                                </td>

                                                <td>
                                                    <p className="text-slate-700">
                                                        {getFaultLabel(fault?.fault_type)}
                                                    </p>
                                                    {fault?.device_id !== null &&
                                                        fault?.device_id !== undefined && (
                                                            <p className="num mt-0.5 text-[11px] text-slate-500">
                                                                Device #{fault.device_id}
                                                            </p>
                                                        )}
                                                </td>

                                                <td>
                                                    {ticket.priority ? (
                                                        <StatusBadge
                                                            status={ticket.priority}
                                                            dot={false}
                                                        />
                                                    ) : (
                                                        <span className="text-slate-500">—</span>
                                                    )}
                                                </td>

                                                <td>
                                                    <StatusBadge status={ticket.status || "OPEN"} />
                                                </td>

                                                <td className="num whitespace-nowrap text-xs text-slate-500">
                                                    {formatDate(ticket.created_at)}
                                                </td>

                                                <td className="text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigateTo(
                                                                `/maintenance/tickets/${ticket.ticket_id}`
                                                            )
                                                        }
                                                        className="btn btn-sm btn-primary"
                                                    >
                                                        Manage
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
                        <ul className="divide-y divide-slate-100 lg:hidden">
                            {filteredTickets.map((ticket) => {
                                const fault = ticket.fault;
                                const room = ticket.classroom;

                                return (
                                    <li key={ticket.ticket_id}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigateTo(
                                                    `/maintenance/tickets/${ticket.ticket_id}`
                                                )
                                            }
                                            className="group flex w-full items-start gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50"
                                        >
                                            <IconTile
                                                icon="wrench"
                                                tone={iconToneForPriority(ticket.priority)}
                                                className="h-10 w-10"
                                            />

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[15px] font-semibold text-slate-900">
                                                            {getFaultLabel(fault?.fault_type)}
                                                        </p>
                                                        <p className="num mt-0.5 text-xs text-slate-500">
                                                            Ticket #{ticket.ticket_id} · Fault #{ticket.fault_id}
                                                        </p>
                                                    </div>
                                                    <StatusBadge status={ticket.status || "OPEN"} />
                                                </div>

                                                <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-700">
                                                    <Icon name="mapPin" className="h-3.5 w-3.5 text-slate-500" />
                                                    <span className="truncate font-medium">
                                                        {getRoomLabel(ticket)}
                                                    </span>
                                                    {room?.building && (
                                                        <span className="truncate text-xs text-slate-500">
                                                            · {getRoomMeta(room)}
                                                        </span>
                                                    )}
                                                </p>

                                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                    <PriorityBadge priority={ticket.priority} size="sm" />
                                                    <span className="num flex items-center gap-1 text-[11px] text-slate-500">
                                                        <Icon name="clock" className="h-3 w-3" />
                                                        {formatDate(ticket.created_at)}
                                                    </span>
                                                </div>
                                            </div>

                                            <Icon
                                                name="chevronRight"
                                                className="mt-2.5 h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600"
                                            />
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

export default MaintenanceTickets;
