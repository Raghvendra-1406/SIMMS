import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
    Alert,
    Card,
    EmptyState,
    IconTile,
    RefreshButton,
    Segmented,
    SkeletonRows,
    Spinner,
    StatusBadge,
} from "../../components/ui";
import { formatLabel } from "../../lib/format";
import { navigateTo } from "../../lib/session";

// Backend URL: VITE_API_BASE_URL at build time (see lib/api.js).
import { API_BASE_URL } from "../../lib/api";

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

// Notification type -> Icon name + IconTile tone.
function getNotificationMeta(type) {
    switch (type) {
        case "TICKET_CREATED":
        case "NEW_TICKET":
            return { icon: "ticket", tone: "info" };

        case "NEW_FAULT":
        case "FAULT_RECURRENCE":
            return { icon: "alert", tone: "danger" };

        case "TICKET_STATUS":
            return { icon: "refresh", tone: "violet" };

        case "CRITICAL_HEALTH":
            return { icon: "heart", tone: "danger" };

        case "DEVICE_OFFLINE":
            return { icon: "wifiOff", tone: "warning" };

        default:
            return { icon: "bell", tone: "neutral" };
    }
}

export default function SupervisorNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [activeFilter, setActiveFilter] = useState("all");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [markingAll, setMarkingAll] = useState(false);

    const fetchNotifications = async () => {
        const token = getToken();

        if (!token) {
            navigateTo("/");
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
                navigateTo("/");
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
            navigateTo("/");
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
                navigateTo("/");
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
            navigateTo("/");
            return;
        }

        if (unreadCount === 0) {
            return;
        }

        setMarkingAll(true);

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
                navigateTo("/");
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
        } finally {
            setMarkingAll(false);
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
            navigateTo(
                `/supervisor/tickets/${notification.ticket_id}`
            );
        }
    };

    const filteredNotifications =
        activeFilter === "unread"
            ? notifications.filter(
                  (notification) =>
                      !notification.is_read
              )
            : notifications;

    const filterOptions = [
        { value: "all", label: "All", count: loading ? undefined : notifications.length },
        { value: "unread", label: "Unread", count: unreadCount > 0 ? unreadCount : undefined },
    ];

    return (
        <AppShell
            eyebrow="Operations"
            title="Notifications"
            unreadCount={unreadCount}
            actions={
                <>
                    <RefreshButton onClick={fetchNotifications} loading={loading} />
                    <button
                        type="button"
                        onClick={markAllAsRead}
                        disabled={unreadCount === 0 || markingAll}
                        className="btn btn-primary"
                        aria-label="Mark all as read"
                    >
                        {markingAll ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}
                        <span className="hidden sm:inline">
                            {markingAll ? "Marking…" : "Mark all as read"}
                        </span>
                    </button>
                </>
            }
        >
            {error && (
                <Alert
                    tone="danger"
                    title="Unable to load notifications"
                    onRetry={fetchNotifications}
                    className="mb-6"
                >
                    {error}
                </Alert>
            )}

            <Card
                title="Notification center"
                subtitle="Important system and maintenance events"
                icon="bell"
                bodyClassName=""
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        {unreadCount > 0 && (
                            <StatusBadge tone="brand" label={`${unreadCount} unread`} />
                        )}
                        <Segmented
                            ariaLabel="Notification filter"
                            options={filterOptions}
                            value={activeFilter}
                            onChange={setActiveFilter}
                        />
                    </div>
                }
            >
                {loading ? (
                    <SkeletonRows rows={4} />
                ) : filteredNotifications.length === 0 ? (
                    <EmptyState
                        icon={activeFilter === "unread" ? "checkCircle" : "bell"}
                        title={
                            activeFilter === "unread"
                                ? "No unread notifications"
                                : "No notifications"
                        }
                        description={
                            activeFilter === "unread"
                                ? "All supervisor notifications have been read."
                                : "New faults, tickets, status changes, and important system events will appear here."
                        }
                    />
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {filteredNotifications.map((notification) => {
                            const meta = getNotificationMeta(
                                notification.notification_type
                            );
                            const unread = !notification.is_read;

                            return (
                                <li
                                    key={notification.notification_id}
                                    className={`group relative flex items-start gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-slate-50 ${
                                        unread ? "bg-brand-50/40" : ""
                                    }`}
                                >
                                    {/* Unread marker */}
                                    <span
                                        className={`mt-3.5 h-2 w-2 shrink-0 rounded-full ${
                                            unread ? "bg-brand-600" : "bg-transparent"
                                        }`}
                                        aria-hidden="true"
                                    />

                                    <IconTile icon={meta.icon} tone={meta.tone} />

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleNotificationClick(
                                                        notification
                                                    )
                                                }
                                                className="min-w-0 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-sm focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-500"
                                            >
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={`text-sm ${
                                                            unread
                                                                ? "font-bold text-slate-900"
                                                                : "font-medium text-slate-700"
                                                        }`}
                                                    >
                                                        {formatLabel(notification.notification_type)}
                                                    </span>
                                                    {unread && (
                                                        <StatusBadge tone="brand" label="New" size="sm" dot={false} />
                                                    )}
                                                    {unread && <span className="sr-only">(unread)</span>}
                                                </span>
                                                <span
                                                    className={`mt-1 block text-sm leading-6 ${
                                                        unread ? "text-slate-700" : "text-slate-500"
                                                    }`}
                                                >
                                                    {notification.message}
                                                </span>
                                            </button>

                                            <p className="num shrink-0 text-xs text-slate-500">
                                                {formatDateTime(notification.created_at)}
                                            </p>
                                        </div>

                                        {(notification.ticket_id || unread) && (
                                            <div className="mt-2.5 flex flex-wrap items-center gap-3">
                                                {notification.ticket_id && (
                                                    <span className="num rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                                        Ticket #{notification.ticket_id}
                                                    </span>
                                                )}

                                                {unread && (
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();

                                                            markAsRead(
                                                                notification.notification_id
                                                            );
                                                        }}
                                                        className="btn btn-sm btn-ghost relative z-10 -ml-1 text-brand-700 hover:text-brand-800"
                                                    >
                                                        <Icon name="check" className="h-3.5 w-3.5" />
                                                        Mark as read
                                                    </button>
                                                )}

                                                {notification.ticket_id && (
                                                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors group-hover:text-brand-700">
                                                        View ticket
                                                        <Icon name="arrowRight" className="h-3.5 w-3.5" />
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Card>
        </AppShell>
    );
}
