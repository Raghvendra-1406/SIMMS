import { useEffect, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function navigateTo(path) {
  window.location.href = path;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatStatus(value) {
  if (!value) return "—";

  return value.replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE:
      "bg-emerald-50 text-emerald-700 border-emerald-100",

    INACTIVE:
      "bg-slate-100 text-slate-500 border-slate-200",

    ONLINE:
      "bg-emerald-50 text-emerald-700 border-emerald-100",

    OFFLINE:
      "bg-red-50 text-red-600 border-red-100",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        styles[status] ||
        "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {formatStatus(status)}
    </span>
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

function Modal({
  title,
  description,
  children,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">

        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">

          <div>
            <h2 className="text-lg font-black text-slate-900">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>

        </div>

        <div className="p-6">
          {children}
        </div>

      </div>
    </div>
  );
}

export default function ClassroomDetails() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [deviceLoading, setDeviceLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [deviceError, setDeviceError] =
    useState("");

  const [showDeviceModal, setShowDeviceModal] =
    useState(false);

  const [editingDevice, setEditingDevice] =
    useState(null);

  const [savingDevice, setSavingDevice] =
    useState(false);

  const [actionError, setActionError] =
    useState("");

  const [deviceForm, setDeviceForm] = useState({
    device_type: "",
    device_name: "",
  });

  const adminName =
    localStorage.getItem("name") || "Administrator";

  const adminEmail =
    localStorage.getItem("email") || "";

  const pathParts =
    window.location.pathname.split("/");

  const roomId = pathParts[
    pathParts.length - 1
  ];

  const loadRoom = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/classrooms/${roomId}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load classroom information."
        );
      }

      const data = await response.json();

      setRoom(data);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load classroom."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      setDeviceLoading(true);
      setDeviceError("");

      const response = await fetch(
        `${API_BASE_URL}/devices/room/${roomId}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load classroom devices."
        );
      }

      const data = await response.json();

      setDevices(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      setDeviceError(
        err.message ||
          "Unable to load devices."
      );
    } finally {
      setDeviceLoading(false);
    }
  };

  const loadData = async () => {
    await Promise.all([
      loadRoom(),
      loadDevices(),
    ]);
  };

  useEffect(() => {
    if (!roomId) {
      setError("Invalid classroom ID.");
      setLoading(false);
      return;
    }

    loadData();
  }, [roomId]);

  const openAddDeviceModal = () => {
    setEditingDevice(null);

    setDeviceForm({
      device_type: "",
      device_name: "",
    });

    setActionError("");
    setShowDeviceModal(true);
  };

  const openEditDeviceModal = (device) => {
    setEditingDevice(device);

    setDeviceForm({
      device_type: device.device_type || "",
      device_name: device.device_name || "",
    });

    setActionError("");
    setShowDeviceModal(true);
  };

  const handleDeviceFormChange = (event) => {
    const { name, value } = event.target;

    setDeviceForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveDevice = async (event) => {
    event.preventDefault();

    setSavingDevice(true);
    setActionError("");

    try {
      const payload = {
        room_id: Number(roomId),
        device_type:
          deviceForm.device_type.trim(),
        device_name:
          deviceForm.device_name.trim(),
      };

      let response;

      if (editingDevice) {
        response = await fetch(
          `${API_BASE_URL}/devices/${editingDevice.device_id}`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          }
        );
      } else {
        response = await fetch(
          `${API_BASE_URL}/devices`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          }
        );
      }

      if (!response.ok) {
        let detail =
          "Unable to save device.";

        try {
          const data = await response.json();

          if (data.detail) {
            detail = Array.isArray(data.detail)
              ? data.detail
                  .map((item) => item.msg)
                  .join(", ")
              : data.detail;
          }
        } catch {
          // Keep default.
        }

        throw new Error(detail);
      }

      setShowDeviceModal(false);

      await loadDevices();
    } catch (err) {
      setActionError(
        err.message ||
          "Unable to save device."
      );
    } finally {
      setSavingDevice(false);
    }
  };

  const handleDeviceStatus = async (device) => {
    const nextStatus =
      device.status === "ACTIVE"
        ? "INACTIVE"
        : "ACTIVE";

    const confirmed = window.confirm(
      `${nextStatus === "ACTIVE" ? "Activate" : "Deactivate"} "${device.device_name}"?`
    );

    if (!confirmed) return;

    try {
      setActionError("");

      const response = await fetch(
        `${API_BASE_URL}/devices/${device.device_id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      if (!response.ok) {
        let detail =
          "Unable to update device status.";

        try {
          const data = await response.json();

          if (data.detail) {
            detail =
              typeof data.detail === "string"
                ? data.detail
                : detail;
          }
        } catch {
          // Keep default.
        }

        throw new Error(detail);
      }

      await loadDevices();
    } catch (err) {
      setActionError(
        err.message ||
          "Unable to update device status."
      );
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">

        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />

          <p className="mt-4 text-sm font-semibold text-slate-600">
            Loading classroom...
          </p>

        </div>

      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-5">

        <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-xl text-red-600">
            !
          </div>

          <h1 className="mt-5 text-xl font-black text-slate-900">
            Classroom unavailable
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            {error ||
              "The requested classroom could not be loaded."}
          </p>

          <button
            type="button"
            onClick={() =>
              navigateTo("/admin/rooms")
            }
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            Back to classrooms
          </button>

        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">

      {/* SIDEBAR */}

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

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-slate-950">
              S
            </div>

            {!sidebarCollapsed && (
              <div>
                <p className="font-black tracking-[0.2em] text-white">
                  SIMMS
                </p>

                <p className="text-[9px] uppercase tracking-[0.13em] text-slate-500">
                  Admin Console
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
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-white"
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
              className="absolute -right-3 top-6 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-cyan-300 shadow-lg"
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
              path="/admin/dashboard"
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="▣"
              label="Classrooms"
              path="/admin/rooms"
              active
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="⌁"
              label="Devices"
              path="/admin/devices"
              collapsed={sidebarCollapsed}
            />

            <NavigationItem
              icon="◉"
              label="Users"
              path="/admin/users"
              collapsed={sidebarCollapsed}
            />

          </nav>

          {!sidebarCollapsed && (
            <p className="mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Management
            </p>
          )}

          <NavigationItem
            icon="⌘"
            label="Calibration"
            path="/admin/calibration"
            collapsed={sidebarCollapsed}
          />

        </div>

        <div className="border-t border-white/10 p-3">

          {!sidebarCollapsed && (
            <div className="mb-3 rounded-xl bg-white/5 p-3">
              <p className="truncate text-xs font-semibold text-white">
                {adminName}
              </p>

              <p className="mt-1 truncate text-[10px] text-slate-500">
                {adminEmail}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title={sidebarCollapsed ? "Logout" : undefined}
            className={`flex w-full items-center rounded-xl text-sm font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300 ${
              sidebarCollapsed
                ? "justify-center px-2 py-2.5"
                : "gap-3 px-3 py-2.5"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
              ↪
            </span>

            {!sidebarCollapsed && (
              <span>Logout</span>
            )}
          </button>

        </div>

      </aside>

      {/* MAIN */}

      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed
            ? "lg:pl-[76px]"
            : "lg:pl-64"
        }`}
      >

        {/* HEADER */}

        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">

          <div className="flex h-20 items-center justify-between px-5 sm:px-8">

            <div className="flex items-center gap-3">

              <button
                type="button"
                onClick={() =>
                  navigateTo("/admin/rooms")
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
              >
                ←
              </button>

              <div>

                <p className="text-xs font-semibold text-slate-400">
                  Classrooms / Details
                </p>

                <h1 className="text-lg font-bold text-slate-900">
                  {room.room_name}
                </h1>

              </div>

            </div>

            <div className="flex items-center gap-3">

              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-semibold text-emerald-700">
                  System connected
                </span>
              </div>

              <button
                type="button"
                onClick={loadData}
                disabled={
                  loading || deviceLoading
                }
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                ↻ Refresh
              </button>

            </div>

          </div>

        </header>

        {/* CONTENT */}

        <main className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8">

          {/* HERO */}

          <section className="mb-6 overflow-hidden rounded-3xl bg-slate-950 p-7 shadow-xl shadow-slate-300/30">

            <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">

              <div>

                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5">

                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                    Classroom management
                  </span>

                </div>

                <h2 className="text-3xl font-black tracking-tight text-white">
                  {room.room_name}
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Room ID #{room.room_id} ·{" "}
                  {room.room_type || "Classroom"}
                </p>

              </div>

              <div>
                <StatusBadge
                  status={room.status}
                />
              </div>

            </div>

          </section>

          {/* ROOM INFORMATION */}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Building
              </p>

              <p className="mt-2 text-lg font-black text-slate-800">
                {room.building || "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Floor
              </p>

              <p className="mt-2 text-lg font-black text-slate-800">
                {room.floor ?? "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Capacity
              </p>

              <p className="mt-2 text-lg font-black text-slate-800">
                {room.capacity ?? "—"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Devices
              </p>

              <p className="mt-2 text-lg font-black text-cyan-700">
                {devices.length}
              </p>
            </div>

          </section>

          {/* DEVICES */}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

              <div>

                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-600">
                  Infrastructure
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-900">
                  Devices in this classroom
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  Devices assigned specifically to{" "}
                  {room.room_name}.
                </p>

              </div>

              <button
                type="button"
                onClick={openAddDeviceModal}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
              >
                + Add device
              </button>

            </div>

            {actionError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {actionError}
              </div>
            )}

            {deviceError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {deviceError}
                </p>
              </div>
            )}

            {deviceLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">

                <div className="text-center">

                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />

                  <p className="mt-4 text-sm font-semibold text-slate-600">
                    Loading devices...
                  </p>

                </div>

              </div>
            ) : devices.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-xl text-cyan-600">
                  ⌁
                </div>

                <h3 className="mt-4 text-sm font-bold text-slate-700">
                  No devices assigned
                </h3>

                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-400">
                  This classroom does not have any devices
                  registered yet. Add the classroom's ESP32,
                  sensors, camera, or other supported devices.
                </p>

                <button
                  type="button"
                  onClick={openAddDeviceModal}
                  className="mt-5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-cyan-700"
                >
                  Add first device
                </button>

              </div>
            ) : (
              <div className="mt-6 overflow-x-auto">

                <table className="w-full min-w-[800px] text-left">

                  <thead>
                    <tr className="border-b border-slate-100">

                      <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Device
                      </th>

                      <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Type
                      </th>

                      <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Last seen
                      </th>

                      <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {devices.map((device) => (
                      <tr
                        key={device.device_id}
                        className="border-b border-slate-50 last:border-0"
                      >

                        <td className="py-4">

                          <p className="text-sm font-bold text-slate-800">
                            {device.device_name ||
                              "Unnamed device"}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            Device ID #
                            {device.device_id}
                          </p>

                        </td>

                        <td className="py-4">

                          <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                            {formatStatus(
                              device.device_type
                            )}
                          </span>

                        </td>

                        <td className="py-4">
                          <StatusBadge
                            status={
                              device.status
                            }
                          />
                        </td>

                        <td className="py-4">

                          <p className="text-xs font-semibold text-slate-600">
                            {formatDate(
                              device.last_seen
                            )}
                          </p>

                        </td>

                        <td className="py-4">

                          <div className="flex justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                openEditDeviceModal(
                                  device
                                )
                              }
                              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeviceStatus(
                                  device
                                )
                              }
                              className={`rounded-lg px-3 py-2 text-xs font-bold ${
                                device.status ===
                                "ACTIVE"
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {device.status ===
                              "ACTIVE"
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                          </div>

                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>
            )}

          </section>

          {/* FOOTER */}

          <footer className="mt-8 border-t border-slate-200 py-6">

            <div className="flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">

              <p>
                SIMMS · Smart Classroom Infrastructure
                Monitoring System
              </p>

              <p>
                Administration Console · v1.0
              </p>

            </div>

          </footer>

        </main>

      </div>

      {/* DEVICE MODAL */}

      {showDeviceModal && (
        <Modal
          title={
            editingDevice
              ? "Edit device"
              : "Add device"
          }
          description={`Device will be assigned to ${room.room_name}.`}
          onClose={() =>
            setShowDeviceModal(false)
          }
        >
          <form
            onSubmit={handleSaveDevice}
            className="space-y-5"
          >

            {actionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {actionError}
              </div>
            )}

            <div className="rounded-xl bg-cyan-50 p-4">

              <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                Assigned classroom
              </p>

              <p className="mt-1 text-sm font-black text-cyan-900">
                {room.room_name}
              </p>

              <p className="mt-1 text-[10px] text-cyan-700">
                Room ID #{room.room_id}
              </p>

            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Device name
              </label>

              <input
                name="device_name"
                value={deviceForm.device_name}
                onChange={
                  handleDeviceFormChange
                }
                required
                placeholder="e.g. Classroom ESP32"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Device type
              </label>

              <select
                name="device_type"
                value={deviceForm.device_type}
                onChange={
                  handleDeviceFormChange
                }
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
              >
                <option value="">
                  Select device type
                </option>

                <option value="ESP32">
                  ESP32
                </option>

                <option value="RASPBERRY_PI">
                  Raspberry Pi
                </option>

                <option value="PZEM">
                  PZEM
                </option>

                <option value="CT_SENSOR">
                  CT Sensor
                </option>

                <option value="DHT11">
                  DHT11
                </option>

                <option value="LDR">
                  LDR
                </option>

                <option value="CAMERA">
                  Camera
                </option>
              </select>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">

              <p className="text-xs font-bold text-slate-700">
                Device status
              </p>

              <p className="mt-1 text-[10px] leading-5 text-slate-400">
                New devices are created through the backend
                device endpoint. Their status is managed
                using the existing SIMMS device status API.
              </p>

            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

              <button
                type="button"
                onClick={() =>
                  setShowDeviceModal(false)
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingDevice}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {savingDevice
                  ? "Saving..."
                  : editingDevice
                  ? "Save changes"
                  : "Add device"}
              </button>

            </div>

          </form>
        </Modal>
      )}

    </div>
  );
}