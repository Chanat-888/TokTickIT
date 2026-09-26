import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RequesterDashboard from "../../src/screens/RequesterDashboard.js";
import MyTickets from "../../src/screens/MyTickets.js";
import { AuthProvider } from "../../src/lib/authContext.js";

const requester = {
  id: 1,
  name: "Alex Rivera",
  email: "alex@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const summary = (id: number, status: string, text: string) => ({
  id,
  ticketNumber: `TKT-2026-00000${id}`,
  summary: text,
  status,
  updatedAt: "2026-08-03T09:00:00.000Z",
});

const DASHBOARD = {
  myOpenTickets: 3,
  waitingForRequester: 1,
  recentlyUpdated: [summary(5, "OPEN", "Printer offline"), summary(6, "RESOLVED", "Password reset")],
  recentlyResolved: [summary(6, "RESOLVED", "Password reset")],
};

const json = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function setupFetch(dashboard: () => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/me")) return json(requester);
    if (url.includes("/api/dashboard/requester")) return dashboard();
    if (url.includes("/api/categories")) return json([]);
    if (url.includes("/api/tickets")) return json({ data: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderDashboard() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<RequesterDashboard />} />
          <Route path="/tickets" element={<MyTickets />} />
          <Route path="/tickets/:id" element={<h1>Ticket Detail</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("Requester Dashboard (ui-spec.md §4.2)", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-14
  it("renders both cards, both lists, and links to My Tickets with the status query", async () => {
    setupFetch(() => json(DASHBOARD));
    renderDashboard();

    const open = await screen.findByRole("region", { name: "My Open Tickets" });
    expect(open).toHaveTextContent("3");
    expect(within(open).getByRole("link")).toHaveAttribute("href", "/tickets?status=NEW,OPEN,IN_PROGRESS,REOPENED");
    const waiting = screen.getByRole("region", { name: "Waiting for Requester" });
    expect(waiting).toHaveTextContent("1");
    expect(within(waiting).getByRole("link")).toHaveAttribute("href", "/tickets?status=WAITING_FOR_REQUESTER");

    const updated = screen.getByRole("region", { name: "Recently Updated" });
    expect(within(updated).getByText("Printer offline")).toBeInTheDocument();
    expect(within(updated).getAllByRole("link")[0]).toHaveAttribute("href", "/tickets/5");
    const resolved = screen.getByRole("region", { name: "Recently Resolved" });
    expect(within(resolved).getAllByRole("link")).toHaveLength(1);
  });

  it("zero Tickets: cards show 0 and both lists show their empty text", async () => {
    setupFetch(() => json({ myOpenTickets: 0, waitingForRequester: 0, recentlyUpdated: [], recentlyResolved: [] }));
    renderDashboard();

    expect(await screen.findByRole("region", { name: "My Open Tickets" })).toHaveTextContent("0");
    expect(screen.getByRole("region", { name: "Waiting for Requester" })).toHaveTextContent("0");
    expect(screen.getByText("No recent activity yet.")).toBeInTheDocument();
    expect(screen.getByText("No resolved tickets yet.")).toBeInTheDocument();
  });

  it("shows failure copy with a retry when the request fails", async () => {
    setupFetch(() => json({ error: "boom" }, 500));
    renderDashboard();
    expect(await screen.findByText("We couldn't load your dashboard.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("clicking a count card opens My Tickets filtered by the same statuses (BR-25)", async () => {
    const fetchMock = setupFetch(() => json(DASHBOARD));
    renderDashboard();

    await userEvent.click(await screen.findByRole("link", { name: /View all: My Open Tickets/ }));

    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    const call = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/api/tickets?"));
    expect(call).toContain(`status=${encodeURIComponent("NEW,OPEN,IN_PROGRESS,REOPENED")}`);
  });
});
