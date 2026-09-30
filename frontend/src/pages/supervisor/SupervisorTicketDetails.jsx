import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  DetailItem,
  EmptyState,
  IconTile,
  RefreshButton,
  StatusBadge,
} from "../../components/ui";
import { formatLabel, formatConfidence } from "../../lib/format";
import { navigateTo } from "../../lib/session";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
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

function getFaultTypeLabel(faultType) {
  const labels = {
    FAN_FAILURE: "Fan failure",
    LIGHTS_LEFT_ON: "Lights left on",
    ELECTRICAL_ABNORMALITY:
      "Electrical abnormality",
  };

  return (
    labels[faultType] ||
    String(faultType || "Unknown").replaceAll(
      "_",
      " "
    )
  );
}

function getHistoryActionLabel(action) {
  if (!action) {
    return "Ticket updated";
  }

  return String(action)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function DetailsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">
        Loading ticket details…
      </span>

      <div className="card p-5">
        <div className="flex items-start gap-4">
          <span className="skeleton h-11 w-11 rounded-xl" />

          <div className="flex-1 space-y-3">
            <span className="skeleton block h-5 w-40" />
            <span className="skeleton block h-3 w-64" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="card p-5">
              <span className="skeleton block h-4 w-32" />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((__, cell) => (
                  <div key={cell} className="space-y-2">
                    <span className="skeleton block h-3 w-20" />
                    <span className="skeleton block h-4 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5">
          <span className="skeleton block h-4 w-28" />

          <div className="mt-5 space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="skeleton block h-12 w-full"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupervisorTicketDetails() {
  const [ticket, setTicket] = useState(null);

  const [fault, setFault] = useState(null);

  const [classroom, setClassroom] = useState(null);

  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);

  const [verifying, setVerifying] = useState(false);

  const [verificationResult, setVerificationResult] =
    useState(null);

  const [error, setError] = useState("");

  const ticketId =
    window.location.pathname.split("/").pop();

  useEffect(() => {
    if (ticketId) {
      loadTicketDetails();
    } else {
      setError("Invalid ticket ID.");
      setLoading(false);
    }
  }, [ticketId]);

  async function fetchApi(endpoint) {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      let message =
        `Request failed with status ${response.status}.`;

      try {
        const data = await response.json();

        if (data?.detail) {
          message = data.detail;
        }
      } catch {
        // Keep default error.
      }

      throw new Error(message);
    }

    return response.json();
  }

  function normalizeListResponse(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (
      data &&
      Array.isArray(data.data)
    ) {
      return data.data;
    }

    return [];
  }

  async function loadTicketDetails() {
    setLoading(true);
    setError("");

    try {
      const ticketData =
        await fetchApi(
          `/tickets/${ticketId}`
        );

      setTicket(
        ticketData?.data &&
          !Array.isArray(
            ticketData.data
          )
          ? ticketData.data
          : ticketData
      );

      const actualTicket =
        ticketData?.data &&
          !Array.isArray(
            ticketData.data
          )
          ? ticketData.data
          : ticketData;

      /*
       * Load related fault.
       */
      if (actualTicket?.fault_id) {
        try {
          const faultData =
            await fetchApi(
              `/faults/${actualTicket.fault_id}`
            );

          setFault(
            faultData?.data &&
              !Array.isArray(
                faultData.data
              )
              ? faultData.data
              : faultData
          );

          const actualFault =
            faultData?.data &&
              !Array.isArray(
                faultData.data
              )
              ? faultData.data
              : faultData;

          /*
           * Load classroom from the fault's
           * room_id.
           */
          if (actualFault?.room_id) {
            try {
              const classroomData =
                await fetchApi(
                  `/classrooms/${actualFault.room_id}`
                );

              setClassroom(
                classroomData?.data &&
                  !Array.isArray(
                    classroomData.data
                  )
                  ? classroomData.data
                  : classroomData
              );
            } catch {
              setClassroom(null);
            }
          }
        } catch {
          setFault(null);
        }
      }

      /*
       * Ticket history is useful for the
       * operational timeline.
       */
      try {
        const historyData =
          await fetchApi(
            `/ticket-history/ticket/${ticketId}`
          );

        setHistory(
          normalizeListResponse(
            historyData
          )
        );
      } catch {
        /*
         * Keep the main ticket page usable
         * if history is unavailable.
         */
        setHistory([]);
      }
    } catch (err) {
      setError(
        err.message ||
        "Unable to load ticket details."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * POST-REPAIR VERIFICATION
   * ---------------------------------------------------------
   *
   * The verification API processes one latest sensor
   * observation per call.
   *
   * Endpoint:
   * POST /verification/ticket/{ticket_id}
   *
   * No request body is required.
   */
  async function handlePostRepairVerification() {
    console.log("=== START VERIFICATION CLICKED ===");
    console.log("Ticket object:", ticket);
    console.log("Ticket ID:", ticket?.ticket_id);
    console.log("Ticket status:", ticket?.status);

    if (!ticket?.ticket_id) {
      console.error("NO TICKET ID - verification stopped");
      return;
    }

    setVerifying(true);
    setError("");
    setVerificationResult(null);

    console.log(
      "Calling:",
      `${API_BASE_URL}/verification/ticket/${ticket.ticket_id}`
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/verification/ticket/${ticket.ticket_id}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      console.log("Verification HTTP status:", response.status);
      console.log("Verification response OK:", response.ok);

      let data = null;

      try {
        data = await response.json();
        console.log("Verification response data:", data);
      } catch {
        console.log("Verification response had no JSON body");
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            `Verification failed with status ${response.status}.`
        );
      }

      console.log("=== VERIFICATION SUCCESS ===");

      setVerificationResult(data);

      await loadTicketDetails();
    } catch (err) {
      console.error("=== VERIFICATION ERROR ===", err);

      setError(
        err.message ||
          "Unable to perform post-repair verification."
      );
    } finally {
      setVerifying(false);
      console.log("=== VERIFICATION FINISHED ===");
    }
  }
  
  const lifecycle = ticket
    ? [
        {
          key: "created",
          label: "Created",
          value: ticket.created_at,
          icon: "plus",
        },
        {
          key: "resolved",
          label: "Resolved",
          value: ticket.resolved_at,
          icon: "checkCircle",
        },
        {
          key: "closed",
          label: "Closed",
          value: ticket.closed_at,
          icon: "lock",
        },
      ]
    : [];

  return (
    <AppShell
      eyebrow="Tickets"
      title={
        ticket
          ? `Ticket #${ticket.ticket_id}`
          : "Ticket details"
      }
      backHref="/supervisor/tickets"
      actions={
        <RefreshButton
          onClick={loadTicketDetails}
          loading={loading}
        />
      }
    >
      {loading ? (
        <DetailsSkeleton />
      ) : error ? (
        <Alert
          tone="danger"
          title="Unable to load ticket"
          onRetry={loadTicketDetails}
        >
          {error}
        </Alert>
      ) : ticket ? (
        <>
          {/* Summary header */}
          <section className="card p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <IconTile
                  icon="ticket"
                  tone="brand"
                  className="h-11 w-11"
                />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="num text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      Ticket #{ticket.ticket_id}
                    </h2>

                    <StatusBadge
                      status={ticket.status}
                      label={
                        ticket.status
                          ? undefined
                          : "Unknown"
                      }
                    />

                    <StatusBadge
                      status={ticket.priority}
                      label={
                        ticket.priority
                          ? `${formatLabel(ticket.priority)} priority`
                          : "No priority"
                      }
                      dot={false}
                    />
                  </div>

                  <p className="mt-1.5 text-sm text-slate-500">
                    Maintenance ticket generated from a classroom fault
                  </p>

                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Icon
                        name="alert"
                        className="h-3.5 w-3.5"
                      />

                      <span className="num">
                        Fault #{ticket.fault_id ?? "—"}
                      </span>
                    </span>

                    <span className="flex items-center gap-1">
                      <Icon
                        name="clock"
                        className="h-3.5 w-3.5"
                      />

                      <span className="num">
                        {formatDateTime(
                          ticket.created_at
                        )}
                      </span>
                    </span>
                  </p>
                </div>
              </div>

              {fault && (
                <button
                  type="button"
                  onClick={() =>
                    navigateTo(
                      `/supervisor/faults/${fault.fault_id}`
                    )
                  }
                  className="btn btn-secondary self-start"
                >
                  View related fault

                  <Icon
                    name="arrowRight"
                    className="h-4 w-4"
                  />
                </button>
              )}
            </div>
          </section>

          {/* -------------------------------------------------
              POST-REPAIR VERIFICATION
          ------------------------------------------------- */}

          {(ticket.status === "RESOLVED" ||
            verificationResult) && (
            <section className="mt-6">
              <Card
                title="Post-repair verification"
                subtitle="Confirm that the fault has actually been repaired before closing this ticket."
                icon="checkCircle"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Maintenance has marked this ticket as resolved.
                    </p>

                    <p className="mt-1 text-sm leading-relaxed text-slate-500">
                      Start verification to evaluate the latest
                      sensor reading. Five verification observations
                      are used to determine whether the repair passes
                      or the ticket must be reopened.
                    </p>
                  </div>

                  {/* IMPORTANT:
                      Only show the button while the ticket
                      is RESOLVED and there is no current result.
                  */}
                  {ticket.status === "RESOLVED" &&
                    !verificationResult && (
                      <button
                        type="button"
                        onClick={
                          handlePostRepairVerification
                        }
                        disabled={verifying}
                        className="btn btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {verifying
                          ? "Verifying..."
                          : "Start verification"}

                        {!verifying && (
                          <Icon
                            name="checkCircle"
                            className="h-4 w-4"
                          />
                        )}
                      </button>
                    )}
                </div>

                {verificationResult && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        Verification result
                      </span>

                      {verificationResult.status && (
                        <StatusBadge
                          status={
                            verificationResult.status
                          }
                          size="sm"
                        />
                      )}
                    </div>

                    {verificationResult.status ===
                      "VERIFICATION_IN_PROGRESS" && (
                      <p className="mt-2 text-sm text-slate-600">
                        Verification is in progress.
                        Continue providing sensor
                        observations and run verification
                        again.
                      </p>
                    )}

                    {verificationResult.status ===
                      "CLOSED" && (
                      <p className="mt-2 text-sm text-emerald-700">
                        Post-repair verification passed.
                        The ticket has been closed automatically.
                      </p>
                    )}

                    {verificationResult.status ===
                      "REOPENED" && (
                      <p className="mt-2 text-sm text-red-700">
                        The fault persisted during
                        verification. The ticket has been
                        reopened.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </section>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {/* Main column */}
            <div className="min-w-0 space-y-6">
              <Card
                title="Ticket details"
                icon="clipboard"
              >
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <DetailItem
                    label="Ticket ID"
                    mono
                  >
                    {ticket.ticket_id ?? "—"}
                  </DetailItem>

                  <DetailItem
                    label="Fault ID"
                    mono
                  >
                    {ticket.fault_id ?? "—"}
                  </DetailItem>

                  <DetailItem label="Priority">
                    {ticket.priority ? (
                      <StatusBadge
                        status={ticket.priority}
                        dot={false}
                        size="sm"
                      />
                    ) : (
                      "—"
                    )}
                  </DetailItem>

                  <DetailItem label="Status">
                    {ticket.status ? (
                      <StatusBadge
                        status={ticket.status}
                        size="sm"
                      />
                    ) : (
                      "—"
                    )}
                  </DetailItem>
                </dl>
              </Card>

              <Card
                title="Fault context"
                subtitle="Source fault that generated this ticket"
                icon="alert"
                actions={
                  fault && (
                    <StatusBadge
                      status={fault.status}
                      label={
                        fault.status
                          ? undefined
                          : "Unknown"
                      }
                      size="sm"
                    />
                  )
                }
              >
                {fault ? (
                  <>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone="danger"
                        label={getFaultTypeLabel(
                          fault.fault_type
                        )}
                      />

                      <span className="num text-xs text-slate-500">
                        Fault #{fault.fault_id}
                      </span>
                    </div>

                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      <DetailItem label="Classroom">
                        {classroom?.room_name ||
                          `Room ${fault.room_id}`}
                      </DetailItem>

                      <DetailItem label="Device">
                        {fault.device_id
                          ? `Device #${fault.device_id}`
                          : "Room-level"}
                      </DetailItem>

                      <DetailItem
                        label="Confidence"
                        mono
                      >
                        {formatConfidence(
                          fault.confidence
                        )}
                      </DetailItem>

                      <DetailItem
                        label="Abnormal count"
                        mono
                      >
                        {fault.abnormal_count ??
                          "—"}
                      </DetailItem>

                      <DetailItem
                        label="Detected"
                        mono
                      >
                        {formatDateTime(
                          fault.detected_at
                        )}
                      </DetailItem>

                      <DetailItem
                        label="Confirmed"
                        mono
                      >
                        {formatDateTime(
                          fault.confirmed_at
                        )}
                      </DetailItem>
                    </dl>
                  </>
                ) : (
                  <Alert
                    tone="warning"
                    title="Fault information is unavailable"
                  >
                    The ticket still references{" "}
                    <span className="num">
                      Fault #{ticket.fault_id ?? "—"}
                    </span>
                    .
                  </Alert>
                )}
              </Card>

              <Card
                title="Classroom"
                subtitle="Location of the fault"
                icon="classroom"
              >
                {classroom ? (
                  <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    <DetailItem label="Room name">
                      {classroom.room_name || "—"}
                    </DetailItem>

                    <DetailItem label="Room type">
                      {classroom.room_type
                        ? formatLabel(
                            classroom.room_type
                          )
                        : "—"}
                    </DetailItem>

                    <DetailItem label="Building">
                      {classroom.building || "—"}
                    </DetailItem>

                    <DetailItem
                      label="Floor"
                      mono
                    >
                      {classroom.floor ?? "—"}
                    </DetailItem>

                    <DetailItem
                      label="Capacity"
                      mono
                    >
                      {classroom.capacity ?? "—"}
                    </DetailItem>

                    <DetailItem label="Status">
                      {classroom.status ? (
                        <StatusBadge
                          status={classroom.status}
                          size="sm"
                        />
                      ) : (
                        "—"
                      )}
                    </DetailItem>
                  </dl>
                ) : (
                  <EmptyState
                    icon="classroom"
                    title="Classroom information is unavailable"
                    description={
                      fault?.room_id
                        ? `The fault belongs to Room #${fault.room_id}.`
                        : undefined
                    }
                    className="py-8"
                  />
                )}
              </Card>

              <Card
                title="Maintenance notes"
                icon="wrench"
              >
                {ticket.maintenance_notes ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {ticket.maintenance_notes}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    No maintenance notes have been recorded.
                  </p>
                )}
              </Card>
            </div>

            {/* Side column */}
            <div className="min-w-0 space-y-6">
              <Card
                title="Lifecycle"
                subtitle="Key ticket milestones"
                icon="clock"
              >
                <ol className="relative ml-1.5 border-l border-slate-200">
                  {lifecycle.map((step) => {
                    const reached =
                      Boolean(step.value);

                    return (
                      <li
                        key={step.key}
                        className="relative pb-5 pl-6 last:pb-0"
                      >
                        <span
                          className={`absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${
                            reached
                              ? "bg-brand-600"
                              : "border-2 border-slate-300 bg-white"
                          }`}
                          aria-hidden="true"
                        />

                        <p
                          className={`text-sm font-semibold ${
                            reached
                              ? "text-slate-900"
                              : "text-slate-500"
                          }`}
                        >
                          {step.label}
                        </p>

                        <p className="num mt-0.5 text-xs text-slate-500">
                          {reached
                            ? formatDateTime(
                                step.value
                              )
                            : "Not yet"}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </Card>

              <Card
                title="Ticket history"
                subtitle="Activity recorded on this ticket"
                icon="history"
                actions={
                  history.length > 0 && (
                    <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {history.length}
                    </span>
                  )
                }
              >
                {history.length === 0 ? (
                  <EmptyState
                    icon="history"
                    title="No history yet"
                    description="No ticket history records are available."
                    className="py-8"
                  />
                ) : (
                  <ol className="relative ml-1.5 border-l border-slate-200">
                    {history.map(
                      (entry, index) => (
                        <li
                          key={
                            entry.history_id ??
                            entry.id ??
                            index
                          }
                          className="relative pb-6 pl-6 last:pb-0"
                        >
                          <span
                            className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full bg-brand-600 ring-4 ring-white"
                            aria-hidden="true"
                          />

                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {getHistoryActionLabel(
                                entry.action ||
                                  entry.action_type ||
                                  entry.status
                              )}
                            </p>

                            {entry.status && (
                              <StatusBadge
                                status={
                                  entry.status
                                }
                                size="sm"
                              />
                            )}
                          </div>

                          <p className="num mt-0.5 text-xs text-slate-500">
                            {formatDateTime(
                              entry.created_at ||
                                entry.changed_at ||
                                entry.timestamp
                            )}
                          </p>

                          {entry.notes && (
                            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600 ring-1 ring-slate-100">
                              {entry.notes}
                            </p>
                          )}

                          {entry.changed_by && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                              <Icon
                                name="user"
                                className="h-3.5 w-3.5"
                              />

                              Updated by{" "}
                              <span className="font-medium text-slate-700">
                                {entry.changed_by}
                              </span>
                            </p>
                          )}
                        </li>
                      )
                    )}
                  </ol>
                )}
              </Card>

              <Alert
                tone="info"
                title="Supervisor view"
              >
                This page provides operational visibility into
                the maintenance ticket, its source fault and
                the ticket history. Physical maintenance actions
                remain part of the maintenance workflow.
              </Alert>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
