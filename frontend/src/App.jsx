import Login from "./pages/auth/Login";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRooms from "./pages/admin/AdminRooms";
import ClassroomDetails from "./pages/admin/ClassroomDetails";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCalibration from "./pages/admin/AdminCalibration";

import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import SupervisorClassrooms from "./pages/supervisor/SupervisorClassrooms";
import SupervisorMonitoring from "./pages/supervisor/SupervisorMonitoring";
import SupervisorTickets from "./pages/supervisor/SupervisorTickets";
import SupervisorTicketDetails from "./pages/supervisor/SupervisorTicketDetails";
import SupervisorFaults from "./pages/supervisor/SupervisorFaults";
import SupervisorFaultDetails from "./pages/supervisor/SupervisorFaultDetails";
import SupervisorNotifciations from "./pages/supervisor/SupervisorNotifications";

import MaintenanceDashboard from "./pages/maintenance/MaintenanceDashboard";
import MaintenanceTickets from "./pages/maintenance/MaintenanceTickets";
import MaintenanceTicketDetails from "./pages/maintenance/MaintenanceTicketDetails";


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
        return <SupervisorClassrooms />;
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
            <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
                <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-bold text-slate-900">
                        Access denied
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        You do not have permission to access this page.
                    </p>
                </div>
            </main>
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
            <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
                <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-bold text-slate-900">
                        Access denied
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        You do not have permission to access this page.
                    </p>
                </div>
            </main>
        );
    }


    // =========================
    // FALLBACK
    // =========================

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
            <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                <h1 className="text-xl font-bold text-slate-900">
                    SIMMS
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                    This dashboard is not implemented yet.
                </p>
            </div>
        </main>
    );
}

export default App;