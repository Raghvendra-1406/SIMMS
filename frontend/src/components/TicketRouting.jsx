import Icon from "./Icon";
import { StatusBadge } from "./ui";
import { SLA_META, TEAM_LABELS, formatRelative } from "../lib/ticketRouting";

const DUE_STATES = new Set(["ON_TRACK", "DUE_SOON", "OVERDUE"]);

/** SLA state pill; open tickets also show when the response is due. */
export function SlaBadge({ ticket, size = "sm", showDue = true }) {
  const meta = SLA_META[ticket?.sla_state];
  if (!meta) return null;

  const due = showDue && DUE_STATES.has(ticket.sla_state) ? ` · due ${formatRelative(ticket.sla_due_at)}` : "";

  return <StatusBadge tone={meta.tone} label={`${meta.label}${due}`} size={size} />;
}

/** "Ravi · Electrical" or "Unassigned". */
export function AssigneeLabel({ ticket, className = "" }) {
  if (!ticket?.assigned_to) {
    return <span className={`text-slate-500 ${className}`}>Unassigned</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon name="user" className="h-3.5 w-3.5 text-slate-400" />
      <span className="font-medium text-slate-800">{ticket.assigned_to_name}</span>
      {ticket.assigned_to_team && (
        <span className="text-slate-500">· {TEAM_LABELS[ticket.assigned_to_team] || ticket.assigned_to_team}</span>
      )}
    </span>
  );
}
