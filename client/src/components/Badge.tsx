type PriorityValue = "LOW" | "MEDIUM" | "HIGH";
type StatusValue = "NEW";

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
