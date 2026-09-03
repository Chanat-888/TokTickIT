// ui-spec.md §6 / BR-26, BR-27 — client-side, pre-request attachment checks.
// Shared between AttachmentPicker (chip display) and CreateTicketForm
// (deciding what actually gets submitted).

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function hasAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Returns the message for the first check the file fails, or undefined if
// it passes both. A blank browser-reported type (some OSes omit it) is
// treated as "unknown, judge by extension only" rather than an automatic
// failure.
export function getAttachmentError(file: File): string | undefined {
  const typeOk = hasAllowedExtension(file.name) && (file.type === "" || ALLOWED_MIME_TYPES.includes(file.type));
  if (!typeOk) return "Unsupported file type";
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) return "File exceeds 5 MB";
  return undefined;
}
