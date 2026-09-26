import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "../../src/components/AppShell.js";
import StaffDashboard from "../../src/screens/StaffDashboard.js";
import StaffTicketQueue from "../../src/screens/StaffTicketQueue.js";
import { AuthProvider } from "../../src/lib/authContext.js";
import App from "../../src/App.js";

const userOf = (role: string) => ({
  id: 9,
  name: "Jordan Blake",
  email: "jordan@example.com",
  role,
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
});

const DASHBOARD = {
  unassigned: 2,
  myAssigned: 1,
  byStatus: {
    NEW: 2,
    OPEN: 1,
    IN_PROGRESS: 0,
    WAITING_FOR_REQUESTER: 0,
    RESOLVED: 3,
    CLOSED: 0,
    REOPENED: 0,
    CANCELLED: 0,
  },
  recentlyUpdated: [
    { id: 4, ticketNumber: "TKT-2026-000004", summary: "VPN drops hourly", status: "OPEN", updatedAt: "2026-08-03T09:00:00.000Z" },
  ],
  myRecentActionsTaken: [
    { id: 7, ticketId: 4, ticketNumber: "TKT-2026-000004", description: "Reset the VPN profile", createdAt: "2026-08-03T10:00:00.000Z" },
  ],
  accounts: null as null | Record<string, number>,
};

const EMPTY = {
  ...DASHBOARD,
  unassigned: 0,
  myAssigned: 0,
  byStatus: Object.fromEntries(Object.keys(DASHBOARD.byStatus).map((k) => [k, 0])),
  recentlyUpdated: [],
  myRecentActionsTaken: [],
};

const json = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function setupFetch(role: string, dashboard: () => Response) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/me")) return json(userOf(role));
    if (url.includes("/api/dashboard/staff")) return dashboard();
    if (url.includes("/api/categories")) return json([]);
    if (url.includes("/api/staff/assignable-users")) return json({ data: [] });
    if (url.includes("/api/staff/tickets")) return json({ data: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderDashboard() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AppShell>
                <StaffDashboard />
              </AppShell>
            }
          />
          <Route path="/staff/tickets" element={<><LocationProbe /><StaffTicketQueue /></>} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("IT Staff Dashboard (ui-spec.md §4.1)", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-10
  it("renders Unassigned, My Assigned, By Status chips, Recently Updated and My Recent Actions Taken", async () => {
    setupFetch("IT_STAFF", () => json(DASHBOARD));
    renderDashboard();

    expect(await screen.findByRole("region", { name: "Unassigned" })).toHaveTextContent("2");
    expect(screen.getByRole("region", { name: "My Assigned" })).toHaveTextContent("1");
    const byStatus = screen.getByRole("region", { name: "By Status" });
    expect(within(byStatus).getAllByRole("link")).toHaveLength(8);
    expect(within(byStatus).getByRole("link", { name: "Resolved: 3" })).toBeInTheDocument();

    const updated = screen.getByRole("region", { name: "Recently Updated" });
    expect(within(updated).getByText("VPN drops hourly")).toBeInTheDocument();
    expect(within(updated).getByText("Open")).toBeInTheDocument();
    const actions = screen.getByRole("region", { name: "My Recent Actions Taken" });
    expect(within(actions).getByText(/Reset the VPN profile/)).toBeInTheDocument();
    expect(within(actions).getByRole("link")).toHaveAttribute("href", "/staff/tickets/4");
  });

  // UI-11
  it("zero state keeps every card visible with 0 and shows the defined empty text", async () => {
    setupFetch("IT_STAFF", () => json(EMPTY));
    renderDashboard();

    expect(await screen.findByRole("region", { name: "Unassigned" })).toHaveTextContent("0");
    expect(screen.getByRole("region", { name: "My Assigned" })).toHaveTextContent("0");
    expect(screen.getByText("No recent activity yet.")).toBeInTheDocument();
    expect(screen.getByText("No actions recorded yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a loading state, then forbidden and failure copy", async () => {
    let release!: (r: Response) => void;
    setupFetch("IT_STAFF", () => new Promise<Response>((r) => (release = r)) as unknown as Response);
    const { unmount } = renderDashboard();
    expect(await screen.findByText("Loading your dashboard…")).toBeInTheDocument();
    release(json(DASHBOARD));
    expect(await screen.findByRole("region", { name: "Unassigned" })).toBeInTheDocument();
    unmount();

    setupFetch("IT_STAFF", () => json({ error: "Forbidden" }, 403));
    const forbidden = renderDashboard();
    expect(await screen.findByText("You don't have access to the dashboard.")).toBeInTheDocument();
    forbidden.unmount();

    setupFetch("IT_STAFF", () => json({ error: "boom" }, 500));
    renderDashboard();
    expect(await screen.findByText("We couldn't load your dashboard.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  // UI-12
  it("count card drill-down links match the api-spec.md §3.1 table", async () => {
    setupFetch("IT_STAFF", () => json(DASHBOARD));
    renderDashboard();

    const active = "NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,RESOLVED,REOPENED";
    const unassigned = await screen.findByRole("region", { name: "Unassigned" });
    expect(within(unassigned).getByRole("link")).toHaveAttribute("href", `/staff/tickets?ownerId=unassigned&status=${active}`);
    expect(within(screen.getByRole("region", { name: "My Assigned" })).getByRole("link")).toHaveAttribute(
      "href",
      `/staff/tickets?ownerId=9&status=${active}`,
    );
    expect(screen.getByRole("link", { name: "Resolved: 3" })).toHaveAttribute("href", "/staff/tickets?status=RESOLVED");
  });

  it("clicking Unassigned opens the Queue with the same filter applied (BR-25)", async () => {
    const fetchMock = setupFetch("IT_STAFF", () => json(DASHBOARD));
    renderDashboard();

    await userEvent.click(await screen.findByRole("link", { name: /View all: Unassigned/ }));

    expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
    const queueCall = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/api/staff/tickets?"));
    expect(queueCall).toContain("ownerId=unassigned");
    expect(queueCall).toContain(`status=${encodeURIComponent("NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,RESOLVED,REOPENED")}`);
    expect(screen.getByLabelText("Owner")).toHaveValue("unassigned");
  });

  // UI-13
  it("shows the Accounts card for an Administrator only", async () => {
    setupFetch("ADMINISTRATOR", () => json({ ...DASHBOARD, accounts: { REQUESTER: 4, IT_STAFF: 3, ADMINISTRATOR: 1 } }));
    const admin = renderDashboard();
    const accounts = await screen.findByRole("region", { name: "Accounts" });
    expect(within(accounts).getByRole("link", { name: "IT Staff: 3" })).toHaveAttribute("href", "/admin/users?role=IT_STAFF");
    admin.unmount();

    setupFetch("IT_STAFF", () => json(DASHBOARD));
    renderDashboard();
    await screen.findByRole("region", { name: "Unassigned" });
    expect(screen.queryByRole("region", { name: "Accounts" })).toBeNull();
  });

  // UI-15
  it("has an active Dashboard nav entry", async () => {
    setupFetch("IT_STAFF", () => json(DASHBOARD));
    renderDashboard();
    await screen.findByRole("region", { name: "Unassigned" });
    const nav = screen.getByRole("link", { name: "Dashboard" });
    expect(nav).toHaveClass("app-shell__nav-link--active");
  });

  // UI-15 — the Dashboard is the post-login landing screen ("/" redirects to it)
  it("lands on the Dashboard at the root route", async () => {
    setupFetch("IT_STAFF", () => json(DASHBOARD));
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Welcome back, Jordan Blake" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/dashboard");
    expect(await screen.findByRole("region", { name: "Unassigned" })).toBeInTheDocument();
  });
});
