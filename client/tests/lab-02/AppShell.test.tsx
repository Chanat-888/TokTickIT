import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AppShell from "../../src/components/AppShell.js";
import { AuthProvider } from "../../src/lib/authContext.js";

const defaultUser = {
  id: 1,
  name: "Alex Rivera",
  email: "alex@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function setupFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/auth/me")) return jsonResponse(defaultUser);
    if (url.includes("/auth/logout")) return jsonResponse({ success: true });
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderShell(initialPath = "/tickets") {
  return render(
    <AuthProvider>
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
          <Route path="/login" element={<h1>Login</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("AppShell", () => {
  // UI-33
  it("marks the My Tickets nav link active at /tickets", async () => {
    setupFetch();
    renderShell();

    const myTicketsLink = await screen.findByRole("link", { name: "My Tickets" });
    expect(myTicketsLink).toHaveAttribute("aria-current", "page");
    expect(myTicketsLink).toHaveClass("app-shell__nav-link--active");
  });

  it("Logout ends the session and routes to Login", async () => {
    setupFetch();
    renderShell();

    await userEvent.click(await screen.findByRole("button", { name: "Logout" }));

    expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument();
  });
});
