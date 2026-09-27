import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function MaintenanceTickets() {
    const [tickets, setTickets] = useState([]);
    const [faults, setFaults] = useState({});
    const [classrooms, setClassrooms] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const token = localStorage.getItem("access_token");
    const maintenanceName =
        localStorage.getItem("name") || "Maintenance Staff";
    const maintenanceEmail =
        localStorage.getItem("email") || "";

    const navigateTo = (path) => {
        window.location.href = path;
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = "/";
    };

    const fetchTickets = async () => {
        try {
            setLoading(true);
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

            case "ELECTRICAL_ABNORMALITY":
                return "Electrical Abnormality";

            default:
                return faultType.replaceAll("_", " ");
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "OPEN":
                return "border-cyan-200 bg-cyan-50 text-cyan-700";

            case "RESOLVED":
                return "border-emerald-200 bg-emerald-50 text-emerald-700";

            case "CLOSED":
                return "border-slate-200 bg-slate-50 text-slate-600";

            default:
                return "border-slate-200 bg-slate-50 text-slate-600";
        }
    };

    const getPriorityClass = (priority) => {
        switch (priority) {
            case "HIGH":
                return "bg-red-50 text-red-700";

            case "MEDIUM":
                return "bg-amber-50 text-amber-700";

            case "LOW":
                return "bg-emerald-50 text-emerald-700";

            default:
                return "bg-slate-50 text-slate-600";
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
                                    Maintenance Console
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
                            path="/maintenance/dashboard"
                            collapsed={sidebarCollapsed}
                            navigateTo={navigateTo}
                        />

                        <NavigationItem
                            icon="⌘"
                            label="Tickets"
                            path="/maintenance/tickets"
                            active
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
                                SIMMS is monitoring classroom
                                infrastructure and maintenance
                                activity.
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
                                {maintenanceName}
                            </p>

                            <p className="mt-1 truncate text-[10px] text-slate-500">
                                {maintenanceEmail ||
                                    "Maintenance Staff"}
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

            {/* Mobile Drawer */}
            {mobileMenuOpen && (
                <>
                    <div
                        onClick={() =>
                            setMobileMenuOpen(false)
                        }
                        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    />

                    <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 lg:hidden">
                        <div className="flex h-20 items-center border-b border-white/10 px-5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-slate-950">
                                    S
                                </div>

                                <div>
                                    <p className="font-black tracking-[0.2em] text-white">
                                        SIMMS
                                    </p>

                                    <p className="text-[9px] uppercase tracking-[0.13em] text-slate-500">
                                        Maintenance Console
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setMobileMenuOpen(false)
                                }
                                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                                ×
                            </button>
                        </div>

                        <div className="hide-scrollbar flex-1 overflow-y-auto px-4 py-7">
                            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                                Main
                            </p>

                            <button
                                type="button"
                                onClick={() =>
                                    navigateTo(
                                        "/maintenance/dashboard"
                                    )
                                }
                                className="mb-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-sm">
                                    ▦
                                </span>

                                <span className="ml-3">
                                    Dashboard
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    navigateTo(
                                        "/maintenance/tickets"
                                    )
                                }
                                className="flex w-full items-center rounded-xl bg-cyan-500 px-3 py-2.5 text-left text-sm font-semibold text-white shadow-md shadow-cyan-500/20"
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm">
                                    ⌘
                                </span>

                                <span className="ml-3">
                                    Tickets
                                </span>
                            </button>

                            <div className="mt-8 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />

                                    <span className="text-xs font-semibold text-slate-300">
                                        Monitoring active
                                    </span>
                                </div>

                                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                                    SIMMS is monitoring classroom
                                    infrastructure and maintenance
                                    activity.
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-white/10 p-3">
                            <div className="mb-3 rounded-xl bg-white/5 p-3">
                                <p className="truncate text-xs font-semibold text-white">
                                    {maintenanceName}
                                </p>

                                <p className="mt-1 truncate text-[10px] text-slate-500">
                                    {maintenanceEmail ||
                                        "Maintenance Staff"}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                                    ↪
                                </span>

                                <span>Logout</span>
                            </button>
                        </div>
                    </aside>
                </>
            )}

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
                            <button
                                type="button"
                                onClick={() =>
                                    setMobileMenuOpen(true)
                                }
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
                            >
                                ☰
                            </button>

                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">
                                    Maintenance operations
                                </p>

                                <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                                    Maintenance Tickets
                                </h1>

                                <p className="mt-0.5 hidden text-xs text-slate-400 sm:block">
                                    Manage confirmed infrastructure
                                    faults and maintenance work
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={fetchTickets}
                                disabled={loading}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                {loading
                                    ? "Refreshing..."
                                    : "Refresh"}
                            </button>

                            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-cyan-300 sm:flex">
                                {maintenanceName
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
                            Maintenance operations
                        </p>

                        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                            Maintenance work queue
                        </h2>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                            Review confirmed infrastructure faults,
                            update maintenance status, and close
                            completed tickets.
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

                    {/* Stats */}
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <SummaryCard
                            label="Open Tickets"
                            value={
                                loading
                                    ? "—"
                                    : openCount
                            }
                            icon="⌘"
                        />

                        <SummaryCard
                            label="Resolved Tickets"
                            value={
                                loading
                                    ? "—"
                                    : resolvedCount
                            }
                            icon="✓"
                            valueClass="text-emerald-600"
                        />

                        <SummaryCard
                            label="High Priority"
                            value={
                                loading
                                    ? "—"
                                    : highPriorityCount
                            }
                            icon="⚠"
                            valueClass="text-orange-600"
                        />
                    </div>

                    {/* Filters */}
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="grid gap-3 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Search ticket, classroom, fault..."
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
                                />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(
                                        event.target.value
                                    )
                                }
                                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                            >
                                <option value="ALL">
                                    All Statuses
                                </option>

                                <option value="OPEN">
                                    Open
                                </option>

                                <option value="RESOLVED">
                                    Resolved
                                </option>
                            </select>

                            <select
                                value={priorityFilter}
                                onChange={(event) =>
                                    setPriorityFilter(
                                        event.target.value
                                    )
                                }
                                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400 md:col-start-3"
                            >
                                <option value="ALL">
                                    All Priorities
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

                    {/* Loading */}
                    {loading ? (
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />

                            <p className="mt-4 text-sm text-slate-500">
                                Loading maintenance tickets...
                            </p>
                        </div>
                    ) : filteredTickets.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-400">
                                —
                            </div>

                            <h3 className="mt-4 text-lg font-semibold text-slate-900">
                                No maintenance tickets found
                            </h3>

                            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                                There are no tickets matching the
                                current search and filter criteria.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
                                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">
                                            Maintenance work queue
                                        </h3>

                                        <p className="mt-1 text-xs text-slate-400">
                                            {filteredTickets.length}{" "}
                                            ticket
                                            {filteredTickets.length !==
                                            1
                                                ? "s"
                                                : ""}{" "}
                                            displayed
                                        </p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[900px]">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50 text-left">
                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                    Ticket
                                                </th>

                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                    Classroom
                                                </th>

                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                    Fault
                                                </th>

                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                    Priority
                                                </th>

                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                    Status
                                                </th>

                                                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                    Created
                                                </th>

                                                <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {filteredTickets.map(
                                                (ticket) => {
                                                    const fault =
                                                        ticket.fault;

                                                    const room =
                                                        ticket.classroom;

                                                    return (
                                                        <tr
                                                            key={
                                                                ticket.ticket_id
                                                            }
                                                            className="border-b border-slate-50 transition hover:bg-slate-50"
                                                        >
                                                            <td className="px-6 py-5">
                                                                <p className="text-sm font-bold text-slate-800">
                                                                    #
                                                                    {
                                                                        ticket.ticket_id
                                                                    }
                                                                </p>

                                                                <p className="mt-1 text-[10px] text-slate-400">
                                                                    Fault #
                                                                    {
                                                                        ticket.fault_id
                                                                    }
                                                                </p>
                                                            </td>

                                                            <td className="px-6 py-5">
                                                                <p className="text-sm font-semibold text-slate-700">
                                                                    {room?.room_name ||
                                                                        `Room ${
                                                                            fault?.room_id ||
                                                                            "—"
                                                                        }`}
                                                                </p>

                                                                {room?.building && (
                                                                    <p className="mt-1 text-xs text-slate-400">
                                                                        {
                                                                            room.building
                                                                        }

                                                                        {room.floor !==
                                                                            undefined &&
                                                                            ` • Floor ${room.floor}`}
                                                                    </p>
                                                                )}
                                                            </td>

                                                            <td className="px-6 py-5">
                                                                <p className="text-sm text-slate-600">
                                                                    {getFaultLabel(
                                                                        fault?.fault_type
                                                                    )}
                                                                </p>

                                                                {fault?.device_id !==
                                                                    null &&
                                                                    fault?.device_id !==
                                                                        undefined && (
                                                                        <p className="mt-1 text-[10px] text-slate-400">
                                                                            Device #
                                                                            {
                                                                                fault.device_id
                                                                            }
                                                                        </p>
                                                                    )}
                                                            </td>

                                                            <td className="px-6 py-5">
                                                                <span
                                                                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${getPriorityClass(
                                                                        ticket.priority
                                                                    )}`}
                                                                >
                                                                    {
                                                                        ticket.priority
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td className="px-6 py-5">
                                                                <span
                                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusClass(
                                                                        ticket.status
                                                                    )}`}
                                                                >
                                                                    {String(
                                                                        ticket.status ||
                                                                            "OPEN"
                                                                    ).replaceAll(
                                                                        "_",
                                                                        " "
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td className="px-6 py-5 text-xs text-slate-400">
                                                                {formatDate(
                                                                    ticket.created_at
                                                                )}
                                                            </td>

                                                            <td className="px-6 py-5 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        navigateTo(
                                                                            `/maintenance/tickets/${ticket.ticket_id}`
                                                                        )
                                                                    }
                                                                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                                                                >
                                                                    Manage
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Cards */}
                            <div className="mt-6 space-y-4 lg:hidden">
                                {filteredTickets.map(
                                    (ticket) => {
                                        const fault =
                                            ticket.fault;

                                        const room =
                                            ticket.classroom;

                                        return (
                                            <button
                                                type="button"
                                                key={
                                                    ticket.ticket_id
                                                }
                                                onClick={() =>
                                                    navigateTo(
                                                        `/maintenance/tickets/${ticket.ticket_id}`
                                                    )
                                                }
                                                className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-cyan-300"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-lg font-black text-slate-900">
                                                            Ticket #
                                                            {
                                                                ticket.ticket_id
                                                            }
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-400">
                                                            Fault #
                                                            {
                                                                ticket.fault_id
                                                            }
                                                        </p>
                                                    </div>

                                                    <span
                                                        className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold ${getStatusClass(
                                                            ticket.status
                                                        )}`}
                                                    >
                                                        {String(
                                                            ticket.status ||
                                                                "OPEN"
                                                        ).replaceAll(
                                                            "_",
                                                            " "
                                                        )}
                                                    </span>
                                                </div>

                                                <div className="mt-5 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                            Classroom
                                                        </p>

                                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                                            {room?.room_name ||
                                                                `Room ${
                                                                    fault?.room_id ||
                                                                    "—"
                                                                }`}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                            Fault
                                                        </p>

                                                        <p className="mt-1 text-sm font-semibold text-slate-700">
                                                            {getFaultLabel(
                                                                fault?.fault_type
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                            Priority
                                                        </p>

                                                        <span
                                                            className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${getPriorityClass(
                                                                ticket.priority
                                                            )}`}
                                                        >
                                                            {
                                                                ticket.priority
                                                            }
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                                            Created
                                                        </p>

                                                        <p className="mt-1 text-xs text-slate-500">
                                                            {formatDate(
                                                                ticket.created_at
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                                                    <span className="text-xs font-semibold text-slate-500">
                                                        Open ticket details
                                                    </span>

                                                    <span className="text-cyan-600">
                                                        →
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    }
                                )}
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            SIMMS Maintenance Console
                        </p>

                        <p>
                            {loading
                                ? "Loading maintenance data..."
                                : `${filteredTickets.length} ticket${
                                      filteredTickets.length ===
                                      1
                                          ? ""
                                          : "s"
                                  } displayed`}
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

export default MaintenanceTickets;