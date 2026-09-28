import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequesterDashboard from "../../../src/screens/RequesterDashboard.js";
import { AuthProvider } from "../../../src/lib/authContext.js";

const json = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function setup(dashboard: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/me")) {
        return json({
          id: 1,
          name: "Alex Rivera",
          email: "alex@example.com",
          role: "REQUESTER",
          isActive: true,
          mustChangePassword: false,
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        });
      }
      if (url.includes("/api/dashboard/requester")) return json(dashboard);
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
  return render(
    <AuthProvider>
      <MemoryRouter>
        <RequesterDashboard />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("Dashboard style rules (ui-spec.md §5, §6)", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // STYLE-01
  it("uses the metric-card classes and still renders a 0 value", async () => {
    setup({ myOpenTickets: 0, waitingForRequester: 2, recentlyUpdated: [], recentlyResolved: [] });
    await screen.findByRole("region", { name: "My Open Tickets" });

    expect(document.querySelector(".dashboard-grid")).not.toBeNull();
    const cards = document.querySelectorAll(".metric-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector(".metric-card__value")).toHaveTextContent("0");
    expect(cards[0].querySelector(".metric-card__link")).not.toBeNull();
  });

  // STYLE-02
  it("list rows are keyboard-focusable links inside a list-panel", async () => {
    setup({
      myOpenTickets: 1,
      waitingForRequester: 0,
      recentlyUpdated: [{ id: 5, ticketNumber: "TKT-2026-000005", summary: "Printer offline", status: "OPEN", updatedAt: "2026-08-03T09:00:00.000Z" }],
      recentlyResolved: [],
    });
    await screen.findByText("Printer offline");

    expect(document.querySelectorAll(".list-panel")).toHaveLength(2);
    const row = document.querySelector(".list-panel__row") as HTMLAnchorElement;
    expect(row.tagName).toBe("A");
    expect(row.getAttribute("href")).toBe("/tickets/5");
    expect(row.tabIndex).toBeGreaterThanOrEqual(0);
  });
});
