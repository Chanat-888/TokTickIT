type PriorityValue = "LOW" | "MEDIUM" | "HIGH";
// docs/lab-03/specification.md §5 — the full status set a Ticket can now
// reach; a Requester's own Ticket can show any of these once IT Staff acts
// on it, even though Lab 3's Requester screens can't set anything but NEW.
type StatusValue =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

interface BadgeProps {
  kind: "priority" | "status";
  value: PriorityValue | StatusValue;
}

const PRIORITY_META: Record<PriorityValue, { icon: string; label: string }> = {
  LOW: { icon: "↓", label: "Low" },
  MEDIUM: { icon: "–", label: "Medium" },
  HIGH: { icon: "↑", label: "High" },
};

const STATUS_META: Record<StatusValue, { icon: string; label: string }> = {
  NEW: { icon: "●", label: "New" },
  OPEN: { icon: "○", label: "Open" },
  IN_PROGRESS: { icon: "◐", label: "In Progress" },
  WAITING_FOR_REQUESTER: { icon: "…", label: "Waiting for Requester" },
  RESOLVED: { icon: "✓", label: "Resolved" },
  CLOSED: { icon: "✔", label: "Closed" },
  REOPENED: { icon: "↺", label: "Reopened" },
  CANCELLED: { icon: "✕", label: "Cancelled" },
};

export default function Badge({ kind, value }: BadgeProps) {
  const meta =
    kind === "priority"
      ? PRIORITY_META[value as PriorityValue]
      : STATUS_META[value as StatusValue];
  const modifier =
    kind === "priority"
      ? `badge--priority-${value.toLowerCase()}`
      : `badge--status-${value.toLowerCase()}`;

  return (
    <span className={`badge ${modifier}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
