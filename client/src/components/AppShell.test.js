import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "./AppShell.js";
describe("AppShell", () => {
    it("marks the My Tickets nav link active at /tickets", () => {
        render(_jsx(MemoryRouter, { initialEntries: ["/tickets"], children: _jsx(AppShell, { children: _jsx("p", { children: "content" }) }) }));
        const myTicketsLink = screen.getByRole("link", { name: "My Tickets" });
        expect(myTicketsLink).toHaveAttribute("aria-current", "page");
        expect(myTicketsLink).toHaveClass("app-shell__nav-link--active");
    });
});
