import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAssignableUsers,
  getCategories,
  getRelatedSystems,
  getStaffTicket,
  postComment,
  postNote,
  setTicketItPriority,
  setTicketOwner,
  setTicketStatus,
  NotFoundError,
  StaleTicketError,
  StatusTransitionError,
  type AssignableUser,
  type Category,
  type Comment,
  type Priority,
  type RelatedSystem,
  type StaffTicketDetail as StaffTicketDetailData,
  type TicketStatus,
} from "../api.js";
import { useAuth } from "../lib/authContext.js";
import { allowedStatusTargets, statusRequiresConfirmation } from "../lib/statusTransitions.js";
import Badge from "../components/Badge.js";
import StateBanner from "../components/StateBanner.js";
import ActionsTakenPanel from "../components/ActionsTakenPanel.js";
import { useActionsTaken } from "../lib/useActionsTaken.js";

type LoadState = "loading" | "loaded" | "not-found" | "forbidden" | "error";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ROLE_LABEL: Record<string, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

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

// ui-spec.md §3 — Public Comments and Internal Notes share the same
// list/compose structure; only the header copy and panel color (§7
// .comment-panel--public / --internal) differ.
function CommentPanel({
  variant,
  headerText,
  items,
  draft,
  onDraftChange,
  posting,
  postError,
  onPost,
}: {
  variant: "public" | "internal";
  headerText: string;
  items: Comment[];
  draft: string;
  onDraftChange: (value: string) => void;
  posting: boolean;
  postError: string | null;
  onPost: () => void;
}) {
  return (
    <div className={`comment-panel comment-panel--${variant}`}>
      <p className="comment-panel__header">{headerText}</p>

      {items.length === 0 ? (
        <p>No {variant === "public" ? "comments" : "notes"} yet.</p>
      ) : (
        <ul className="comment-list">
          {items.map((c) => (
            <li key={c.id} className="comment-entry">
              <div className="comment-entry__meta">
                <span className="comment-entry__author">{c.authorName}</span>
                <span className="role-badge">{ROLE_LABEL[c.authorRole]}</span>
                <span className="comment-entry__timestamp">{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="comment-entry__body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="comment-compose">
        <label className="field__label" htmlFor={`${variant}-compose-body`}>
          {variant === "public" ? "Add a comment" : "Add a note"}
        </label>
        <textarea
          id={`${variant}-compose-body`}
          className="field__control"
          value={draft}
          maxLength={2000}
          onChange={(e) => onDraftChange(e.target.value)}
        />
        <p className="field__message">{draft.length}/2000</p>
        {postError && <p className="field__message field__message--error">{postError}</p>}
        <button
          type="button"
          className={`btn btn--secondary${posting ? " btn--busy" : ""}`}
          disabled={posting || draft.trim().length === 0}
          aria-busy={posting}
          onClick={onPost}
        >
          {posting && <span className="btn__spinner" aria-hidden="true" />}
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

// ui-spec.md §5.6 — opens before a Status PATCH to Cancelled/Closed is sent
// (specification.md §5); reuses the Lab 2 confirmation-panel structure
// (docs/lab-03/ui-spec.md §7 .confirm-dialog), distinct from attachment
// removal's own .attachment-remove-confirm pattern.
function StatusConfirmDialog({
  targetStatus,
  onConfirm,
  onCancel,
}: {
  targetStatus: TicketStatus;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="confirm-dialog"
      role="dialog"
      aria-label="Confirm status change"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <p>
        Change status to <strong>{STATUS_LABEL[targetStatus]}</strong>? This can't be easily undone.
      </p>
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

export default function StaffTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [ticket, setTicket] = useState<StaffTicketDetailData | null>(null);

  // BR-17: set when a Status/Owner/IT-Priority write hit a stale-write 409;
  // the controls stay disabled until the user refreshes (ui-spec.md §3).
  const [conflict, setConflict] = useState(false);

  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  const [itPrioritySaving, setItPrioritySaving] = useState(false);
  const [itPriorityError, setItPriorityError] = useState<string | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);

  const [activeTab, setActiveTab] = useState<"public" | "internal" | "actions">("public");
  const actionsTaken = useActionsTaken(Number(id));

  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [postCommentError, setPostCommentError] = useState<string | null>(null);

  const [noteDraft, setNoteDraft] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [postNoteError, setPostNoteError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
    getRelatedSystems().then(setRelatedSystems).catch(() => {});
    getAssignableUsers().then(setAssignableUsers).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoadState("loading");
    getStaffTicket(Number(id))
      .then((t) => {
        setTicket(t);
        setLoadState("loaded");
      })
      .catch((err: unknown) => {
        if (err instanceof NotFoundError) {
          setLoadState("not-found");
          return;
        }
        const status = err instanceof Error ? Number(err.message.match(/status (\d+)/)?.[1]) : undefined;
        setLoadState(status === 403 ? "forbidden" : "error");
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

  async function handleClaim() {
    if (!ticket || !user) return;
    setOwnerSaving(true);
    setOwnerError(null);
    try {
      await setTicketOwner(ticket.id, user.id, ticket.updatedAt);
      // Re-fetch rather than merge just the changed field: another staff
      // member's edit made since page load (e.g. a concurrent status
      // change) would otherwise stay stale on screen after this partial
      // update (PR #52 review).
      load();
    } catch (err) {
      if (err instanceof StaleTicketError) setConflict(true);
      else setOwnerError("Couldn't claim this Ticket. Please try again.");
    } finally {
      setOwnerSaving(false);
    }
  }

  async function handleReassign(newOwnerId: number) {
    if (!ticket) return;
    setOwnerSaving(true);
    setOwnerError(null);
    try {
      await setTicketOwner(ticket.id, newOwnerId, ticket.updatedAt);
      load();
    } catch (err) {
      if (err instanceof StaleTicketError) setConflict(true);
      else setOwnerError("Couldn't reassign this Ticket. Please try again.");
    } finally {
      setOwnerSaving(false);
    }
  }

  async function handleItPriorityChange(value: Priority) {
    if (!ticket) return;
    setItPrioritySaving(true);
    setItPriorityError(null);
    try {
      await setTicketItPriority(ticket.id, value, ticket.updatedAt);
      load();
    } catch (err) {
      if (err instanceof StaleTicketError) setConflict(true);
      else setItPriorityError("Couldn't update IT Priority. Please try again.");
    } finally {
      setItPrioritySaving(false);
    }
  }

  async function applyStatusChange(status: TicketStatus) {
    if (!ticket) return;
    setStatusSaving(true);
    setStatusError(null);
    try {
      await setTicketStatus(ticket.id, status, ticket.updatedAt);
      load();
    } catch (err) {
      if (err instanceof StaleTicketError) {
        setConflict(true);
        return;
      }
      setStatusError(
        err instanceof StatusTransitionError
          ? "That transition is no longer permitted."
          : "Couldn't update status. Please try again.",
      );
    } finally {
      setStatusSaving(false);
      setPendingStatus(null);
    }
  }

  function handleStatusSelect(value: string) {
    if (!value) return;
    const status = value as TicketStatus;
    if (statusRequiresConfirmation(status)) {
      setPendingStatus(status);
    } else {
      void applyStatusChange(status);
    }
  }

  async function handlePostComment() {
    if (!ticket || commentDraft.trim().length === 0) return;
    setPostingComment(true);
    setPostCommentError(null);
    try {
      const created = await postComment(ticket.id, commentDraft);
      setTicket((prev) => (prev ? { ...prev, comments: [...prev.comments, created] } : prev));
      setCommentDraft("");
    } catch {
      setPostCommentError("Couldn't post comment. Please try again.");
    } finally {
      setPostingComment(false);
    }
  }

  async function handlePostNote() {
    if (!ticket || noteDraft.trim().length === 0) return;
    setPostingNote(true);
    setPostNoteError(null);
    try {
      const created = await postNote(ticket.id, noteDraft);
      setTicket((prev) => (prev ? { ...prev, notes: [...prev.notes, created] } : prev));
      setNoteDraft("");
    } catch {
      setPostNoteError("Couldn't post note. Please try again.");
    } finally {
      setPostingNote(false);
    }
  }

  if (loadState === "not-found") {
    return (
      <div className="ticket-detail">
        <StateBanner variant="error">
          <h2>Ticket not found</h2>
          <p>This ticket doesn't exist.</p>
          <Link to="/staff/tickets" className="btn btn--secondary">
            Back to Ticket Queue
          </Link>
        </StateBanner>
      </div>
    );
  }

  if (loadState === "forbidden") {
    return (
      <div className="ticket-detail">
        <StateBanner variant="error">
          <p>You don't have access to this Ticket.</p>
        </StateBanner>
      </div>
    );
  }

  return (
    <div className="ticket-detail">
      <Link to="/staff/tickets" className="btn btn--tertiary ticket-detail__back-link">
        ← Back to Ticket Queue
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
        <section className="ticket-detail__header" data-testid="ticket-detail-header-skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="field__control field__control--disabled" aria-hidden="true" />
          ))}
        </section>
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

          <section className="ticket-ops-panel">
            <h2>Operations</h2>

            {conflict && (
              <div className="ticket-conflict-banner" role="alert">
                <p>This ticket was changed by someone else.</p>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setConflict(false);
                    load();
                  }}
                >
                  Refresh
                </button>
              </div>
            )}

            <div className="field">
              <span className="field__label">Owner</span>
              {ticket.ownerId === null ? (
                <button
                  type="button"
                  className={`btn btn--secondary${ownerSaving ? " btn--busy" : ""}`}
                  disabled={ownerSaving || conflict}
                  aria-busy={ownerSaving}
                  onClick={handleClaim}
                >
                  {ownerSaving && <span className="btn__spinner" aria-hidden="true" />}
                  {ownerSaving ? "Claiming…" : "Claim"}
                </button>
              ) : (
                <select
                  className="owner-select field__control"
                  aria-label="Owner"
                  value={ticket.ownerId}
                  disabled={ownerSaving || conflict}
                  onChange={(e) => handleReassign(Number(e.target.value))}
                >
                  {!assignableUsers.some((u) => u.id === ticket.ownerId) && (
                    <option value={ticket.ownerId}>{`User #${ticket.ownerId}`}</option>
                  )}
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
              {ownerError && <p className="field__message field__message--error">{ownerError}</p>}
            </div>

            <div className="field">
              <span className="field__label">IT Priority</span>
              <select
                className="field__control"
                aria-label="IT Priority"
                value={ticket.itPriority}
                disabled={itPrioritySaving || conflict}
                onChange={(e) => handleItPriorityChange(e.target.value as Priority)}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              {itPriorityError && <p className="field__message field__message--error">{itPriorityError}</p>}
            </div>

            <div className="field">
              <span className="field__label">Status</span>
              <select
                className="status-select field__control"
                aria-label="Status"
                value=""
                disabled={conflict || statusSaving || allowedStatusTargets(ticket.status).length === 0}
                onChange={(e) => handleStatusSelect(e.target.value)}
              >
                <option value="" disabled>
                  Change status…
                </option>
                {allowedStatusTargets(ticket.status).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              {statusError && <p className="field__message field__message--error">{statusError}</p>}
              {pendingStatus && (
                <StatusConfirmDialog
                  targetStatus={pendingStatus}
                  onConfirm={() => applyStatusChange(pendingStatus)}
                  onCancel={() => setPendingStatus(null)}
                />
              )}
            </div>
          </section>

          <section className="ticket-detail__attachments">
            <h2>Attachments ({ticket.attachments.filter((a) => !a.isRemoved).length} active)</h2>
            {ticket.attachments.length === 0 ? (
              <p>No attachments</p>
            ) : (
              <ul className="attachment-list">
                {ticket.attachments.map((a) => (
                  <li
                    key={a.id}
                    className={`attachment-item ${a.isRemoved ? "attachment-item--removed" : "attachment-item--active"}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-md)" }}>
                      <span className="attachment-item__name">{a.originalFilename}</span>
                      <span className="attachment-item__meta">
                        {formatSize(a.sizeBytes)} · Uploaded {formatDate(a.createdAt)}
                        {a.isRemoved && a.removedAt && (
                          <>
                            {" "}
                            · Removed {formatDate(a.removedAt)}
                            {a.removalReason ? ` — ${a.removalReason}` : ""}
                          </>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ticket-detail__comments">
            <h2>Comments, Notes and Actions Taken</h2>
            <div className="comment-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "public"}
                className={`btn ${activeTab === "public" ? "btn--primary" : "btn--tertiary"}`}
                onClick={() => setActiveTab("public")}
              >
                Public Comments
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "internal"}
                className={`btn ${activeTab === "internal" ? "btn--primary" : "btn--tertiary"}`}
                onClick={() => setActiveTab("internal")}
              >
                Internal Notes
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "actions"}
                className={`btn ${activeTab === "actions" ? "btn--primary" : "btn--tertiary"}`}
                onClick={() => setActiveTab("actions")}
              >
                {actionsTaken.state === "loaded" ? `Actions Taken (${actionsTaken.items.length})` : "Actions Taken"}
              </button>
            </div>

            {activeTab === "public" ? (
              <CommentPanel
                variant="public"
                headerText="Public Comments — visible to the Requester"
                items={ticket.comments}
                draft={commentDraft}
                onDraftChange={setCommentDraft}
                posting={postingComment}
                postError={postCommentError}
                onPost={handlePostComment}
              />
            ) : activeTab === "actions" ? (
              <ActionsTakenPanel
                items={actionsTaken.items}
                state={actionsTaken.state}
                canEdit
                onRetry={actionsTaken.reload}
                onCreate={actionsTaken.create}
                onUpdate={actionsTaken.update}
              />
            ) : (
              <CommentPanel
                variant="internal"
                headerText="Internal Notes — visible to IT Staff and Administrators only"
                items={ticket.notes}
                draft={noteDraft}
                onDraftChange={setNoteDraft}
                posting={postingNote}
                postError={postNoteError}
                onPost={handlePostNote}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
