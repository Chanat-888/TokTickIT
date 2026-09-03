import type { ReactNode } from "react";

type StateBannerVariant =
  | "loading"
  | "empty"
  | "no-results"
  | "error"
  | "success"
  | "warning";

interface StateBannerProps {
  variant: StateBannerVariant;
  children: ReactNode;
}

// Icon-plus-text per ui-spec.md §9: never colour alone.
const ICONS: Record<StateBannerVariant, string> = {
  loading: "ℹ",
  empty: "📥",
  "no-results": "🔍",
  error: "⚠",
  success: "✓",
  warning: "⚠",
};

export default function StateBanner({ variant, children }: StateBannerProps) {
  return (
    <div
      className={`state-banner state-banner--${variant}`}
      role={variant === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span aria-hidden="true">{ICONS[variant]}</span>
      <div>{children}</div>
    </div>
  );
}
