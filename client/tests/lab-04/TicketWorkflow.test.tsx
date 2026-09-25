import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../src/screens/StaffTicketDetail.js";
import { AuthProvider } from "../../src/lib/authContext.js";

const staffUser = {
  id: 9,
  name: "Jordan Blake",
  email: "jordan@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const TOKEN = "2026-08-02T00:00:00.000Z";
const NEWER_TOKEN = "2026-08-03T09:30:00.000Z";

const baseTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 1,
  summary: "Laptop won't power on",
  description: "Screen stays black after the firmware update finished overnight.",
  requestedPriority: "HIGH",
  itPriority: "MEDIUM",
  status: "IN_PROGRESS",
  ownerId: 9,
  requesterIndicatedResolvedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: TOKEN,
  attachments: [],
  comments: [],
  notes: [],
};

const json = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

const STALE_BODY = (current: unknown) => ({
  error: "This ticket was changed by someone else. Refresh and try again.",
  current,
});

// `writeResponse` answers PATCH/POST writes; `getTicket` answers detail fetches
// and can be swapped mid-test to simulate the server state moving on.
function setupFetch(options: {
  getTicket?: () => Record<string, unknown>;
  writeResponse?: (url: string, body: Record<string, unknown>) => Response;
}) {
  const state = { getTicket: options.getTicket ?? (() => baseTicket) };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.includes("/auth/me")) return json(staffUser);
    if (url.includes("/api/categories")) return json([{ id: 1, name: "Hardware" }]);
    if (url.includes("/api/related-systems")) return json([{ id: 1, name: "Email" }]);
    if (url.includes("/api/staff/assignable-users")) {
      return json({ data: [{ id: 9, name: "Jordan Blake", role: "IT_STAFF" }, { id: 20, name: "Robin Park", role: "ADMINISTRATOR" }] });
    }
    if (url.match(/\/api\/staff\/tickets\/\d+$/) && method === "GET") return json(state.getTicket());
    if (method !== "GET") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return options.writeResponse ? options.writeResponse(url, body) : json({ ...baseTicket, ...body });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, state };
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/staff/tickets/1"]}>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const writeCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method && (init as RequestInit).method !== "GET");

describe("Ticket workflow controls (BR-15, BR-17)", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-07
  it("a stale-write 409 shows the inline conflict banner and disables the controls; Refresh reloads and re-enables them", async () => {
    let served: Record<string, unknown> = baseTicket;
    const { fetchMock } = setupFetch({
      getTicket: () => served,
      writeResponse: () => {
        served = { ...baseTicket, status: "WAITING_FOR_REQUESTER", updatedAt: NEWER_TOKEN };
        return json(STALE_BODY(served), 409);
      },
    });
    renderScreen();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "RESOLVED");

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveClass("ticket-conflict-banner");
    expect(banner).toHaveTextContent("This ticket was changed by someone else.");
    expect(screen.getByLabelText("Status")).toBeDisabled();
    expect(screen.getByLabelText("IT Priority")).toBeDisabled();
    expect(screen.getByLabelText("Owner")).toBeDisabled();
    // Distinct from the illegal-transition copy.
    expect(screen.queryByText("That transition is no longer permitted.")).not.toBeInTheDocument();

    const getsBefore = fetchMock.mock.calls.filter(([u, i]) => String(u).match(/\/tickets\/1$/) && !(i as RequestInit | undefined)?.method).length;
    await userEvent.click(within(banner).getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const getsAfter = fetchMock.mock.calls.filter(([u, i]) => String(u).match(/\/tickets\/1$/) && !(i as RequestInit | undefined)?.method).length;
    expect(getsAfter).toBe(getsBefore + 1);
    expect(await screen.findByLabelText("Status")).toBeEnabled();
    expect(screen.getByLabelText("IT Priority")).toBeEnabled();
  });

  it("the same conflict banner appears for an owner or IT-priority write", async () => {
    setupFetch({ writeResponse: () => json(STALE_BODY({ ...baseTicket, updatedAt: NEWER_TOKEN }), 409) });
    renderScreen();

    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "HIGH");
    expect(await screen.findByRole("alert")).toHaveClass("ticket-conflict-banner");
  });

  it("an illegal-transition 409 keeps its own message and does not show the conflict banner", async () => {
    setupFetch({ writeResponse: () => json({ error: "Status transition not permitted" }, 409) });
    renderScreen();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "RESOLVED");

    expect(await screen.findByText("That transition is no longer permitted.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // UI-08
  it("Status offers only legal targets; Closed and Cancelled ask for confirmation before any request", async () => {
    const { fetchMock } = setupFetch({ getTicket: () => ({ ...baseTicket, status: "RESOLVED" }) });
    renderScreen();

    const select = await screen.findByLabelText("Status");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);
    expect(options).toEqual(["Change status…", "Closed", "Reopened"]);

    await userEvent.selectOptions(select, "CLOSED");
    expect(await screen.findByRole("dialog", { name: "Confirm status change" })).toBeInTheDocument();
    expect(writeCalls(fetchMock)).toHaveLength(0);
  });

  // UI-09
  it("Claim, IT Priority and Status writes each send the last-fetched updatedAt as expectedUpdatedAt", async () => {
    const { fetchMock } = setupFetch({ getTicket: () => ({ ...baseTicket, ownerId: null }) });
    renderScreen();

    await userEvent.click(await screen.findByRole("button", { name: "Claim" }));
    await waitFor(() => expect(writeCalls(fetchMock)).toHaveLength(1));
    await userEvent.selectOptions(await screen.findByLabelText("IT Priority"), "HIGH");
    await waitFor(() => expect(writeCalls(fetchMock)).toHaveLength(2));
    await userEvent.selectOptions(await screen.findByLabelText("Status"), "WAITING_FOR_REQUESTER");
    await waitFor(() => expect(writeCalls(fetchMock)).toHaveLength(3));

    for (const [, init] of writeCalls(fetchMock)) {
      expect(JSON.parse(String((init as RequestInit).body)).expectedUpdatedAt).toBe(TOKEN);
    }
  });

  it("after a successful status change the summary status is refreshed from the server", async () => {
    let served: Record<string, unknown> = baseTicket;
    setupFetch({
      getTicket: () => served,
      writeResponse: () => {
        served = { ...baseTicket, status: "WAITING_FOR_REQUESTER", updatedAt: NEWER_TOKEN };
        return json(served);
      },
    });
    renderScreen();

    await userEvent.selectOptions(await screen.findByLabelText("Status"), "WAITING_FOR_REQUESTER");

    await waitFor(() => {
      const header = document.querySelector(".ticket-detail__header") as HTMLElement;
      expect(within(header).getByText("Waiting for Requester")).toBeInTheDocument();
    });
  });
});
