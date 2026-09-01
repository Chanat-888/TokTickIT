import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createTicket,
  getCategories,
  getRelatedSystems,
  uploadAttachments,
  type Category,
  type Priority,
  type RelatedSystem,
  type Ticket,
} from "../api.js";
import { useRequester } from "../lib/requesterContext.js";
import { getAttachmentError } from "../lib/attachmentValidation.js";
import Field from "../components/Field.js";
import AttachmentPicker from "../components/AttachmentPicker.js";
import StateBanner from "../components/StateBanner.js";

type ScreenState = "form" | "submitting" | "error";

function validate(
  categoryId: string,
  relatedSystemId: string,
  summary: string,
  description: string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!categoryId) errors.categoryId = "Category is required";
  if (!relatedSystemId) errors.relatedSystemId = "Related System is required";

  const trimmedSummary = summary.trim();
  if (trimmedSummary.length === 0) {
    errors.summary = "Summary is required";
  } else if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
    errors.summary = "Summary must be between 5 and 120 characters";
  }

  const trimmedDescription = description.trim();
  if (trimmedDescription.length === 0) {
    errors.description = "Description is required";
  } else if (trimmedDescription.length < 10 || trimmedDescription.length > 2000) {
    errors.description = "Description must be between 10 and 2000 characters";
  }

  return errors;
}

export default function CreateTicketForm() {
  const { requester } = useRequester();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState(false);

  // BR-11/BR-13, ui-spec.md §12: a fresh key per mount, and again after a
  // successful submit so creating another Ticket without navigating away
  // doesn't replay the previous one.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // BR-13: React state alone can't block a click that lands before the next
  // render; this ref makes the guard synchronous.
  const submittingRef = useRef(false);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
    getRelatedSystems()
      .then(setRelatedSystems)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;

    const errors = validate(categoryId, relatedSystemId, summary, description);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    submittingRef.current = true;
    setFieldErrors({});
    setScreenState("submitting");

    try {
      const result = await createTicket(
        {
          categoryId: Number(categoryId),
          relatedSystemId: Number(relatedSystemId),
          summary,
          description,
          requestedPriority: priority,
        },
        idempotencyKey,
      );

      if (result.status === 400) {
        const errs: Record<string, string> = {};
        for (const fieldError of result.errors) errs[fieldError.field] = fieldError.message;
        setFieldErrors(errs);
        setScreenState("form");
        submittingRef.current = false;
        return;
      }

      const ticket = result.ticket;
      setCreatedTicket(ticket);

      const validFiles = files.filter((file) => !getAttachmentError(file));
      if (validFiles.length > 0) {
        try {
          await uploadAttachments(ticket.id, validFiles);
          setAttachmentWarning(false);
        } catch {
          setAttachmentWarning(true);
        }
      } else {
        setAttachmentWarning(false);
      }

      setSummary("");
      setDescription("");
      setFiles([]);
      setIdempotencyKey(crypto.randomUUID());
      setScreenState("form");
      submittingRef.current = false;
    } catch {
      setScreenState("error");
      submittingRef.current = false;
    }
  }

  const ticketNumberDisplay = createdTicket ? createdTicket.ticketNumber : "Generated after creation";
  const ticketDateDisplay = createdTicket
    ? new Date(createdTicket.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString();

  return (
    <div className="create-ticket">
      <h1>Create Ticket</h1>

      {createdTicket && (
        <StateBanner variant="success">
          <p>
            Ticket {createdTicket.ticketNumber} created.{" "}
            <Link to={`/tickets/${createdTicket.id}`}>View Ticket</Link>
          </p>
        </StateBanner>
      )}

      {createdTicket && attachmentWarning && (
        <StateBanner variant="warning">
          <p>
            Some attachments couldn't be uploaded — add them from{" "}
            <Link to={`/tickets/${createdTicket.id}`}>Ticket Detail</Link>.
          </p>
        </StateBanner>
      )}

      {screenState === "error" && (
        <StateBanner variant="error">
          <p>Couldn't create the Ticket. Please try again.</p>
        </StateBanner>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="create-ticket__readonly-row">
          <Field label="Ticket Number" htmlFor="ticket-number" readOnly>
            <input type="text" value={ticketNumberDisplay} readOnly />
          </Field>
          <Field label="Ticket Date" htmlFor="ticket-date" readOnly>
            <input type="text" value={ticketDateDisplay} readOnly />
          </Field>
          <Field label="Requester" htmlFor="ticket-requester" readOnly>
            <input type="text" value={requester?.name ?? ""} readOnly />
          </Field>
        </div>

        <div className="create-ticket__classification-row">
          <Field
            label="Category"
            htmlFor="ticket-category"
            required
            error={fieldErrors.categoryId}
          >
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select a Category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Related System"
            htmlFor="ticket-related-system"
            required
            error={fieldErrors.relatedSystemId}
          >
            <select value={relatedSystemId} onChange={(e) => setRelatedSystemId(e.target.value)}>
              <option value="">Select a Related System…</option>
              {relatedSystems.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Requested Priority" htmlFor="ticket-priority" required>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </Field>
        </div>

        <Field label="Summary" htmlFor="ticket-summary" required error={fieldErrors.summary}>
          <input type="text" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>

        <Field
          label="Description"
          htmlFor="ticket-description"
          required
          error={fieldErrors.description}
        >
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        <AttachmentPicker files={files} onChange={setFiles} />

        <div className="create-ticket__actions">
          <button
            type="submit"
            className={`btn btn--primary${screenState === "submitting" ? " btn--busy" : ""}`}
            disabled={screenState === "submitting"}
            aria-busy={screenState === "submitting"}
          >
            {screenState === "submitting" && <span className="btn__spinner" aria-hidden="true" />}
            {screenState === "submitting" ? "Submitting…" : "Submit"}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate("/tickets")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
