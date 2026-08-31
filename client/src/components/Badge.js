import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const PRIORITY_META = {
    LOW: { icon: "↓", label: "Low" },
    MEDIUM: { icon: "–", label: "Medium" },
    HIGH: { icon: "↑", label: "High" },
};
const STATUS_META = {
    NEW: { icon: "●", label: "New" },
};
export default function Badge({ kind, value }) {
    const meta = kind === "priority"
        ? PRIORITY_META[value]
        : STATUS_META[value];
    const modifier = kind === "priority"
        ? `badge--priority-${value.toLowerCase()}`
        : `badge--status-${value.toLowerCase()}`;
    return (_jsxs("span", { className: `badge ${modifier}`, children: [_jsx("span", { "aria-hidden": "true", children: meta.icon }), meta.label] }));
}
