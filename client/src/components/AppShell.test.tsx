import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "./AppShell.js";

describe("AppShell", () => {
  it("marks the My Tickets nav link active at /tickets", () => {
    render(
      <MemoryRouter initialEntries={["/tickets"]}>
        <AppShell>
          <p>content</p>
        </AppShell>
      </MemoryRouter>,
    );

    const myTicketsLink = screen.getByRole("link", { name: "My Tickets" });
    expect(myTicketsLink).toHaveAttribute("aria-current", "page");
    expect(myTicketsLink).toHaveClass("app-shell__nav-link--active");
  });
});
