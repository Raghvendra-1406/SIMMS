import Login from "./pages/auth/Login";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRooms from "./pages/admin/AdminRooms";
import ClassroomDetails from "./pages/admin/ClassroomDetails";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCalibration from "./pages/admin/AdminCalibration";

import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import SupervisorClassrooms from "./pages/supervisor/SupervisorClassrooms";
import SupervisorClassroomDetails from "./pages/supervisor/SupervisorClassroomDetails";
import SupervisorMonitoring from "./pages/supervisor/SupervisorMonitoring";
import SupervisorTickets from "./pages/supervisor/SupervisorTickets";
import SupervisorTicketDetails from "./pages/supervisor/SupervisorTicketDetails";
import SupervisorFaults from "./pages/supervisor/SupervisorFaults";
import SupervisorFaultDetails from "./pages/supervisor/SupervisorFaultDetails";
import SupervisorNotifciations from "./pages/supervisor/SupervisorNotifications";

import MaintenanceDashboard from "./pages/maintenance/MaintenanceDashboard";
import MaintenanceTickets from "./pages/maintenance/MaintenanceTickets";
import MaintenanceTicketDetails from "./pages/maintenance/MaintenanceTicketDetails";

import Icon from "./components/Icon";
import { BrandMark } from "./components/AppShell";

function StatusScreen({ icon, title, message }) {
    const role = localStorage.getItem("role");
    const home =
        role === "ADMIN"
            ? "/admin/dashboard"
            : role === "SUPERVISOR"
              ? "/supervisor/dashboard"
              : role === "MAINTENANCE_STAFF"
                ? "/maintenance/dashboard"
                : "/";

    return (
        <main className="flex min-h-dvh items-center justify-center bg-canvas px-5">
            <div className="card w-full max-w-sm animate-slide-up p-8 text-center">
                <div className="mx-auto mb-6 flex w-fit items-center gap-2.5">
                    <BrandMark className="h-8 w-8" textClass="text-sm" />
                    <span className="text-sm font-bold tracking-[0.16em] text-slate-900">SIMMS</span>
                </div>
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                    <Icon name={icon} className="h-5 w-5" />
                </span>
                <h1 className="mt-5 text-lg font-bold tracking-tight text-slate-900">{title}</h1>
                <p className="mt-1.5 text-sm text-slate-500">{message}</p>
                <a href={home} className="btn btn-primary mt-6 w-full">
                    <Icon name="arrowLeft" className="h-4 w-4" />
                    Back to your dashboard
                </a>
            </div>
        </main>
    );
}

function App() {
    const path = window.location.pathname;

    const accessToken = localStorage.getItem("access_token");
    const role = localStorage.getItem("role");

    if (!accessToken) {
        return <Login />;
    }


    // =========================
    // ADMIN ROUTES
    // =========================

    if (
        path === "/admin/dashboard" &&
        role === "ADMIN"
    ) {
        return <AdminDashboard />;
    }

    if (
        path === "/admin/users" &&
        role === "ADMIN"
    ) {
        return <AdminUsers />;
    }

    if (
        path === "/admin/rooms" &&
        role === "ADMIN"
    ) {
        return <AdminRooms />;
    }

    if (
        path.startsWith("/admin/rooms/") &&
        role === "ADMIN"
    ) {
        return <ClassroomDetails />;
    }

    if (
        path === "/admin/devices" &&
        role === "ADMIN"
    ) {
        return <AdminDevices />;
    }

    if (
        path === "/admin/calibration" &&
        role === "ADMIN"
    ) {
        return <AdminCalibration />;
    }


    // =========================
    // SUPERVISOR ROUTES
    // =========================

    if (
        path === "/supervisor/dashboard" &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorDashboard />;
    }

    if (
        path === "/supervisor/classrooms" &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorClassrooms />;
    }

    if (
        path === "/supervisor/monitoring" &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorMonitoring />;
    }

    if (
        path === "/supervisor/tickets" &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorTickets />;
    }

    if (
        path.startsWith("/supervisor/tickets/") &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorTicketDetails />;
    }

    if (
        path.startsWith("/supervisor/classrooms/") &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorClassroomDetails />;
    }
    if (
        path === "/supervisor/faults" &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorFaults />;
    }
    if (
        path.startsWith("/supervisor/faults/") &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorFaultDetails />;
    }
    if (
        path === "/supervisor/notifications" &&
        role === "SUPERVISOR"
    ) {
        return <SupervisorNotifciations />;
    }   


    if (
        path === "/maintenance/dashboard" &&
        role === "MAINTENANCE_STAFF"
    ) {
        return <MaintenanceDashboard />;
    }
    if (
        path.startsWith("/maintenance/tickets/") &&
        role === "MAINTENANCE_STAFF"
    ) {
        return <MaintenanceTicketDetails />;
    }
    if(
        path === "/maintenance/tickets" &&
        role === "MAINTENANCE_STAFF"
    ) {
        return <MaintenanceTickets />;
    }


    // =========================
    // ROOT REDIRECT
    // =========================

    if (path === "/") {
        if (role === "ADMIN") {
            window.location.href = "/admin/dashboard";
            return null;
        }

        if (role === "SUPERVISOR") {
            window.location.href = "/supervisor/dashboard";
            return null;
        }

        if (role === "MAINTENANCE_STAFF") {
            window.location.href = "/maintenance/dashboard";
            return null;
        }
    }


    // =========================
    // ADMIN ACCESS DENIED
    // =========================

    if (
        path.startsWith("/admin") &&
        role !== "ADMIN"
    ) {
        return (
            <StatusScreen
                icon="lock"
                title="Access denied"
                message="You do not have permission to access this page."
            />
        );
    }


    // =========================
    // SUPERVISOR ACCESS DENIED
    // =========================

    if (
        path.startsWith("/supervisor") &&
        role !== "SUPERVISOR"
    ) {
        return (
            <StatusScreen
                icon="lock"
                title="Access denied"
                message="You do not have permission to access this page."
            />
        );
    }


    // =========================
    // FALLBACK
    // =========================

    return (
        <StatusScreen
            icon="mapPin"
            title="Page not found"
            message="This page doesn't exist or hasn't been implemented yet."
        />
    );
}

export default App;