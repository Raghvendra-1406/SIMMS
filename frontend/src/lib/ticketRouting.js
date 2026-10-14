// Ticket routing and response SLA (Plan v2 §9). The backend sends
// category, assigned_to(_name/_team), sla_due_at, started_at,
// escalated_at and sla_state on every ticket.

export const CATEGORY_LABELS = {
  ELECTRICAL: "Electrical",
  CLEANING: "Cleaning",
  ENERGY: "Energy",
};

export const TEAM_LABELS = {
  ELECTRICAL: "Electrical",
  HOUSEKEEPING: "Housekeeping",
  GENERAL: "General",
};

export const TEAM_OPTIONS = [
  { value: "", label: "No team (takes any work)" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "HOUSEKEEPING", label: "Housekeeping" },
  { value: "GENERAL", label: "General" },
];

export const SLA_META = {
  ON_TRACK: { tone: "success", label: "On track" },
  DUE_SOON: { tone: "warning", label: "Due soon" },
  OVERDUE: { tone: "danger", label: "Overdue" },
  MET: { tone: "neutral", label: "Responded" },
  LATE: { tone: "orange", label: "Responded late" },
};

/** "in 1 h 20 min" / "12 min ago" relative to now. */
export function formatRelative(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  const span = Math.abs(minutes);

  if (span < 1) return "now";

  const text =
    span < 60
      ? `${span} min`
      : span < 48 * 60
        ? `${Math.floor(span / 60)} h${span % 60 ? ` ${span % 60} min` : ""}`
        : `${Math.round(span / 1440)} d`;

  return minutes >= 0 ? `in ${text}` : `${text} ago`;
}

/** Open or reopened, and nobody has started it yet. */
export function canStartWork(ticket) {
  return (ticket?.status === "OPEN" || ticket?.status === "REOPENED") && !ticket?.started_at;
}
