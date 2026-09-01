import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getCategories,
  getRelatedSystems,
  getTicket,
  NotFoundError,
  type Attachment,
  type Category,
  type RelatedSystem,
  type TicketDetail as TicketDetailData,
} from "../api.js";
import Badge from "../components/Badge.js";
import StateBanner from "../components/StateBanner.js";

type LoadState = "loading" | "loaded" | "not-found" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TextField({
  label,
  value,
  fullWidth,
  wrap,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : undefined}>
      <span className="field__label">{label}</span>
      <div
        className="field__control field__control--readonly"
        style={wrap ? { height: "auto", whiteSpace: "pre-wrap" } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function BadgeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function AttachmentRow({ attachment }: { attachment: Attachment }) {
  return (
    <li
      className={`attachment-item ${attachment.isRemoved ? "attachment-item--removed" : "attachment-item--active"}`}
    >
      <span className="attachment-item__name">{attachment.originalFilename}</span>
      <span className="attachment-item__meta">
        {formatSize(attachment.sizeBytes)} · Uploaded {formatDate(attachment.createdAt)}
        {attachment.isRemoved && attachment.removedAt && (
          <>
            {" "}
            · Removed {formatDate(attachment.removedAt)}
            {attachment.removalReason ? ` — ${attachment.removalReason}` : ""}
          </>
        )}
      </span>
    </li>
  );
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
    getRelatedSystems()
      .then(setRelatedSystems)
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoadState("loading");
    getTicket(Number(id))
      .then((t) => {
        setTicket(t);
        setLoadState("loaded");
      })
      .catch((err) => {
        setLoadState(err instanceof NotFoundError ? "not-found" : "error");
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function categoryName(categoryId: number): string {
    return categories.find((c) => c.id === categoryId)?.name ?? String(categoryId);
  }

  function relatedSystemName(relatedSystemId: number): string {
    return relatedSystems.find((r) => r.id === relatedSystemId)?.name ?? String(relatedSystemId);
  }

  // BR-10/BR-36: worded identically whether the Ticket doesn't exist or
  // belongs to someone else — there is nothing to detect, so nothing to
  // branch on here.
  if (loadState === "not-found") {
    return (
      <div className="ticket-detail">
        <StateBanner variant="error">
          <h2>Ticket not found</h2>
          <p>This ticket doesn't exist, or isn't available to you.</p>
          <Link to="/tickets" className="btn btn--secondary">
            Back to My Tickets
          </Link>
        </StateBanner>
      </div>
    );
  }

  const activeCount = ticket ? ticket.attachments.filter((a) => !a.isRemoved).length : 0;

  return (
    <div className="ticket-detail">
      <Link to="/tickets" className="btn btn--tertiary ticket-detail__back-link">
        ← Back to My Tickets
      </Link>

      {loadState === "error" && (
        <StateBanner variant="error">
          <p>Couldn't load Ticket.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </StateBanner>
      )}

      {loadState === "loading" && (
        <>
          <section className="ticket-detail__header" data-testid="ticket-detail-header-skeleton">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="field__control field__control--disabled" aria-hidden="true" />
            ))}
          </section>
          <section className="ticket-detail__attachments" data-testid="ticket-detail-attachments-skeleton">
            <div className="field__control field__control--disabled" aria-hidden="true" />
          </section>
        </>
      )}

      {loadState === "loaded" && ticket && (
        <>
          <section className="ticket-detail__header">
            <TextField label="Ticket Number" value={ticket.ticketNumber} />
            <TextField label="Created Date" value={formatDate(ticket.createdAt)} />
            <TextField label="Category" value={categoryName(ticket.categoryId)} />
            <TextField label="Related System" value={relatedSystemName(ticket.relatedSystemId)} />
            <BadgeField label="Requested Priority">
              <Badge kind="priority" value={ticket.requestedPriority} />
            </BadgeField>
            <BadgeField label="Current Status">
              <Badge kind="status" value={ticket.status} />
            </BadgeField>
            <TextField label="Summary" value={ticket.summary} fullWidth />
            <TextField label="Description" value={ticket.description} fullWidth wrap />
          </section>

          <section className="ticket-detail__attachments">
            <h2>Attachments ({activeCount} active)</h2>
            {ticket.attachments.length === 0 ? (
              <p>No attachments</p>
            ) : (
              <ul className="attachment-list">
                {ticket.attachments.map((a) => (
                  <AttachmentRow key={a.id} attachment={a} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
