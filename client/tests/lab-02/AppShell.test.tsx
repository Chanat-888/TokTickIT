import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppShell from "../../src/components/AppShell.js";
import {
  RequesterProvider,
  getSelectedRequester,
  setSelectedRequester,
} from "../../src/lib/requesterContext.js";

function renderShell(initialPath = "/tickets") {
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/tickets"
            element={
              <AppShell>
                <p>content</p>
              </AppShell>
            }
          />
          <Route path="/select-requester" element={<h1>Select Requester</h1>} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  // UI-33
  it("marks the My Tickets nav link active at /tickets", () => {
    renderShell();

    const myTicketsLink = screen.getByRole("link", { name: "My Tickets" });
    expect(myTicketsLink).toHaveAttribute("aria-current", "page");
    expect(myTicketsLink).toHaveClass("app-shell__nav-link--active");
  });

  // UI-34
  it("Change Requester clears sessionStorage and routes to Requester Selection with no confirmation", async () => {
    setSelectedRequester({ id: 1, name: "Alex Rivera" });
    renderShell();

    await userEvent.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(getSelectedRequester()).toBeNull();
    expect(await screen.findByRole("heading", { name: "Select Requester" })).toBeInTheDocument();
  });
});
