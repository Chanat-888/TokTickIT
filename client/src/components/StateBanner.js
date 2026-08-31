import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Icon-plus-text per ui-spec.md §9: never colour alone.
const ICONS = {
    loading: "ℹ",
    empty: "📥",
    "no-results": "🔍",
    error: "⚠",
    success: "✓",
    warning: "⚠",
};
export default function StateBanner({ variant, children }) {
    return (_jsxs("div", { className: `state-banner state-banner--${variant}`, role: variant === "error" ? "alert" : "status", "aria-live": "polite", children: [_jsx("span", { "aria-hidden": "true", children: ICONS[variant] }), _jsx("div", { children: children })] }));
}
