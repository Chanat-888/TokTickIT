import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface ListPanelRow {
  key: number;
  to: string;
  primary: string;
  badge?: ReactNode;
  timestamp: string;
}

interface ListPanelProps {
  title: string;
  rows: ListPanelRow[];
  emptyText: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ui-spec.md §5.2 — up to 5 rows, each one a single link so the whole row
// is clickable and keyboard-focusable; empty state is one line of text.
export default function ListPanel({ title, rows, emptyText }: ListPanelProps) {
  return (
    <section className="list-panel" aria-label={title}>
      <h2 className="list-panel__title">{title}</h2>
      {rows.length === 0 ? (
        <p className="list-panel__empty">{emptyText}</p>
      ) : (
        <ul className="list-panel__rows">
          {rows.map((row) => (
            <li key={row.key}>
              <Link className="list-panel__row" to={row.to}>
                <span className="list-panel__primary">{row.primary}</span>
                {row.badge}
                <span className="list-panel__time">{formatWhen(row.timestamp)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
