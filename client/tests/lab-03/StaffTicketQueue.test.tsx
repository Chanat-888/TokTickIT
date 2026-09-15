import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketQueue from "../../src/screens/StaffTicketQueue.js";
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
  status: "OPEN",
  ownerId: null,
  requesterIndicatedResolvedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
};

function makeResult(overrides: Record<string, unknown> = {}) {
  return {
    data: [baseTicket],
    page: 1,
    pageSize: 10,
    totalCount: 1,
    totalPages: 1,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

type QueueResponder = (url: string) => Response | Promise<Response>;

function setupFetch(options: { categories?: unknown[]; queueResponder?: QueueResponder } = {}) {
  const categories = options.categories ?? [{ id: 1, name: "Hardware" }];
  const state: { queueResponder?: QueueResponder } = { queueResponder: options.queueResponder };

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/auth/me")) return jsonResponse(staffUser);
    if (url.includes("/api/categories")) return jsonResponse(categories);
    if (url.includes("/api/staff/assignable-users")) return jsonResponse({ data: [] });
    if (url.includes("/api/staff/tickets")) {
      if (state.queueResponder) return state.queueResponder(url);
      return jsonResponse(makeResult());
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    setQueueResponder: (fn: QueueResponder) => {
      state.queueResponder = fn;
    },
  };
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/staff/tickets"]}>
        <Routes>
          <Route path="/staff/tickets" element={<StaffTicketQueue />} />
          <Route path="/staff/tickets/:id" element={<h1>Ticket Detail</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("StaffTicketQueue", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-08
  it("shows skeleton rows and cards while the GET is in flight", async () => {
    let resolveQueue!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveQueue = resolve;
    });
    setupFetch({ queueResponder: () => pending });
    renderScreen();

    expect(await screen.findAllByTestId("ticket-skeleton-row")).toHaveLength(3);
    expect(screen.getAllByTestId("ticket-skeleton-card")).toHaveLength(3);

    resolveQueue(jsonResponse(makeResult()));
    await waitFor(() => expect(screen.queryAllByTestId("ticket-skeleton-row")).toHaveLength(0));
  });

  // UI-09
  it("renders all 8 columns with correctly mapped values", async () => {
    setupFetch({ queueResponder: () => jsonResponse(makeResult()) });
    renderScreen();

    expect((await screen.findAllByText("TKT-2026-000001")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Laptop won't power on").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hardware").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Medium").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    const createdDateText = new Date(baseTicket.createdAt).toLocaleDateString();
    expect(screen.getAllByText(createdDateText).length).toBeGreaterThan(0);
  });

  // UI-10
  it("shows the Empty state for zero Tickets and the No-results state for a filter matching nothing", async () => {
    const { setQueueResponder } = setupFetch({
      queueResponder: () => jsonResponse(makeResult({ data: [], totalCount: 0, totalPages: 0 })),
    });
    renderScreen();

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Search by ticket number/)).not.toBeInTheDocument();

    setQueueResponder((url) =>
      url.includes("status=OPEN")
        ? jsonResponse(makeResult({ data: [], totalCount: 0, totalPages: 0 }))
        : jsonResponse(makeResult()),
    );
  });

  // UI-11
  it("renders the muted Unassigned chip for an ownerId: null row, not a blank cell", async () => {
    setupFetch({ queueResponder: () => jsonResponse(makeResult()) });
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    const chips = document.querySelectorAll(".owner-chip--unassigned");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]?.textContent).toBe("Unassigned");
  });

  // UI-12
  it("changing a filter control triggers a new query carrying the selected value", async () => {
    const { fetchMock } = setupFetch({ queueResponder: () => jsonResponse(makeResult()) });
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    await userEvent.selectOptions(screen.getByLabelText("Status"), "OPEN");
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calls.some((u) => u.includes("/api/staff/tickets") && u.includes("status=OPEN"))).toBe(true);
    });

    await userEvent.selectOptions(screen.getByLabelText("IT Priority"), "HIGH");
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calls.some((u) => u.includes("/api/staff/tickets") && u.includes("itPriority=HIGH"))).toBe(true);
    });

    await userEvent.selectOptions(screen.getByLabelText("Owner"), "unassigned");
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calls.some((u) => u.includes("/api/staff/tickets") && u.includes("ownerId=unassigned"))).toBe(true);
    });
  });
});
