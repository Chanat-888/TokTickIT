import { useId, useRef, useState, type FormEvent } from "react";
import { FieldValidationError, type ActionTaken, type ActionTakenFields } from "../api.js";
import { EMPTY_ACTION_FIELDS, validateActionForm, type ActionFormErrors } from "../lib/actionTakenForm.js";
import type { ActionsState } from "../lib/useActionsTaken.js";
import Field from "./Field.js";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ui-spec.md §4.3 — one form for both Create and inline Edit. Create keeps a
// single idempotencyKey until a save succeeds, so a retry after a network
// failure cannot create a duplicate (BR-13).
function ActionForm({
  mode,
  initial,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial: ActionTakenFields;
  onSubmit: (values: ActionTakenFields, idempotencyKey: string) => Promise<{ alreadySaved: boolean } | void>;
  onCancel?: () => void;
}) {
  const uid = useId();
  const [values, setValues] = useState<ActionTakenFields>(initial);
  const [errors, setErrors] = useState<ActionFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const keyRef = useRef<string>(crypto.randomUUID());

  const isCreate = mode === "create";
  const set = <K extends keyof ActionTakenFields>(key: K, value: ActionTakenFields[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;

    const found = validateActionForm(values);
    setErrors(found);
    setFormError(null);
    setNotice(null);
    if (Object.keys(found).length > 0) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      const result = await onSubmit(values, keyRef.current);
      if (isCreate) {
        keyRef.current = crypto.randomUUID();
        if (result && result.alreadySaved) {
          // The server returned an earlier save of this same submission and
          // ignored the text just sent: keep the user's entries and say so,
          // rather than clearing the form and silently dropping an edit.
          setNotice(
            "This action was already saved and is shown in the list. Your latest text was not applied; it is still in the form.",
          );
        } else {
          setValues(EMPTY_ACTION_FIELDS);
        }
      }
    } catch (err) {
      if (err instanceof FieldValidationError && err.errors.length > 0) {
        const mapped: ActionFormErrors = {};
        for (const { field, message } of err.errors) {
          mapped[field as keyof ActionTakenFields] = message;
        }
        setErrors(mapped);
      } else {
        setFormError("Couldn't save this action. Your entries are kept — please try again.");
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form
      className="action-taken-form"
      aria-label={isCreate ? "Add Action Taken" : "Edit Action Taken"}
      noValidate
      onSubmit={handleSubmit}
    >
      <Field label="Description" htmlFor={`${uid}-description`} required error={errors.description}>
        <textarea
          value={values.description}
          maxLength={2000}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <Field label="Result" htmlFor={`${uid}-result`} required error={errors.result}>
        <textarea value={values.result} maxLength={2000} onChange={(e) => set("result", e.target.value)} />
      </Field>

      <div className="field">
        <label className="action-taken-form__checkbox" htmlFor={`${uid}-followup`}>
          <input
            id={`${uid}-followup`}
            type="checkbox"
            checked={values.followUpRequired}
            onChange={(e) => set("followUpRequired", e.target.checked)}
          />
          Follow-Up Required?
        </label>
      </div>
      {values.followUpRequired && (
        <Field label="Follow-up Note" htmlFor={`${uid}-followup-note`} required error={errors.followUpNote}>
          <textarea
            value={values.followUpNote}
            maxLength={2000}
            onChange={(e) => set("followUpNote", e.target.value)}
          />
        </Field>
      )}

      <Field label="Attachment Notes" htmlFor={`${uid}-attachment-notes`} error={errors.attachmentNotes}>
        <input
          type="text"
          value={values.attachmentNotes}
          maxLength={500}
          placeholder="What file to look for, e.g. screenshot in the ticket attachments"
          onChange={(e) => set("attachmentNotes", e.target.value)}
        />
      </Field>

      {formError && <p className="field__message field__message--error" role="alert">{formError}</p>}
      {notice && <p className="action-taken-form__notice" role="status">{notice}</p>}

      <div className="action-taken-form__buttons">
        <button
          type="submit"
          className={`btn btn--primary${submitting ? " btn--busy" : ""}`}
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting && <span className="btn__spinner" aria-hidden="true" />}
          {submitting ? "Saving…" : isCreate ? "Add Action Taken" : "Save changes"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--secondary" disabled={submitting} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function toFields(a: ActionTaken): ActionTakenFields {
  return {
    description: a.description,
    result: a.result,
    followUpRequired: a.followUpRequired,
    followUpNote: a.followUpNote ?? "",
    attachmentNotes: a.attachmentNotes ?? "",
  };
}

// ui-spec.md §4.3 — Actions Taken list (oldest first, BR-12) with a Create
// form and per-row inline Edit for IT Staff/Administrator (`canEdit`); the
// Requester gets the same rows, read-only (BR-11).
export default function ActionsTakenPanel({
  items,
  state,
  canEdit,
  onRetry,
  onCreate,
  onUpdate,
}: {
  items: ActionTaken[];
  state: ActionsState;
  canEdit: boolean;
  onRetry: () => void;
  onCreate: (fields: ActionTakenFields, idempotencyKey: string) => Promise<{ alreadySaved: boolean }>;
  onUpdate: (actionId: number, fields: ActionTakenFields) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className="actions-taken-panel">
      <p className="actions-taken-panel__header">Actions Taken — visible to the Requester</p>

      {canEdit && state === "loaded" && (
        <ActionForm mode="create" initial={EMPTY_ACTION_FIELDS} onSubmit={onCreate} />
      )}

      {state === "loading" && <p>Loading actions taken…</p>}
      {state === "error" && (
        <div role="alert">
          <p className="field__message field__message--error">Couldn't load actions taken.</p>
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {state === "loaded" &&
        (items.length === 0 ? (
          <p>No actions recorded yet.</p>
        ) : (
          <ul className="actions-taken-list">
            {items.map((a) =>
              editingId === a.id ? (
                <li key={a.id} className="action-taken-entry action-taken-entry--editing">
                  <ActionForm
                    mode="edit"
                    initial={toFields(a)}
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (values) => {
                      await onUpdate(a.id, values);
                      setEditingId(null);
                    }}
                  />
                </li>
              ) : (
                <li key={a.id} className="action-taken-entry">
                  <div className="action-taken-entry__meta">
                    <span className="action-taken-entry__performer">{a.performedByName}</span>
                    <span className="action-taken-entry__timestamp">{formatDateTime(a.createdAt)}</span>
                    {a.followUpRequired && (
                      <span className="action-taken-entry__followup">Follow-up needed</span>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        className="btn btn--tertiary action-taken-entry__edit"
                        aria-label="Edit this action"
                        onClick={() => setEditingId(a.id)}
                      >
                        <span aria-hidden="true">✎ </span>Edit
                      </button>
                    )}
                  </div>
                  <p className="action-taken-entry__text">
                    <span className="action-taken-entry__label">Action</span> {a.description}
                  </p>
                  <p className="action-taken-entry__text">
                    <span className="action-taken-entry__label">Result</span> {a.result}
                  </p>
                  {a.followUpRequired && a.followUpNote && (
                    <p className="action-taken-entry__text">
                      <span className="action-taken-entry__label">Follow-up note</span> {a.followUpNote}
                    </p>
                  )}
                  {a.attachmentNotes && (
                    <p className="action-taken-entry__text">
                      <span aria-hidden="true">📎 </span>
                      <span className="action-taken-entry__label">Attachment notes</span> {a.attachmentNotes}
                    </p>
                  )}
                </li>
              ),
            )}
          </ul>
        ))}
    </div>
  );
}
