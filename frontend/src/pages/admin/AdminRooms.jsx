import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  IconTile,
  Modal,
  RefreshButton,
  SearchInput,
  SkeletonRows,
  Spinner,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { navigateTo } from "../../lib/session";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export default function AdminRooms() {
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

  const totalCapacity = classrooms.reduce(
    (sum, room) => sum + (Number(room.capacity) || 0),
    0
  );

  const buildingCount = new Set(
    classrooms.map((room) => room.building).filter(Boolean)
  ).size;

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

  return (
    <AppShell
      eyebrow="Infrastructure"
      title="Classrooms"
      actions={
        <>
          <RefreshButton onClick={loadClassrooms} loading={loading} />
          <button type="button" onClick={openAddModal} className="btn btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            <span className="hidden sm:inline">Add classroom</span>
            <span className="sr-only sm:hidden">Add classroom</span>
          </button>
        </>
      }
    >
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Manage registered classrooms and open an individual classroom to manage its connected devices.
      </p>

      {error && (
        <Alert tone="danger" title="Unable to load classrooms" onRetry={loadClassrooms} className="mb-6">
          {error}
        </Alert>
      )}

      {actionError && !showModal && (
        <Alert tone="danger" onDismiss={() => setActionError("")} className="mb-6">
          {actionError}
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Classroom summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total classrooms"
          value={classrooms.length}
          hint={`${buildingCount} ${buildingCount === 1 ? "building" : "buildings"}`}
          icon="classroom"
          tone="brand"
          loading={loading}
        />
        <StatCard
          label="Active"
          value={activeCount}
          hint="Operational and monitored"
          icon="checkCircle"
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Inactive"
          value={inactiveCount}
          hint={inactiveCount > 0 ? "Deactivated or offline" : "None deactivated"}
          icon="power"
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Total capacity"
          value={totalCapacity}
          hint="Seats across all classrooms"
          icon="users"
          tone="info"
          loading={loading}
        />
      </section>

      {/* CLASSROOM TABLE */}
      <Card
        className="mt-6"
        title="Registered classrooms"
        subtitle="Select a classroom to manage its devices."
        icon="building"
        bodyClassName=""
        actions={
          <SearchInput
            id="classroom-search"
            label="Search classrooms"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, type, building, ID…"
            className="w-full sm:w-72"
          />
        }
      >
        {loading ? (
          <SkeletonRows rows={6} />
        ) : filteredClassrooms.length === 0 ? (
          <EmptyState
            icon={search.trim() ? "search" : "classroom"}
            title="No classrooms found"
            description={
              search.trim()
                ? "No classrooms match your search. Try a different name, building or ID."
                : "There are currently no classrooms registered. Add one to start monitoring."
            }
            action={
              search.trim() ? (
                <button type="button" onClick={() => setSearch("")} className="btn btn-secondary">
                  Clear search
                </button>
              ) : (
                <button type="button" onClick={openAddModal} className="btn btn-primary">
                  <Icon name="plus" className="h-4 w-4" />
                  Add classroom
                </button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th scope="col">Classroom</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col" className="text-right">Capacity</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClassrooms.map((room) => {
                  const isActive = room.status === "ACTIVE";

                  return (
                    <tr key={room.room_id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigateTo(`/admin/rooms/${room.room_id}`)}
                          className="group flex items-center gap-3 rounded-md text-left"
                        >
                          <IconTile icon="classroom" tone={isActive ? "brand" : "neutral"} className="h-9 w-9" />
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-900 group-hover:text-brand-700">
                              {room.room_name}
                            </span>
                            <span className="num mt-0.5 block text-[11px] text-slate-500">ID {room.room_id}</span>
                          </span>
                        </button>
                      </td>
                      <td className="text-slate-600">{room.room_type || "—"}</td>
                      <td>
                        <p className="font-medium text-slate-700">{room.building || "—"}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Floor <span className="num">{room.floor ?? "—"}</span>
                        </p>
                      </td>
                      <td className="text-right">
                        <span className="num font-semibold text-slate-900">{room.capacity ?? "—"}</span>
                      </td>
                      <td>
                        <StatusBadge status={room.status} />
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigateTo(`/admin/rooms/${room.room_id}`)}
                            className="btn btn-sm btn-secondary"
                          >
                            Manage
                            <Icon name="arrowRight" className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(room)}
                            className="btn-icon h-8 w-8"
                            aria-label={`Edit ${room.room_name}`}
                            title="Edit"
                          >
                            <Icon name="edit" className="h-4 w-4" />
                          </button>
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(room)}
                              className="btn-icon h-8 w-8 hover:bg-amber-50 hover:text-amber-700"
                              aria-label={`Deactivate ${room.room_name}`}
                              title="Deactivate"
                            >
                              <Icon name="power" className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(room)}
                            className="btn-icon h-8 w-8 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Delete ${room.room_name}`}
                            title="Delete"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredClassrooms.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Showing <span className="num font-semibold text-slate-700">{filteredClassrooms.length}</span> of{" "}
            <span className="num font-semibold text-slate-700">{classrooms.length}</span> classrooms
          </div>
        )}
      </Card>

      {/* ADD / EDIT MODAL */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingRoom ? "Edit classroom" : "Add classroom"}
        description={
          editingRoom
            ? "Update the classroom information stored in SIMMS."
            : "Create a new classroom in the SIMMS database."
        }
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="classroom-form" disabled={saving} className="btn btn-primary">
              {saving && <Spinner />}
              {saving ? "Saving…" : editingRoom ? "Save changes" : "Create classroom"}
            </button>
          </>
        }
      >
        <form id="classroom-form" onSubmit={handleSave} className="space-y-4">
          {actionError && <Alert tone="danger">{actionError}</Alert>}

          <div>
            <label htmlFor="room_name" className="label">
              Classroom name <span className="text-red-500">*</span>
            </label>
            <input
              id="room_name"
              name="room_name"
              value={form.room_name}
              onChange={handleFormChange}
              required
              placeholder="e.g. CSE Lab 101"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="room_type" className="label">
              Room type <span className="text-red-500">*</span>
            </label>
            <input
              id="room_type"
              name="room_type"
              value={form.room_type}
              onChange={handleFormChange}
              required
              placeholder="e.g. Laboratory / Classroom"
              className="input"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="building" className="label">
                Building <span className="text-red-500">*</span>
              </label>
              <input
                id="building"
                name="building"
                value={form.building}
                onChange={handleFormChange}
                required
                placeholder="e.g. Main Building"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="floor" className="label">
                Floor <span className="text-red-500">*</span>
              </label>
              <input
                id="floor"
                name="floor"
                type="number"
                min="0"
                value={form.floor}
                onChange={handleFormChange}
                required
                placeholder="e.g. 1"
                className="input num"
              />
            </div>
          </div>

          <div>
            <label htmlFor="capacity" className="label">
              Capacity <span className="text-red-500">*</span>
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={handleFormChange}
              required
              placeholder="e.g. 60"
              className="input num"
            />
            <p className="help-text">Maximum number of seated occupants.</p>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
