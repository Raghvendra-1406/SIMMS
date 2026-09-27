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

  return value.replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
    INACTIVE: "bg-slate-100 text-slate-500 border-slate-200",
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
            className="flex h-9 w-9 items-center justify-center rounded-xl text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-xl text-cyan-600">
        ▣
      </div>

      <h3 className="mt-4 text-sm font-bold text-slate-700">
        No classrooms found
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-400">
        There are currently no classrooms matching the
        selected criteria.
      </p>
    </div>
  );
}

export default function AdminRooms() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [classrooms, setClassrooms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const [form, setForm] = useState({
    room_name: "",
    room_type: "",
    building: "",
    floor: "",
    capacity: "",
  });

  const adminName =
    localStorage.getItem("name") || "Administrator";

  const adminEmail =
    localStorage.getItem("email") || "";

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/classrooms`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load classrooms from the backend."
        );
      }

      const data = await response.json();

      setClassrooms(
        Array.isArray(data) ? data : []
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
    loadClassrooms();
  }, []);

  const filteredClassrooms = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return classrooms;
    }

    return classrooms.filter((room) => {
      return (
        String(room.room_name || "")
          .toLowerCase()
          .includes(value) ||
        String(room.room_type || "")
          .toLowerCase()
          .includes(value) ||
        String(room.building || "")
          .toLowerCase()
          .includes(value) ||
        String(room.room_id || "")
          .toLowerCase()
          .includes(value)
      );
    });
  }, [classrooms, search]);

  const activeCount = classrooms.filter(
    (room) => room.status === "ACTIVE"
  ).length;

  const inactiveCount = classrooms.filter(
    (room) => room.status !== "ACTIVE"
  ).length;

  const openAddModal = () => {
    setEditingRoom(null);

    setForm({
      room_name: "",
      room_type: "",
      building: "",
      floor: "",
      capacity: "",
    });

    setActionError("");
    setShowModal(true);
  };

  const openEditModal = (room) => {
    setEditingRoom(room);

    setForm({
      room_name: room.room_name || "",
      room_type: room.room_type || "",
      building: room.building || "",
      floor:
        room.floor !== null &&
        room.floor !== undefined
          ? String(room.floor)
          : "",
      capacity:
        room.capacity !== null &&
        room.capacity !== undefined
          ? String(room.capacity)
          : "",
    });

    setActionError("");
    setShowModal(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    setSaving(true);
    setActionError("");

    try {
      const payload = {
        room_name: form.room_name.trim(),
        room_type: form.room_type.trim(),
        building: form.building.trim(),
        floor: Number(form.floor),
        capacity: Number(form.capacity),
      };

      const url = editingRoom
        ? `${API_BASE_URL}/classrooms/${editingRoom.room_id}`
        : `${API_BASE_URL}/classrooms`;

      const method = editingRoom
        ? "PUT"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let detail =
          "Unable to save classroom.";

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
          // Keep default error message.
        }

        throw new Error(detail);
      }

      setShowModal(false);
      await loadClassrooms();
    } catch (err) {
      setActionError(
        err.message ||
          "Unable to save classroom."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (room) => {
    const confirmed = window.confirm(
      `Deactivate "${room.room_name}"?`
    );

    if (!confirmed) return;

    try {
      setActionError("");

      const response = await fetch(
        `${API_BASE_URL}/classrooms/${room.room_id}/deactivate`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        let detail =
          "Unable to deactivate classroom.";

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

      await loadClassrooms();
    } catch (err) {
      setActionError(
        err.message ||
          "Unable to deactivate classroom."
      );
    }
  };

  const handleDelete = async (room) => {
    const confirmed = window.confirm(
      `Delete "${room.room_name}" permanently?`
    );

    if (!confirmed) return;

    try {
      setActionError("");

      const response = await fetch(
        `${API_BASE_URL}/classrooms/${room.room_id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        let detail =
          "Unable to delete classroom.";

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

      await loadClassrooms();
    } catch (err) {
      setActionError(
        err.message ||
          "Unable to delete classroom."
      );
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

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

            <div className="flex items-center gap-4">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-cyan-300 lg:hidden">
                S
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400">
                  Administration
                </p>

                <h1 className="text-lg font-bold text-slate-900">
                  Classrooms
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
                onClick={loadClassrooms}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {loading
                  ? "Refreshing..."
                  : "↻ Refresh"}
              </button>

              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700 sm:flex">
                {adminName
                  .charAt(0)
                  .toUpperCase()}
              </div>

            </div>

          </div>
        </header>

        {/* CONTENT */}

        <main className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8">

          {/* PAGE INTRO */}

          <section className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">

            <div>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />

                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-700">
                  Infrastructure management
                </span>
              </div>

              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                Classrooms
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage registered classrooms and open an
                individual classroom to manage its connected
                devices.
              </p>

            </div>

            <button
              type="button"
              onClick={openAddModal}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-slate-300 transition hover:bg-slate-800"
            >
              + Add classroom
            </button>

          </section>

          {/* ERROR */}

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-bold text-red-800">
                Unable to load classrooms
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>
            </div>
          )}

          {actionError && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">
                {actionError}
              </p>
            </div>
          )}

          {/* STATS */}

          <section className="grid gap-4 sm:grid-cols-3">

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total classrooms
              </p>

              <p className="mt-2 text-3xl font-black text-slate-900">
                {classrooms.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active
              </p>

              <p className="mt-2 text-3xl font-black text-emerald-600">
                {activeCount}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Inactive
              </p>

              <p className="mt-2 text-3xl font-black text-slate-500">
                {inactiveCount}
              </p>
            </div>

          </section>

          {/* CLASSROOM TABLE */}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Registered classrooms
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Click a classroom to manage its devices.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  ⌕
                </span>

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search classrooms..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50"
                />
              </div>

            </div>

            <div className="mt-6">

              {loading ? (
                <div className="flex min-h-[350px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600" />

                    <p className="mt-4 text-sm font-semibold text-slate-600">
                      Loading classrooms...
                    </p>
                  </div>
                </div>
              ) : filteredClassrooms.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-x-auto">

                  <table className="w-full min-w-[850px] text-left">

                    <thead>
                      <tr className="border-b border-slate-100">

                        <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Classroom
                        </th>

                        <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Type
                        </th>

                        <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Location
                        </th>

                        <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Capacity
                        </th>

                        <th className="pb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Status
                        </th>

                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Actions
                        </th>

                      </tr>
                    </thead>

                    <tbody>

                      {filteredClassrooms.map(
                        (room) => (
                          <tr
                            key={room.room_id}
                            className="border-b border-slate-50 last:border-0"
                          >

                            <td className="py-4">

                              <button
                                type="button"
                                onClick={() =>
                                  navigateTo(
                                    `/admin/rooms/${room.room_id}`
                                  )
                                }
                                className="text-left"
                              >
                                <p className="text-sm font-bold text-slate-800 hover:text-cyan-700">
                                  {room.room_name}
                                </p>

                                <p className="mt-1 text-[10px] text-slate-400">
                                  Room ID #{room.room_id}
                                </p>
                              </button>

                            </td>

                            <td className="py-4 text-sm text-slate-600">
                              {room.room_type || "—"}
                            </td>

                            <td className="py-4">

                              <p className="text-sm font-semibold text-slate-600">
                                {room.building || "—"}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                Floor{" "}
                                {room.floor ?? "—"}
                              </p>

                            </td>

                            <td className="py-4 text-sm font-semibold text-slate-600">
                              {room.capacity ?? "—"}
                            </td>

                            <td className="py-4">
                              <StatusBadge
                                status={room.status}
                              />
                            </td>

                            <td className="py-4">

                              <div className="flex justify-end gap-2">

                                <button
                                  type="button"
                                  onClick={() =>
                                    navigateTo(
                                      `/admin/rooms/${room.room_id}`
                                    )
                                  }
                                  className="rounded-lg bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 hover:bg-cyan-100"
                                >
                                  Manage
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditModal(room)
                                  }
                                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                                >
                                  Edit
                                </button>

                                {room.status ===
                                  "ACTIVE" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeactivate(
                                        room
                                      )
                                    }
                                    className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
                                  >
                                    Deactivate
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDelete(room)
                                  }
                                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                                >
                                  Delete
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

            </div>
          </section>

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

      {/* ADD / EDIT MODAL */}

      {showModal && (
        <Modal
          title={
            editingRoom
              ? "Edit classroom"
              : "Add classroom"
          }
          description={
            editingRoom
              ? "Update the classroom information stored in SIMMS."
              : "Create a new classroom in the SIMMS database."
          }
          onClose={() => setShowModal(false)}
        >
          <form
            onSubmit={handleSave}
            className="space-y-4"
          >

            {actionError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {actionError}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Classroom name
              </label>

              <input
                name="room_name"
                value={form.room_name}
                onChange={handleFormChange}
                required
                placeholder="e.g. CSE Lab 101"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Room type
              </label>

              <input
                name="room_type"
                value={form.room_type}
                onChange={handleFormChange}
                required
                placeholder="e.g. Laboratory / Classroom"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Building
                </label>

                <input
                  name="building"
                  value={form.building}
                  onChange={handleFormChange}
                  required
                  placeholder="e.g. Main Building"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-600">
                  Floor
                </label>

                <input
                  name="floor"
                  type="number"
                  min="0"
                  value={form.floor}
                  onChange={handleFormChange}
                  required
                  placeholder="e.g. 1"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
                />
              </div>

            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Capacity
              </label>

              <input
                name="capacity"
                type="number"
                min="1"
                value={form.capacity}
                onChange={handleFormChange}
                required
                placeholder="e.g. 60"
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

              <button
                type="button"
                onClick={() =>
                  setShowModal(false)
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingRoom
                  ? "Save changes"
                  : "Create classroom"}
              </button>

            </div>

          </form>
        </Modal>
      )}

    </div>
  );
}