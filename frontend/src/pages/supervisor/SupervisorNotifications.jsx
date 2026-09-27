import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function getToken() {
    return localStorage.getItem("access_token");
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

function getNotificationIcon(type) {
    switch (type) {
        case "TICKET_CREATED":
        case "NEW_TICKET":
            return "⌘";

        case "NEW_FAULT":
        case "FAULT_RECURRENCE":
            return "⚠";

        case "TICKET_STATUS":
            return "↻";

        case "CRITICAL_HEALTH":
            return "◆";

        case "DEVICE_OFFLINE":
            return "⌁";

        default:
            return "●";
    }
}

function getNotificationStyle(type) {
    switch (type) {
        case "NEW_FAULT":
        case "FAULT_RECURRENCE":
            return "border-red-200 bg-red-50 text-red-600";

        case "CRITICAL_HEALTH":
            return "border-orange-200 bg-orange-50 text-orange-600";

        case "DEVICE_OFFLINE":
            return "border-amber-200 bg-amber-50 text-amber-600";

        case "TICKET_CREATED":
        case "NEW_TICKET":
            return "border-cyan-200 bg-cyan-50 text-cyan-600";

        case "TICKET_STATUS":
            return "border-violet-200 bg-violet-50 text-violet-600";

        default:
            return "border-slate-200 bg-slate-50 text-slate-600";
    }
}

export default function SupervisorNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [activeFilter, setActiveFilter] = useState("all");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Desktop sidebar
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Mobile sidebar
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const name = localStorage.getItem("name") || "Supervisor";
    const email = localStorage.getItem("email") || "";

    const fetchNotifications = async () => {
        const token = getToken();

        if (!token) {
            window.location.href = "/";
            return;
        }

        setLoading(true);
        setError("");

        try {
            const [allResponse, unreadResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/notifications`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }),

                fetch(`${API_BASE_URL}/notifications/unread`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }),
            ]);

            if (
                allResponse.status === 401 ||
                unreadResponse.status === 401
            ) {
                localStorage.clear();
                window.location.href = "/";
                return;
            }

            if (
                allResponse.status === 403 ||
                unreadResponse.status === 403
            ) {
                throw new Error(
                    "You are not authorized to access notifications."
                );
            }

            if (!allResponse.ok) {
                throw new Error("Failed to load notifications.");
            }

            if (!unreadResponse.ok) {
                throw new Error(
                    "Failed to load unread notifications."
                );
            }

            const allData = await allResponse.json();
            const unreadData = await unreadResponse.json();

            setNotifications(
                Array.isArray(allData) ? allData : []
            );

            setUnreadCount(
                Array.isArray(unreadData)
                    ? unreadData.length
                    : 0
            );
        } catch (err) {
            setError(
                err.message || "Unable to load notifications."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAsRead = async (notificationId) => {
        const token = getToken();

        if (!token) {
            window.location.href = "/";
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/notifications/${notificationId}/read`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.status === 401) {
                localStorage.clear();
                window.location.href = "/";
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Failed to mark notification as read."
                );
            }

            const updatedNotification =
                await response.json();

            setNotifications((currentNotifications) =>
                currentNotifications.map((notification) =>
                    notification.notification_id ===
                    notificationId
                        ? updatedNotification
                        : notification
                )
            );

            setUnreadCount((count) =>
                Math.max(0, count - 1)
            );
        } catch (err) {
            setError(
                err.message ||
                    "Unable to update notification."
            );
        }
    };

    const markAllAsRead = async () => {
        const token = getToken();

        if (!token) {
            window.location.href = "/";
            return;
        }

        if (unreadCount === 0) {
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/notifications/read-all`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.status === 401) {
                localStorage.clear();
                window.location.href = "/";
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Failed to mark notifications as read."
                );
            }

            setNotifications((currentNotifications) =>
                currentNotifications.map(
                    (notification) => ({
                        ...notification,
                        is_read: true,
                    })
                )
            );

            setUnreadCount(0);
        } catch (err) {
            setError(
                err.message ||
                    "Unable to update notifications."
            );
        }
    };

    const handleNotificationClick = async (
        notification
    ) => {
        if (!notification.is_read) {
            await markAsRead(
                notification.notification_id
            );
        }

        if (notification.ticket_id) {
            setMobileSidebarOpen(false);

            window.location.href =
                `/supervisor/tickets/${notification.ticket_id}`;
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        setMobileSidebarOpen(false);
        window.location.href = "/";
    };

    const goTo = (path) => {
        setMobileSidebarOpen(false);
        window.location.href = path;
    };

    const filteredNotifications =
        activeFilter === "unread"
            ? notifications.filter(
                  (notification) =>
                      !notification.is_read
              )
            : notifications;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">

            {/* ================================================= */}
            {/* DESKTOP SIDEBAR */}
            {/* ================================================= */}

            <aside
                className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-950 transition-all duration-300 lg:flex ${
                    sidebarOpen
                        ? "w-64"
                        : "w-[76px]"
                }`}
            >
                {/* Brand */}
                <div
                    className={`flex h-20 items-center border-b border-slate-800 ${
                        sidebarOpen
                            ? "gap-3 px-5"
                            : "justify-center px-3"
                    }`}
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 font-black text-slate-950">
                        S
                    </div>

                    {sidebarOpen && (
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white">
                                SIMMS
                            </p>

                            <p className="truncate text-xs text-slate-400">
                                Supervisor Console
                            </p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="hide-scrollbar flex-1 overflow-y-auto px-3 py-7">

                    {sidebarOpen && (
                        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            Main
                        </p>
                    )}

                    <nav className="space-y-1">

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/dashboard"
                                )
                            }
                            className={`group flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white ${
                                sidebarOpen
                                    ? "gap-3"
                                    : "justify-center"
                            }`}
                        >
                            <span className="text-lg">
                                ▦
                            </span>

                            {sidebarOpen && (
                                <span>
                                    Dashboard
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/classrooms"
                                )
                            }
                            className={`group flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white ${
                                sidebarOpen
                                    ? "gap-3"
                                    : "justify-center"
                            }`}
                        >
                            <span className="text-lg">
                                ▣
                            </span>

                            {sidebarOpen && (
                                <span>
                                    Classrooms
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/monitoring"
                                )
                            }
                            className={`group flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white ${
                                sidebarOpen
                                    ? "gap-3"
                                    : "justify-center"
                            }`}
                        >
                            <span className="text-lg">
                                ⌁
                            </span>

                            {sidebarOpen && (
                                <span>
                                    Monitoring
                                </span>
                            )}
                        </button>

                    </nav>

                    {sidebarOpen && (
                        <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            Operations
                        </p>
                    )}

                    {!sidebarOpen && (
                        <div className="my-5 border-t border-slate-800" />
                    )}

                    <nav className="space-y-1">

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/faults"
                                )
                            }
                            className={`group flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white ${
                                sidebarOpen
                                    ? "gap-3"
                                    : "justify-center"
                            }`}
                        >
                            <span className="text-lg">
                                ⚠
                            </span>

                            {sidebarOpen && (
                                <span>
                                    Faults
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/tickets"
                                )
                            }
                            className={`group flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white ${
                                sidebarOpen
                                    ? "gap-3"
                                    : "justify-center"
                            }`}
                        >
                            <span className="text-lg">
                                ⌘
                            </span>

                            {sidebarOpen && (
                                <span>
                                    Tickets
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/notifications"
                                )
                            }
                            className={`group flex w-full items-center rounded-xl px-3 py-3 text-sm font-medium transition ${
                                sidebarOpen
                                    ? "gap-3 bg-cyan-400 text-slate-950"
                                    : "justify-center bg-cyan-400 text-slate-950"
                            }`}
                        >
                            <span className="text-lg">
                                ◉
                            </span>

                            {sidebarOpen && (
                                <span className="flex flex-1 items-center justify-between">
                                    <span>
                                        Notifications
                                    </span>

                                    {unreadCount > 0 && (
                                        <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-bold text-white">
                                            {unreadCount}
                                        </span>
                                    )}
                                </span>
                            )}
                        </button>

                    </nav>

                    {/* Monitoring Status */}
                    <div
                        className={`mt-8 rounded-2xl border border-slate-800 bg-slate-900 ${
                            sidebarOpen
                                ? "p-4"
                                : "p-3"
                        }`}
                    >
                        <div
                            className={`flex items-center ${
                                sidebarOpen
                                    ? "gap-3"
                                    : "justify-center"
                            }`}
                        >
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />

                            {sidebarOpen && (
                                <div>
                                    <p className="text-xs font-semibold text-white">
                                        Monitoring active
                                    </p>

                                    <p className="mt-0.5 text-[10px] text-slate-500">
                                        Real-time system
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-800 p-3">
                    {sidebarOpen ? (
                        <div className="flex items-center gap-3 rounded-xl px-2 py-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
                                {name
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-white">
                                    {name}
                                </p>

                                <p className="truncate text-[10px] text-slate-500">
                                    {email}
                                </p>
                            </div>

                            <button
                                onClick={handleLogout}
                                title="Logout"
                                className="text-slate-500 transition hover:text-red-400"
                            >
                                ↪
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleLogout}
                            title="Logout"
                            className="flex w-full items-center justify-center rounded-xl px-3 py-3 text-lg text-slate-500 transition hover:bg-slate-900 hover:text-red-400"
                        >
                            ↪
                        </button>
                    )}
                </div>
            </aside>

            {/* ================================================= */}
            {/* MOBILE BACKDROP */}
            {/* ================================================= */}

            {mobileSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
                    onClick={() =>
                        setMobileSidebarOpen(false)
                    }
                />
            )}

            {/* ================================================= */}
            {/* MOBILE SIDEBAR */}
            {/* ================================================= */}

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 transition-transform duration-300 lg:hidden ${
                    mobileSidebarOpen
                        ? "translate-x-0"
                        : "-translate-x-full"
                }`}
            >
                {/* Mobile Brand */}
                <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">

                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-slate-950">
                            S
                        </div>

                        <div>
                            <p className="text-sm font-bold text-white">
                                SIMMS
                            </p>

                            <p className="text-xs text-slate-400">
                                Supervisor Console
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() =>
                            setMobileSidebarOpen(false)
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-900 hover:text-white"
                        aria-label="Close navigation"
                    >
                        ×
                    </button>
                </div>

                {/* Mobile Navigation */}
                <div className="hide-scrollbar flex-1 overflow-y-auto px-3 py-7">

                    <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        Main
                    </p>

                    <nav className="space-y-1">

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/dashboard"
                                )
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
                        >
                            <span className="text-lg">
                                ▦
                            </span>

                            <span>
                                Dashboard
                            </span>
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/classrooms"
                                )
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
                        >
                            <span className="text-lg">
                                ▣
                            </span>

                            <span>
                                Classrooms
                            </span>
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/monitoring"
                                )
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
                        >
                            <span className="text-lg">
                                ⌁
                            </span>

                            <span>
                                Monitoring
                            </span>
                        </button>

                    </nav>

                    <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                        Operations
                    </p>

                    <nav className="space-y-1">

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/faults"
                                )
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
                        >
                            <span className="text-lg">
                                ⚠
                            </span>

                            <span>
                                Faults
                            </span>
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/tickets"
                                )
                            }
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
                        >
                            <span className="text-lg">
                                ⌘
                            </span>

                            <span>
                                Tickets
                            </span>
                        </button>

                        <button
                            onClick={() =>
                                goTo(
                                    "/supervisor/notifications"
                                )
                            }
                            className="flex w-full items-center gap-3 rounded-xl bg-cyan-400 px-3 py-3 text-sm font-semibold text-slate-950"
                        >
                            <span className="text-lg">
                                ◉
                            </span>

                            <span className="flex flex-1 items-center justify-between">
                                <span>
                                    Notifications
                                </span>

                                {unreadCount > 0 && (
                                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-bold text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </span>
                        </button>

                    </nav>

                    {/* Mobile Monitoring Status */}
                    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center gap-3">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />

                            <div>
                                <p className="text-xs font-semibold text-white">
                                    Monitoring active
                                </p>

                                <p className="mt-0.5 text-[10px] text-slate-500">
                                    Real-time system
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Mobile Footer */}
                <div className="border-t border-slate-800 p-4">
                    <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-bold text-slate-950">
                            {name
                                .charAt(0)
                                .toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-white">
                                {name}
                            </p>

                            <p className="truncate text-[10px] text-slate-500">
                                {email}
                            </p>
                        </div>

                        <button
                            onClick={handleLogout}
                            title="Logout"
                            className="text-lg text-slate-500 transition hover:text-red-400"
                        >
                            ↪
                        </button>

                    </div>
                </div>
            </aside>

            {/* ================================================= */}
            {/* MAIN CONTENT */}
            {/* ================================================= */}

            <main
                className={`min-h-screen transition-all duration-300 ${
                    sidebarOpen
                        ? "lg:pl-64"
                        : "lg:pl-[76px]"
                }`}
            >

                {/* Top Bar */}
                <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">

                    <div className="flex items-center gap-3">

                        {/* Mobile Menu */}
                        <button
                            onClick={() =>
                                setMobileSidebarOpen(true)
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 lg:hidden"
                            aria-label="Open navigation"
                        >
                            ☰
                        </button>

                        {/* Desktop Sidebar Toggle */}
                        <button
                            onClick={() =>
                                setSidebarOpen(
                                    (value) => !value
                                )
                            }
                            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-600 transition hover:border-cyan-300 hover:text-cyan-600 lg:flex"
                            aria-label="Toggle sidebar"
                        >
                            ☰
                        </button>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
                                Operations
                            </p>

                            <h1 className="text-xl font-bold text-slate-950">
                                Notifications
                            </h1>
                        </div>

                    </div>

                    <div className="flex items-center gap-3">

                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold text-slate-800">
                                {name}
                            </p>

                            <p className="text-xs text-slate-500">
                                Supervisor
                            </p>
                        </div>

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                            {name
                                .charAt(0)
                                .toUpperCase()}
                        </div>

                    </div>
                </header>

                {/* Page Content */}
                <div className="p-4 sm:p-6 lg:p-8">

                    <div className="mx-auto max-w-7xl">

                        {/* Page Heading */}
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

                            <div>
                                <p className="text-sm text-slate-500">
                                    Important system and maintenance events
                                </p>

                                <div className="mt-2 flex items-center gap-3">

                                    <h2 className="text-2xl font-bold text-slate-950">
                                        Notification Center
                                    </h2>

                                    {unreadCount > 0 && (
                                        <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-700">
                                            {unreadCount} unread
                                        </span>
                                    )}

                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">

                                <button
                                    onClick={
                                        fetchNotifications
                                    }
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                                >
                                    Refresh
                                </button>

                                <button
                                    onClick={
                                        markAllAsRead
                                    }
                                    disabled={
                                        unreadCount ===
                                        0
                                    }
                                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Mark all as read
                                </button>

                            </div>

                        </div>

                        {/* Filters */}
                        <div className="mb-6 flex flex-wrap gap-2">

                            <button
                                onClick={() =>
                                    setActiveFilter(
                                        "all"
                                    )
                                }
                                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                                    activeFilter ===
                                    "all"
                                        ? "bg-cyan-400 text-slate-950"
                                        : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300"
                                }`}
                            >
                                All
                            </button>

                            <button
                                onClick={() =>
                                    setActiveFilter(
                                        "unread"
                                    )
                                }
                                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                                    activeFilter ===
                                    "unread"
                                        ? "bg-cyan-400 text-slate-950"
                                        : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-300"
                                }`}
                            >
                                Unread

                                {unreadCount > 0 && (
                                    <span className="ml-2 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] text-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                        </div>

                        {/* Error */}
                        {error && (
                            <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4">

                                <div>
                                    <p className="text-sm font-semibold text-red-700">
                                        Unable to load notifications
                                    </p>

                                    <p className="mt-1 text-sm text-red-600">
                                        {error}
                                    </p>
                                </div>

                                <button
                                    onClick={
                                        fetchNotifications
                                    }
                                    className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                                >
                                    Retry
                                </button>

                            </div>
                        )}

                        {/* Loading */}
                        {loading ? (
                            <div className="space-y-4">

                                {[1, 2, 3].map(
                                    (item) => (
                                        <div
                                            key={item}
                                            className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
                                        >
                                            <div className="flex gap-4">

                                                <div className="h-11 w-11 rounded-xl bg-slate-200" />

                                                <div className="flex-1 space-y-3">

                                                    <div className="h-4 w-40 rounded bg-slate-200" />

                                                    <div className="h-3 w-3/4 rounded bg-slate-200" />

                                                    <div className="h-3 w-32 rounded bg-slate-200" />

                                                </div>

                                            </div>
                                        </div>
                                    )
                                )}

                            </div>
                        ) : filteredNotifications.length ===
                          0 ? (
                            /* Empty */
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">

                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                                    ◉
                                </div>

                                <h3 className="mt-4 text-lg font-bold text-slate-900">
                                    {activeFilter ===
                                    "unread"
                                        ? "No unread notifications"
                                        : "No notifications"}
                                </h3>

                                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                                    {activeFilter ===
                                    "unread"
                                        ? "All supervisor notifications have been read."
                                        : "New faults, tickets, status changes, and important system events will appear here."}
                                </p>

                            </div>
                        ) : (
                            /* Notification List */
                            <div className="space-y-4">

                                {filteredNotifications.map(
                                    (notification) => {
                                        const iconStyle =
                                            getNotificationStyle(
                                                notification.notification_type
                                            );

                                        return (
                                            <div
                                                key={
                                                    notification.notification_id
                                                }
                                                onClick={() =>
                                                    handleNotificationClick(
                                                        notification
                                                    )
                                                }
                                                className={`group cursor-pointer rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
                                                    notification.is_read
                                                        ? "border-slate-200"
                                                        : "border-cyan-200 bg-cyan-50/20"
                                                }`}
                                            >
                                                <div className="flex items-start gap-4">

                                                    {/* Icon */}
                                                    <div
                                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg font-bold ${iconStyle}`}
                                                    >
                                                        {getNotificationIcon(
                                                            notification.notification_type
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="min-w-0 flex-1">

                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                                                            <div>

                                                                <div className="flex flex-wrap items-center gap-2">

                                                                    <p className="text-sm font-bold text-slate-900">
                                                                        {notification.notification_type}
                                                                    </p>

                                                                    {!notification.is_read && (
                                                                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-700">
                                                                            New
                                                                        </span>
                                                                    )}

                                                                </div>

                                                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                                                    {notification.message}
                                                                </p>

                                                            </div>

                                                            <p className="shrink-0 text-xs text-slate-400">
                                                                {formatDateTime(
                                                                    notification.created_at
                                                                )}
                                                            </p>

                                                        </div>

                                                        <div className="mt-4 flex flex-wrap items-center gap-3">

                                                            {notification.ticket_id && (
                                                                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                                                    Ticket #
                                                                    {
                                                                        notification.ticket_id
                                                                    }
                                                                </span>
                                                            )}

                                                            {!notification.is_read && (
                                                                <button
                                                                    onClick={(
                                                                        event
                                                                    ) => {
                                                                        event.stopPropagation();

                                                                        markAsRead(
                                                                            notification.notification_id
                                                                        );
                                                                    }}
                                                                    className="text-xs font-semibold text-cyan-700 transition hover:text-cyan-900"
                                                                >
                                                                    Mark as read
                                                                </button>
                                                            )}

                                                            {notification.ticket_id && (
                                                                <span className="ml-auto text-xs font-semibold text-slate-400 transition group-hover:text-cyan-600">
                                                                    View ticket →
                                                                </span>
                                                            )}

                                                        </div>

                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                )}

                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
