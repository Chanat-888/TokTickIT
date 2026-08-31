import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { getAttachmentError } from "../lib/attachmentValidation.js";

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
}

const MAX_ATTACHMENTS = 5;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ui-spec.md §6, §19 — the pre-upload picker used on Create Ticket (and,
// later, Ticket Detail's Add Attachment). Client-side checks are a
// convenience only; the server's checks (api-spec.md §7) are authoritative.
export default function AttachmentPicker({ files, onChange }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [batchError, setBatchError] = useState<string | undefined>();

  function addFiles(newFiles: File[]) {
    if (newFiles.length === 0) return;
    // BR-28/BR-29: more than 5 selected at once, or adding would push the
    // total over 5 — the newest addition is rejected wholesale.
    if (files.length + newFiles.length > MAX_ATTACHMENTS) {
      setBatchError("Up to 5 attachments allowed");
      return;
    }
    setBatchError(undefined);
    onChange([...files, ...newFiles]);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    addFiles(Array.from(e.dataTransfer.files));
  }

  function handleRemove(index: number) {
    setBatchError(undefined);
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="attachment-picker">
      <div
        className="attachment-picker__dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <p>Drag files here, or</p>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => inputRef.current?.click()}
        >
          Add Files
        </button>
        <input
          ref={inputRef}
          type="file"
          aria-label="Attachments"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          multiple
          hidden
          onChange={handleInputChange}
        />
      </div>

      {batchError && <p className="attachment-picker__error">{batchError}</p>}

      {files.length > 0 && (
        <ul>
          {files.map((file, index) => {
            const error = getAttachmentError(file);
            return (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className={`attachment-picker__chip${error ? " attachment-picker__chip--invalid" : ""}`}
              >
                <span className="attachment-picker__chip-name">{file.name}</span>
                <span className="attachment-picker__chip-size">{formatSize(file.size)}</span>
                {error && <span className="attachment-picker__chip-message">{error}</span>}
                <button
                  type="button"
                  className="attachment-picker__chip-remove"
                  aria-label={`Remove ${file.name}`}
                  title={`Remove ${file.name}`}
                  onClick={() => handleRemove(index)}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
