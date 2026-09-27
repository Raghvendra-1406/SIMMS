import { useEffect, useMemo, useState } from "react";

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

  return String(value).replaceAll("_", " ");
}

function formatDeviceType(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE:
      "bg-emerald-50 text-emerald-700 border-emerald-100",

    INACTIVE:
      "bg-slate-100 text-slate-500 border-slate-200",
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

function Sidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
}) {
  const adminName =
    localStorage.getItem("name") ||
    "Administrator";

  const adminEmail =
    localStorage.getItem("email") || "";

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("name");
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    localStorage.removeItem("is_active");

    window.location.href = "/";
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-950 transition-all duration-300 lg:flex ${
        sidebarCollapsed
          ? "w-[76px]"
          : "w-64"
      }`}
    >
      {/* BRAND */}
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

      {/* NAVIGATION */}
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
            collapsed={sidebarCollapsed}
          />

          <NavigationItem
            icon="⌁"
            label="Devices"
            path="/admin/devices"
            active
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

        <nav className="mt-1 space-y-1">
          <NavigationItem
            icon="⌘"
            label="Calibration"
            path="/admin/calibration"
            collapsed={sidebarCollapsed}
          />
        </nav>

        {/* MONITORING STATUS */}
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

      {/* FOOTER */}
      <div className="border-t border-white/10 p-3">
        {!sidebarCollapsed && (
          <div className="mb-3 rounded-xl bg-white/5 p-3">
            <p className="truncate text-xs font-semibold text-white">
              {adminName}
            </p>

            <p className="mt-1 truncate text-[10px] text-slate-500">
              {adminEmail || "Administrator"}
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
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  iconStyle,
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg ${iconStyle}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminDevices() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [devices, setDevices] = useState([]);
  const [classrooms, setClassrooms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [typeFilter, setTypeFilter] =
    useState("ALL");

  const [roomFilter, setRoomFilter] =
    useState("ALL");

  const [showModal, setShowModal] =
    useState(false);

  const [editingDevice, setEditingDevice] =
    useState(null);

  const [saving, setSaving] =
    useState(false);

  const [statusUpdatingId, setStatusUpdatingId] =
    useState(null);

  const [deviceForm, setDeviceForm] = useState({
    room_id: "",
    device_type: "",
    device_name: "",
  });

  const adminName =
    localStorage.getItem("name") ||
    "Administrator";

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = getAuthHeaders();

      const [
        devicesResponse,
        classroomsResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/devices`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/classrooms`, {
          headers,
        }),
      ]);

      if (
        !devicesResponse.ok ||
        !classroomsResponse.ok
      ) {
        throw new Error(
          "Unable to load device data from the SIMMS backend."
        );
      }

      const [
        devicesData,
        classroomsData,
      ] = await Promise.all([
        devicesResponse.json(),
        classroomsResponse.json(),
      ]);

      setDevices(
        Array.isArray(devicesData)
          ? devicesData
          : []
      );

      setClassrooms(
        Array.isArray(classroomsData)
          ? classroomsData
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the SIMMS backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getRoomName = (roomId) => {
    const room = classrooms.find(
      (item) =>
        item.room_id === roomId
    );

    return (
      room?.room_name ||
      `Room ${roomId}`
    );
  };

  const deviceTypes = useMemo(() => {
    return Array.from(
      new Set(
        devices
          .map(
            (device) =>
              device.device_type
          )
          .filter(Boolean)
      )
    ).sort();
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const search =
      searchTerm.trim().toLowerCase();

    return devices.filter((device) => {
      const matchesSearch =
        !search ||
        String(device.device_id)
          .toLowerCase()
          .includes(search) ||
        String(
          device.device_name || ""
        )
          .toLowerCase()
          .includes(search) ||
        String(
          device.device_type || ""
        )
          .toLowerCase()
          .includes(search) ||
        String(
          getRoomName(device.room_id)
        )
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        statusFilter === "ALL" ||
        device.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" ||
        device.device_type === typeFilter;

      const matchesRoom =
        roomFilter === "ALL" ||
        String(device.room_id) ===
          String(roomFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesRoom
      );
    });
  }, [
    devices,
    searchTerm,
    statusFilter,
    typeFilter,
    roomFilter,
    classrooms,
  ]);

  const activeDevices = devices.filter(
    (device) =>
      device.status === "ACTIVE"
  ).length;

  const inactiveDevices =
    devices.length - activeDevices;

  const openAddModal = () => {
    setEditingDevice(null);

    setDeviceForm({
      room_id: "",
      device_type: "",
      device_name: "",
    });

    setShowModal(true);
  };

  const openEditModal = (device) => {
    setEditingDevice(device);

    setDeviceForm({
      room_id: device.room_id ?? "",
      device_type:
        device.device_type || "",
      device_name:
        device.device_name || "",
    });

    setShowModal(true);
  };

  const handleChange = (event) => {
    const { name, value } =
      event.target;

    setDeviceForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !deviceForm.room_id ||
      !deviceForm.device_type.trim() ||
      !deviceForm.device_name.trim()
    ) {
      setError(
        "Classroom, device type, and device name are required."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        room_id: Number(
          deviceForm.room_id
        ),
        device_type:
          deviceForm.device_type.trim(),
        device_name:
          deviceForm.device_name.trim(),
      };

      const response = editingDevice
        ? await fetch(
            `${API_BASE_URL}/devices/${editingDevice.device_id}`,
            {
              method: "PUT",
              headers: getAuthHeaders(),
              body: JSON.stringify(
                payload
              ),
            }
          )
        : await fetch(
            `${API_BASE_URL}/devices`,
            {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify(
                payload
              ),
            }
          );

      if (!response.ok) {
        let detail =
          "Unable to save device.";

        try {
          const data =
            await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail ===
              "string"
                ? data.detail
                : JSON.stringify(
                    data.detail
                  );
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      setShowModal(false);

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to save device."
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleDeviceStatus = async (
    device
  ) => {
    const nextStatus =
      device.status === "ACTIVE"
        ? "INACTIVE"
        : "ACTIVE";

    try {
      setStatusUpdatingId(
        device.device_id
      );

      setError("");

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
          const data =
            await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail ===
              "string"
                ? data.detail
                : JSON.stringify(
                    data.detail
                  );
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      await loadData();
    } catch (err) {
      setError(
        err.message ||
          "Unable to update device status."
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setRoomFilter("ALL");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        sidebarCollapsed={
          sidebarCollapsed
        }
        setSidebarCollapsed={
          setSidebarCollapsed
        }
      />

      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed
            ? "lg:pl-[76px]"
            : "lg:pl-64"
        }`}
      >
        {/* TOP BAR */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400">
                  Administration
                </p>

                <h1 className="text-lg font-bold text-slate-900">
                  Device Management
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
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700 ring-1 ring-cyan-100 sm:flex">
                {adminName
                  .charAt(0)
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8">
          {/* HERO */}
          <section className="mb-8 overflow-hidden rounded-3xl bg-slate-950 p-7 shadow-xl shadow-slate-300/30 sm:p-9">
            <div className="relative">
              <div className="absolute -right-20 -top-32 h-72 w-72 rounded-full border-[40px] border-cyan-400/10" />

              <div className="absolute -bottom-40 right-24 h-80 w-80 rounded-full border-[45px] border-blue-400/5" />

              <div className="relative z-10 max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                    Device infrastructure
                  </span>
                </div>

                <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Manage connected devices
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                  Register, configure, assign, and
                  manage the hardware connected to
                  SIMMS classrooms.
                </p>

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 transition hover:bg-cyan-50"
                  >
                    + Add device
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ERROR */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-bold text-red-800">
                Device data could not be processed
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={loadData}
                className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* STATS */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total devices"
              value={devices.length}
              description="Registered devices"
              icon="⌁"
              iconStyle="bg-cyan-50 text-cyan-700"
            />

            <StatCard
              title="Active"
              value={activeDevices}
              description="Currently active"
              icon="✓"
              iconStyle="bg-emerald-50 text-emerald-700"
            />

            <StatCard
              title="Inactive"
              value={inactiveDevices}
              description="Currently inactive"
              icon="○"
              iconStyle="bg-slate-100 text-slate-600"
            />

            <StatCard
              title="Device types"
              value={deviceTypes.length}
              description="Registered hardware types"
              icon="#"
              iconStyle="bg-blue-50 text-blue-700"
            />
          </section>

          {/* FILTERS */}
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-600">
                Device directory
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-900">
                Search and filter devices
              </h2>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Search
                </label>

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Search device, ID, type or classroom..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status
                </label>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="ALL">
                    All statuses
                  </option>

                  <option value="ACTIVE">
                    Active
                  </option>

                  <option value="INACTIVE">
                    Inactive
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Type
                </label>

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="ALL">
                    All types
                  </option>

                  {deviceTypes.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {formatDeviceType(
                          type
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Classroom
                </label>

                <select
                  value={roomFilter}
                  onChange={(event) =>
                    setRoomFilter(
                      event.target.value
                    )
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="ALL">
                    All classrooms
                  </option>

                  {classrooms.map(
                    (room) => (
                      <option
                        key={room.room_id}
                        value={room.room_id}
                      >
                        {room.room_name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="h-11 self-end rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </section>

          {/* TABLE */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-600">
                    Registered infrastructure
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Devices
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Showing{" "}
                    {filteredDevices.length}{" "}
                    of {devices.length} devices
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 p-6">
                {[1, 2, 3, 4, 5].map(
                  (item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-xl bg-slate-100"
                    />
                  )
                )}
              </div>
            ) : filteredDevices.length ===
              0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                  ⌁
                </div>

                <p className="mt-4 text-sm font-bold text-slate-700">
                  No devices found
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  No devices match the current
                  search or filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Device
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Type
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Classroom
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Last seen
                      </th>

                      <th className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredDevices.map(
                      (device) => (
                        <tr
                          key={
                            device.device_id
                          }
                          className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-cyan-300">
                                D
                              </div>

                              <div>
                                <p className="text-sm font-bold text-slate-700">
                                  {device.device_name ||
                                    `Device ${device.device_id}`}
                                </p>

                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  Device ID{" "}
                                  {
                                    device.device_id
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                              {formatDeviceType(
                                device.device_type
                              )}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-slate-700">
                              {getRoomName(
                                device.room_id
                              )}
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                              Room ID{" "}
                              {device.room_id}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge
                              status={
                                device.status
                              }
                            />
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-xs font-semibold text-slate-600">
                              {formatDate(
                                device.last_seen
                              )}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditModal(
                                    device
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={
                                  statusUpdatingId ===
                                  device.device_id
                                }
                                onClick={() =>
                                  toggleDeviceStatus(
                                    device
                                  )
                                }
                                className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${
                                  device.status ===
                                  "ACTIVE"
                                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {statusUpdatingId ===
                                device.device_id
                                  ? "Updating..."
                                  : device.status ===
                                    "ACTIVE"
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="mt-8 border-t border-slate-200 py-6">
            <div className="flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">
              <p>
                SIMMS · Smart Classroom
                Infrastructure Monitoring System
              </p>

              <p>
                Administration Console · v1.0
              </p>
            </div>
          </footer>
        </main>
      </div>

      {/* ADD / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-600">
                  Device configuration
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {editingDevice
                    ? "Edit device"
                    : "Add device"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Classroom
                </label>

                <select
                  name="room_id"
                  value={deviceForm.room_id}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">
                    Select classroom
                  </option>

                  {classrooms.map(
                    (room) => (
                      <option
                        key={room.room_id}
                        value={room.room_id}
                      >
                        {room.room_name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Device type
                </label>

                <select
                  name="device_type"
                  value={
                    deviceForm.device_type
                  }
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
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

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Device name
                </label>

                <input
                  type="text"
                  name="device_name"
                  value={
                    deviceForm.device_name
                  }
                  onChange={handleChange}
                  placeholder="Example: Classroom ESP32"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowModal(false)
                  }
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingDevice
                    ? "Save changes"
                    : "Add device"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}