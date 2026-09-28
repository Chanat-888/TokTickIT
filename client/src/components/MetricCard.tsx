import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface MetricCardProps {
  label: string;
  // Always rendered, including 0 — a card is never hidden (ui-spec.md §5.1).
  value?: number;
  // BR-25 drill-down target; when set the whole card is clickable.
  to?: string;
  linkLabel?: string;
  children?: ReactNode;
}

// ui-spec.md §5.1 — the stretched "View all" link makes the entire card the
// click target while keeping one real, focusable anchor for keyboard users.
export default function MetricCard({ label, value, to, linkLabel = "View all", children }: MetricCardProps) {
  return (
    <section className={`metric-card${to ? " metric-card--clickable" : ""}`} aria-label={label}>
      <h2 className="metric-card__label">{label}</h2>
      {value !== undefined && <p className="metric-card__value">{value}</p>}
      {children}
      {to && (
        <Link className="metric-card__link" to={to} aria-label={`${linkLabel}: ${label}`}>
          {linkLabel}
        </Link>
      )}
    </section>
  );
}
