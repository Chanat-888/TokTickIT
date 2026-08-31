import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { NavLink } from "react-router-dom";
export default function AppShell({ children }) {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const navLinkClassName = ({ isActive }) => `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`;
    return (_jsxs("div", { className: `app-shell${mobileNavOpen ? " app-shell--nav-open" : ""}`, children: [_jsxs("header", { className: "app-shell__header", children: [_jsx("span", { children: "TokTickIT" }), _jsxs("nav", { className: "app-shell__nav", "aria-label": "Primary", children: [_jsx(NavLink, { to: "/tickets", end: true, className: navLinkClassName, children: "My Tickets" }), _jsx(NavLink, { to: "/tickets/new", className: navLinkClassName, children: "Create Ticket" })] }), _jsx("span", { className: "app-shell__requester", children: "Requester Name" }), _jsx("button", { type: "button", className: "btn btn--secondary app-shell__change-requester-btn", children: "Change Requester" }), _jsx("button", { type: "button", className: "app-shell__mobile-toggle", "aria-label": mobileNavOpen ? "Close navigation menu" : "Open navigation menu", title: mobileNavOpen ? "Close navigation menu" : "Open navigation menu", "aria-expanded": mobileNavOpen, onClick: () => setMobileNavOpen((open) => !open), children: "\u2630" })] }), _jsx("main", { children: children })] }));
}
