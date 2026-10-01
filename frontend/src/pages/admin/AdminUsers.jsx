import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  Modal,
  RefreshButton,
  Segmented,
  SearchInput,
  SkeletonRows,
  Spinner,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { formatLabel } from "../../lib/format";

// Backend URL: VITE_API_BASE_URL at build time (see lib/api.js).
import { API_BASE_URL } from "../../lib/api";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "SUPERVISOR", label: "Supervisor" },
  { value: "MAINTENANCE_STAFF", label: "Maintenance Staff" },
];

const ROLE_TONE = {
  ADMIN: "brand",
  SUPERVISOR: "violet",
  MAINTENANCE_STAFF: "info",
};

function RoleBadge({ role }) {
  return (
    <StatusBadge
      tone={ROLE_TONE[role] || "neutral"}
      label={formatLabel(role)}
      dot={false}
    />
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "SUPERVISOR",
  });

  const currentUserId = localStorage.getItem("user_id");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Unable to load users from the SIMMS backend.");
      }

      const data = await response.json();

      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to connect to the SIMMS backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const roles = useMemo(() => {
    return Array.from(
      new Set(users.map((user) => user.role).filter(Boolean))
    ).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !search ||
        String(user.user_id).toLowerCase().includes(search) ||
        String(user.name || "").toLowerCase().includes(search) ||
        String(user.email || "").toLowerCase().includes(search) ||
        String(user.role || "").toLowerCase().includes(search);

      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.is_active) ||
        (statusFilter === "INACTIVE" && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const activeUsers = users.filter((user) => user.is_active).length;

  const inactiveUsers = users.length - activeUsers;

  const adminUsers = users.filter((user) => user.role === "ADMIN").length;

  const openAddModal = () => {
    setEditingUser(null);

    setUserForm({
      name: "",
      email: "",
      password: "",
      role: "SUPERVISOR",
    });

    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);

    setUserForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "SUPERVISOR",
    });

    setShowPassword(false);
    setShowModal(true);
  };

  // The original close controls were disabled while saving.
  const closeModal = useCallback(() => {
    if (!saving) setShowModal(false);
  }, [saving]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setUserForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role) {
      setError("Name, email, and role are required.");

      return;
    }

    if (!editingUser && !userForm.password.trim()) {
      setError("Password is required when creating a user.");

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
      };

      /*
       * Password is included only when creating
       * a user or when the user explicitly enters
       * a new password during editing.
       */
      if (!editingUser || userForm.password.trim()) {
        payload.password = userForm.password.trim();
      }

      const response = editingUser
        ? await fetch(`${API_BASE_URL}/users/${editingUser.user_id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_BASE_URL}/users`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        let detail = "Unable to save user.";

        try {
          const data = await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      setShowModal(false);

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to save user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user) => {
    const nextStatus = !user.is_active;

    try {
      setStatusUpdatingId(user.user_id);

      setError("");

      const response = await fetch(
        `${API_BASE_URL}/users/${user.user_id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            is_active: nextStatus,
          }),
        }
      );

      if (!response.ok) {
        let detail = "Unable to update user status.";

        try {
          const data = await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to update user status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("ALL");
    setStatusFilter("ALL");
  };

  const hasFilters =
    searchTerm !== "" || roleFilter !== "ALL" || statusFilter !== "ALL";

  const statusOptions = [
    { value: "ALL", label: "All", count: users.length },
    { value: "ACTIVE", label: "Active", count: activeUsers },
    { value: "INACTIVE", label: "Inactive", count: inactiveUsers },
  ];

  // Load failed and nothing to show: KPI cards display "—" instead of misleading zeros.

  const loadFailed = Boolean(error) && users.length === 0;


  return (
    <AppShell
      eyebrow="Access"
      title="Users"
      actions={
        <>
          <RefreshButton onClick={loadUsers} loading={loading} />
          <button type="button" onClick={openAddModal} className="btn btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            <span className="hidden sm:inline">Add user</span>
            <span className="sr-only sm:hidden">Add user</span>
          </button>
        </>
      }
    >
      {error && !showModal && (
        <Alert
          tone="danger"
          title="User data could not be processed"
          onRetry={loadUsers}
          onDismiss={() => setError("")}
          className="mb-6"
        >
          {error}
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="User metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          unavailable={loadFailed}
          label="Total users"
          value={users.length}
          hint="Registered accounts"
          icon="users"
          tone="brand"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Active"
          value={activeUsers}
          hint="Accounts with access"
          icon="checkCircle"
          tone="success"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Inactive"
          value={inactiveUsers}
          hint="Access currently revoked"
          icon="lock"
          tone="neutral"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Administrators"
          value={adminUsers}
          hint="Accounts with full control"
          icon="shield"
          tone="violet"
          loading={loading}
        />
      </section>

      {/* DIRECTORY */}
      <Card
        className="mt-6"
        title="User directory"
        subtitle={
          loading
            ? "Loading accounts…"
            : `Showing ${filteredUsers.length} of ${users.length} users`
        }
        icon="users"
        bodyClassName=""
      >
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3.5 lg:flex-row lg:items-center">
          <SearchInput
            id="user-search"
            label="Search users"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, email, role or user ID…"
            className="w-full lg:max-w-sm lg:flex-1"
          />

          <Segmented
            ariaLabel="Filter by status"
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            className="self-start lg:self-auto"
          />

          <div className="flex items-center gap-3 lg:ml-auto">
            <div className="flex-1 sm:flex-none">
              <label htmlFor="user-role-filter" className="sr-only">
                Role
              </label>
              <select
                id="user-role-filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="select sm:w-48"
              >
                <option value="ALL">All roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {formatLabel(role)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="btn btn-ghost"
            >
              <Icon name="x" className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : filteredUsers.length === 0 ? (
          users.length === 0 ? (
            <EmptyState
              icon="users"
              title="No users yet"
              description="Create administrator, supervisor and maintenance staff accounts to grant access to SIMMS."
              action={
                <button type="button" onClick={openAddModal} className="btn btn-primary">
                  <Icon name="plus" className="h-4 w-4" />
                  Add user
                </button>
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title="No users found"
              description="No users match the current search or filters."
              action={
                <button type="button" onClick={clearFilters} className="btn btn-secondary">
                  Clear filters
                </button>
              }
            />
          )
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[880px]">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const isUpdating = statusUpdatingId === user.user_id;
                  const isCurrentUser =
                    currentUserId != null &&
                    String(user.user_id) === String(currentUserId);
                  const userLabel = user.name || `User ${user.user_id}`;

                  return (
                    <tr key={user.user_id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 ${
                              user.is_active
                                ? "bg-brand-50 text-brand-700 ring-brand-100"
                                : "bg-slate-100 text-slate-500 ring-slate-200"
                            }`}
                            aria-hidden="true"
                          >
                            {user.name?.charAt(0).toUpperCase() || "U"}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-semibold text-slate-900">
                              <span className="truncate">{user.name || "—"}</span>
                              {isCurrentUser && (
                                <StatusBadge tone="neutral" label="You" dot={false} size="sm" />
                              )}
                            </p>
                            <p className="num mt-0.5 text-[11px] text-slate-500">
                              ID {user.user_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="text-slate-600">{user.email || "—"}</span>
                      </td>

                      <td>
                        <RoleBadge role={user.role} />
                      </td>

                      <td>
                        <StatusBadge status={user.is_active ? "ACTIVE" : "INACTIVE"} />
                      </td>

                      <td>
                        <span className="num text-xs text-slate-600">
                          {formatDate(user.created_at)}
                        </span>
                      </td>

                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="btn btn-sm btn-secondary"
                            aria-label={`Edit ${userLabel}`}
                          >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => toggleUserStatus(user)}
                            className={`btn btn-sm min-w-[112px] ${
                              user.is_active
                                ? "btn-danger-soft"
                                : "btn-secondary text-emerald-700 hover:text-emerald-800"
                            }`}
                            aria-label={`${user.is_active ? "Deactivate" : "Activate"} ${userLabel}`}
                          >
                            {isUpdating ? (
                              <>
                                <Spinner className="h-3.5 w-3.5" />
                                Updating…
                              </>
                            ) : user.is_active ? (
                              <>
                                <Icon name="lock" className="h-3.5 w-3.5" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Icon name="checkCircle" className="h-3.5 w-3.5" />
                                Activate
                              </>
                            )}
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
      </Card>

      {/* ADD / EDIT MODAL */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingUser ? "Edit user" : "Add user"}
        description={
          editingUser
            ? `Update account details for ${editingUser.name || editingUser.email || `user ${editingUser.user_id}`}.`
            : "Create a new account and choose its access level."
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="user-form"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : editingUser ? (
                <>
                  <Icon name="save" className="h-4 w-4" />
                  Save changes
                </>
              ) : (
                <>
                  <Icon name="plus" className="h-4 w-4" />
                  Create user
                </>
              )}
            </button>
          </>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert tone="danger" onDismiss={() => setError("")}>
              {error}
            </Alert>
          )}

          {editingUser && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span className="num text-xs text-slate-500">User ID {editingUser.user_id}</span>
              <StatusBadge status={editingUser.is_active ? "ACTIVE" : "INACTIVE"} size="sm" />
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="user-name" className="label">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="user-name"
                type="text"
                name="name"
                value={userForm.name}
                onChange={handleChange}
                placeholder="Full name"
                autoComplete="off"
                aria-required="true"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="user-email" className="label">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="user-email"
                type="email"
                name="email"
                value={userForm.email}
                onChange={handleChange}
                placeholder="user@example.com"
                autoComplete="off"
                aria-required="true"
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="user-role" className="label">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              id="user-role"
              name="role"
              value={userForm.role}
              onChange={handleChange}
              aria-required="true"
              className="select"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="help-text">
              Determines which console and actions this account can access.
            </p>
          </div>

          <div>
            <label htmlFor="user-password" className="label">
              {editingUser ? (
                "New password (optional)"
              ) : (
                <>
                  Password <span className="text-red-500">*</span>
                </>
              )}
            </label>
            <div className="relative">
              <input
                id="user-password"
                type={showPassword ? "text" : "password"}
                name="password"
                value={userForm.password}
                onChange={handleChange}
                placeholder={
                  editingUser
                    ? "Leave blank to keep current password"
                    : "Enter password"
                }
                autoComplete="new-password"
                aria-required={editingUser ? undefined : "true"}
                aria-describedby={editingUser ? "user-password-help" : undefined}
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                className="btn-icon absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
              </button>
            </div>
            {editingUser && (
              <p id="user-password-help" className="help-text">
                The current password stays in place unless you enter a new one.
              </p>
            )}
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
