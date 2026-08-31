import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.js";
function SelectRequesterPlaceholder() {
    return _jsx("h1", { children: "Select Requester" });
}
function MyTicketsPlaceholder() {
    return _jsx("h1", { children: "My Tickets" });
}
function CreateTicketPlaceholder() {
    return _jsx("h1", { children: "Create Ticket" });
}
function TicketDetailPlaceholder() {
    return _jsx("h1", { children: "Ticket Detail" });
}
function NotFoundPlaceholder() {
    return _jsx("h1", { children: "Not Found" });
}
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/tickets", replace: true }) }), _jsx(Route, { path: "/select-requester", element: _jsx(SelectRequesterPlaceholder, {}) }), _jsx(Route, { path: "/tickets", element: _jsx(AppShell, { children: _jsx(MyTicketsPlaceholder, {}) }) }), _jsx(Route, { path: "/tickets/new", element: _jsx(AppShell, { children: _jsx(CreateTicketPlaceholder, {}) }) }), _jsx(Route, { path: "/tickets/:id", element: _jsx(AppShell, { children: _jsx(TicketDetailPlaceholder, {}) }) }), _jsx(Route, { path: "*", element: _jsx(AppShell, { children: _jsx(NotFoundPlaceholder, {}) }) })] }) }));
}
