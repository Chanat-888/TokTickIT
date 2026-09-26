// docs/lab-04/specification.md BR-05/BR-06/BR-07 — client-side mirror of the
// server's Action Taken rules, so obvious mistakes are caught before a request.
// The server stays authoritative.

import type { ActionTakenFields } from "../api.js";

export type ActionFormErrors = Partial<Record<keyof ActionTakenFields, string>>;

export const EMPTY_ACTION_FIELDS: ActionTakenFields = {
  description: "",
  result: "",
  followUpRequired: false,
  followUpNote: "",
  attachmentNotes: "",
};

export function validateActionForm(values: ActionTakenFields): ActionFormErrors {
  const errors: ActionFormErrors = {};
  if (values.description.trim().length === 0) errors.description = "Description cannot be empty";
  else if (values.description.length > 2000) errors.description = "Description must be 2000 characters or fewer";

  if (values.result.trim().length === 0) errors.result = "Result cannot be empty";
  else if (values.result.length > 2000) errors.result = "Result must be 2000 characters or fewer";

  if (values.followUpRequired) {
    if (values.followUpNote.trim().length === 0) {
      errors.followUpNote = "Follow-up Note is required when Follow-Up Required is checked";
    } else if (values.followUpNote.length > 2000) {
      errors.followUpNote = "Follow-up Note must be 2000 characters or fewer";
    }
  }

  if (values.attachmentNotes.length > 500) errors.attachmentNotes = "Attachment Notes must be 500 characters or fewer";
  return errors;
}
