// Maps every status/severity/priority value used by the backend to a tone.
export const STATUS_TONE = {
  // Health
  EXCELLENT: "success",
  GOOD: "positive",
  NORMAL: "success",
  WARNING: "warning",
  CRITICAL: "danger",
  UNKNOWN: "neutral",

  // Tickets
  OPEN: "danger",
  ASSIGNED: "brand",
  IN_PROGRESS: "info",
  ON_HOLD: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
  REOPENED: "orange",

  // Faults
  ACTIVE: "success",
  DETECTED: "danger",
  CONFIRMED: "danger",
  ACKNOWLEDGED: "info",
  CLEARED: "success",
  FALSE_POSITIVE: "neutral",

  // Entities
  INACTIVE: "neutral",
  ONLINE: "success",
  OFFLINE: "danger",
  MAINTENANCE: "warning",
  UNDER_MAINTENANCE: "warning",
  DISABLED: "neutral",

  // Priority / severity
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "orange",
  URGENT: "danger",
};

export function formatLabel(value) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value).replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusTone(status) {
  return STATUS_TONE[String(status ?? "").toUpperCase()] || "neutral";
}
