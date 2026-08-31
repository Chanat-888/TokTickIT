import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  readOnly?: boolean;
  children: ReactNode;
}

// ui-spec.md §3, §4, §19 — shared field wrapper: label + required marker +
// the control (cloned so it gets the shared field__control styling and its
// id/aria wiring) + an error message beneath the control, never only at the
// top of the form.
export default function Field({
  label,
  htmlFor,
  required = false,
  error,
  readOnly = false,
  children,
}: FieldProps) {
  const messageId = `${htmlFor}-message`;
  const hasError = Boolean(error);

  const controlClassName = [
    "field__control",
    readOnly ? "field__control--readonly" : "",
    hasError ? "field__control--invalid" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ className?: string }>, {
        id: htmlFor,
        className: [controlClassName, (children as ReactElement<{ className?: string }>).props.className]
          .filter(Boolean)
          .join(" "),
        "aria-invalid": hasError ? "true" : undefined,
        "aria-describedby": hasError ? messageId : undefined,
      } as Partial<{ className?: string }> & Record<string, unknown>)
    : children;

  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="field__required-marker">*</span>}
      </label>
      {control}
      {hasError && (
        <p id={messageId} className="field__message field__message--error" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}
