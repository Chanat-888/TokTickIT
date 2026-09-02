import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlreadyRemovedError,
  downloadAttachmentUrl,
  getAttachment,
  getCategories,
  getRelatedSystems,
  getTicket,
  removeAttachment,
  uploadAttachments,
  NotFoundError,
  type Attachment,
  type Category,
  type RelatedSystem,
  type TicketDetail as TicketDetailData,
} from "../api.js";
import { getAttachmentError } from "../lib/attachmentValidation.js";
import AttachmentPicker from "../components/AttachmentPicker.js";
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

// ui-spec.md §17, §19 — the confirmation panel opened by an active row's
// Remove button (BR-34, §5 Destructive tier).
function AttachmentRemoveConfirm({
  reason,
  onReasonChange,
  error,
  onConfirm,
  onCancel,
}: {
  reason: string;
  onReasonChange: (value: string) => void;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    reasonInputRef.current?.focus();
  }, []);

  return (
    <div
      className="attachment-remove-confirm"
      role="dialog"
      aria-label="Remove attachment"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <label className="field__label" htmlFor="attachment-remove-reason">
        Reason (optional)
      </label>
      <textarea
        ref={reasonInputRef}
        id="attachment-remove-reason"
        className="field__control"
        value={reason}
        maxLength={200}
        onChange={(e) => onReasonChange(e.target.value)}
      />
      <p className="field__message">{reason.length}/200</p>
      {error && <p className="field__message field__message--error">{error}</p>}
      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
        <button type="button" className="btn btn--destructive" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function AttachmentRow({
  attachment,
  ticketId,
  disabled,
  unavailableMessage,
  onOpenAttachment,
  onRemoveClick,
  confirmOpen,
  removeReason,
  onRemoveReasonChange,
  removeError,
  onConfirmRemove,
  onCancelRemove,
}: {
  attachment: Attachment;
  ticketId: number;
  disabled: boolean;
  unavailableMessage?: string;
  onOpenAttachment: (
    e: MouseEvent<HTMLAnchorElement>,
    attachment: Attachment,
    mode: "preview" | "download",
  ) => void;
  onRemoveClick: (e: MouseEvent<HTMLButtonElement>, attachmentId: number) => void;
  confirmOpen: boolean;
  removeReason: string;
  onRemoveReasonChange: (value: string) => void;
  removeError: string | null;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}) {
  const href = downloadAttachmentUrl(ticketId, attachment.id);

  return (
    <li
      className={`attachment-item ${attachment.isRemoved ? "attachment-item--removed" : "attachment-item--active"}${disabled ? " attachment-item--unavailable" : ""}`}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-md)" }}>
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

        {!attachment.isRemoved && (
          <span style={{ display: "flex", gap: "var(--space-sm)" }}>
            <a
              className="btn btn--tertiary attachment-item__preview-btn"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={disabled}
              onClick={(e) => onOpenAttachment(e, attachment, "preview")}
            >
              Preview
            </a>
            <a
              className="btn btn--tertiary attachment-item__download-btn"
              href={href}
              download={attachment.originalFilename}
              aria-disabled={disabled}
              onClick={(e) => onOpenAttachment(e, attachment, "download")}
            >
              Download
            </a>
            <button
              type="button"
              className="btn btn--destructive attachment-item__remove-btn"
              onClick={(e) => onRemoveClick(e, attachment.id)}
            >
              Remove
            </button>
          </span>
        )}
      </div>

      {unavailableMessage && (
        <p className="field__message field__message--error" role="alert">
          {unavailableMessage}
        </p>
      )}

      {confirmOpen && (
        <AttachmentRemoveConfirm
          reason={removeReason}
          onReasonChange={onRemoveReasonChange}
          error={removeError}
          onConfirm={onConfirmRemove}
          onCancel={onCancelRemove}
        />
      )}
    </li>
  );
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);

  // ui-spec.md §17 — "Unavailable" state: a Preview/Download click that
  // discovers the attachment was removed since page load.
  const [unavailableMessages, setUnavailableMessages] = useState<Record<number, string>>({});
  const [disabledAttachmentIds, setDisabledAttachmentIds] = useState<Set<number>>(new Set());

  // ui-spec.md §17/§19 — remove confirmation panel (BR-34).
  const [removingAttachmentId, setRemovingAttachmentId] = useState<number | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const removeButtonRef = useRef<HTMLButtonElement | null>(null);

  // ui-spec.md §16.2 — "Add Attachment" picker.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFiles, setPickerFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
        // A fresh Ticket fetch supersedes any stale per-row UI state from
        // before the refetch (removed/uploaded attachments have new rows).
        setUnavailableMessages({});
        setDisabledAttachmentIds(new Set());
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

  // ui-spec.md §17 "Unavailable" — a plain <a> click can't be undone once
  // the browser navigates, so the click is always intercepted; the metadata
  // endpoint (api-spec.md §8) is checked first, and only when it confirms
  // the attachment is still active does this trigger the real navigation.
  async function handleOpenAttachment(
    e: MouseEvent<HTMLAnchorElement>,
    attachment: Attachment,
    mode: "preview" | "download",
  ) {
    e.preventDefault();
    if (!ticket || disabledAttachmentIds.has(attachment.id)) return;

    try {
      const meta = await getAttachment(ticket.id, attachment.id);
      if (meta.isRemoved) {
        setUnavailableMessages((prev) => ({
          ...prev,
          [attachment.id]: "This attachment is no longer available.",
        }));
        setDisabledAttachmentIds((prev) => new Set(prev).add(attachment.id));
        window.setTimeout(() => {
          setUnavailableMessages((prev) => {
            if (!(attachment.id in prev)) return prev;
            const next = { ...prev };
            delete next[attachment.id];
            return next;
          });
        }, 4000);
        return;
      }
    } catch {
      // The pre-check itself failed (e.g. network error) — fall through and
      // let the real download endpoint be the source of truth.
    }

    const url = downloadAttachmentUrl(ticket.id, attachment.id);
    if (mode === "preview") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.originalFilename;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  function openRemoveConfirm(e: MouseEvent<HTMLButtonElement>, attachmentId: number) {
    removeButtonRef.current = e.currentTarget;
    setRemovingAttachmentId(attachmentId);
    setRemoveReason("");
    setRemoveError(null);
  }

  function closeRemoveConfirm() {
    setRemovingAttachmentId(null);
    setRemoveReason("");
    setRemoveError(null);
    removeButtonRef.current?.focus();
  }

  async function handleConfirmRemove() {
    if (!ticket || removingAttachmentId === null) return;
    const reasonValue = removeReason.length > 0 ? removeReason : undefined;
    try {
      await removeAttachment(ticket.id, removingAttachmentId, reasonValue);
      setRemovingAttachmentId(null);
      setRemoveReason("");
      setRemoveError(null);
      // BR-39: removal also changed the Ticket's updatedAt, so the whole
      // Ticket is refetched rather than splicing local state.
      load();
    } catch (err) {
      setRemoveError(
        err instanceof AlreadyRemovedError
          ? "This attachment has already been removed."
          : "Couldn't remove the attachment. Please try again.",
      );
    }
  }

  function openPicker() {
    setPickerOpen(true);
    setUploadError(null);
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerFiles([]);
    setUploadError(null);
  }

  async function handleUpload() {
    if (!ticket) return;
    const validFiles = pickerFiles.filter((file) => !getAttachmentError(file));
    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      await uploadAttachments(ticket.id, validFiles);
      setPickerOpen(false);
      setPickerFiles([]);
      load();
    } catch {
      // ui-spec.md §7 "Attachment actions" — keep the picker's selection so
      // the Requester can retry without reselecting.
      setUploadError("Couldn't upload attachments. Please try again.");
    } finally {
      setUploading(false);
    }
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
  const hasValidPickerFile = pickerFiles.some((file) => !getAttachmentError(file));

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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2>Attachments ({activeCount} active)</h2>
              <button type="button" className="btn btn--secondary" onClick={openPicker}>
                Add Attachment
              </button>
            </div>

            {uploadError && <p className="field__message field__message--error">{uploadError}</p>}

            {pickerOpen && (
              <div>
                <AttachmentPicker files={pickerFiles} onChange={setPickerFiles} />
                <div style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                  <button
                    type="button"
                    className={`btn btn--secondary${uploading ? " btn--busy" : ""}`}
                    disabled={uploading || !hasValidPickerFile}
                    aria-busy={uploading}
                    onClick={handleUpload}
                  >
                    {uploading && <span className="btn__spinner" aria-hidden="true" />}
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={closePicker}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {ticket.attachments.length === 0 ? (
              <p>No attachments</p>
            ) : (
              <ul className="attachment-list">
                {ticket.attachments.map((a) => (
                  <AttachmentRow
                    key={a.id}
                    attachment={a}
                    ticketId={ticket.id}
                    disabled={disabledAttachmentIds.has(a.id)}
                    unavailableMessage={unavailableMessages[a.id]}
                    onOpenAttachment={handleOpenAttachment}
                    onRemoveClick={openRemoveConfirm}
                    confirmOpen={removingAttachmentId === a.id}
                    removeReason={removeReason}
                    onRemoveReasonChange={setRemoveReason}
                    removeError={removingAttachmentId === a.id ? removeError : null}
                    onConfirmRemove={handleConfirmRemove}
                    onCancelRemove={closeRemoveConfirm}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
