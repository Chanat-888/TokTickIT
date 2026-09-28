// docs/lab-04/specification.md BR-05/BR-06/BR-07 — pure field validation for
// Actions Taken, shared by create (POST) and update (PATCH, on merged state).

export type ActionInput = {
  description?: unknown;
  result?: unknown;
  followUpRequired?: unknown;
  followUpNote?: unknown;
  attachmentNotes?: unknown;
};

export type ActionFields = {
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

export type FieldError = { field: string; message: string };

const TEXT_MAX = 2000;
const ATTACHMENT_NOTES_MAX = 500;

function requiredText(raw: unknown, label: string): { value?: string; message?: string } {
  if (typeof raw !== "string" || raw.trim().length === 0) return { message: `${label} cannot be empty` };
  if (raw.length > TEXT_MAX) return { message: `${label} must be ${TEXT_MAX} characters or fewer` };
  return { value: raw.trim() };
}

export function validateActionFields(input: ActionInput): { errors: FieldError[]; value?: ActionFields } {
  const errors: FieldError[] = [];

  const description = requiredText(input.description, "Description");
  if (description.message) errors.push({ field: "description", message: description.message });

  const result = requiredText(input.result, "Result");
  if (result.message) errors.push({ field: "result", message: result.message });

  let followUpRequired = false;
  if (input.followUpRequired !== undefined) {
    if (typeof input.followUpRequired !== "boolean") {
      errors.push({ field: "followUpRequired", message: "Follow-Up Required must be true or false" });
    } else {
      followUpRequired = input.followUpRequired;
    }
  }

  let followUpNote: string | null = null;
  if (followUpRequired) {
    const raw = input.followUpNote;
    if (typeof raw !== "string" || raw.trim().length === 0) {
      errors.push({ field: "followUpNote", message: "Follow-up Note is required when Follow-Up Required is checked" });
    } else if (raw.length > TEXT_MAX) {
      errors.push({ field: "followUpNote", message: `Follow-up Note must be ${TEXT_MAX} characters or fewer` });
    } else {
      followUpNote = raw.trim();
    }
  }

  let attachmentNotes: string | null = null;
  const rawNotes = input.attachmentNotes;
  if (rawNotes !== undefined && rawNotes !== null) {
    if (typeof rawNotes !== "string") {
      errors.push({ field: "attachmentNotes", message: "Attachment Notes must be text" });
    } else if (rawNotes.length > ATTACHMENT_NOTES_MAX) {
      errors.push({
        field: "attachmentNotes",
        message: `Attachment Notes must be ${ATTACHMENT_NOTES_MAX} characters or fewer`,
      });
    } else {
      attachmentNotes = rawNotes.trim().length > 0 ? rawNotes.trim() : null;
    }
  }

  if (errors.length > 0) return { errors };
  return {
    errors,
    value: {
      description: description.value!,
      result: result.value!,
      followUpRequired,
      followUpNote,
      attachmentNotes,
    },
  };
}
