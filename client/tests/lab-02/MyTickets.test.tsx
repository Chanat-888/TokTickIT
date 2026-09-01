import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MyTickets from "../../src/screens/MyTickets.js";
import { RequesterProvider, setSelectedRequester } from "../../src/lib/requesterContext.js";

const baseTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 1,
  summary: "Laptop won't power on",
  description: "Screen stays black after the firmware update finished overnight.",
  requestedPriority: "HIGH",
  status: "NEW",
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

type TicketsResponder = (url: string) => Response | Promise<Response>;

function setupFetch(
  options: {
    categories?: unknown[];
    ticketsResponder?: TicketsResponder;
  } = {},
) {
  const categories = options.categories ?? [{ id: 1, name: "Hardware" }];
  const state: { ticketsResponder?: TicketsResponder } = { ticketsResponder: options.ticketsResponder };

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/categories")) return jsonResponse(categories);
    if (url.includes("/api/tickets")) {
      if (state.ticketsResponder) return state.ticketsResponder(url);
      return jsonResponse(makeResult());
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    fetchMock,
    setTicketsResponder: (fn: TicketsResponder) => {
      state.ticketsResponder = fn;
    },
  };
}

function renderScreen() {
  setSelectedRequester({ id: 1, name: "Alex Rivera" });
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={["/tickets"]}>
        <Routes>
          <Route path="/tickets" element={<MyTickets />} />
          <Route path="/tickets/new" element={<h1>Create Ticket</h1>} />
          <Route path="/tickets/:id" element={<h1>Ticket Detail</h1>} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

describe("MyTickets", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-18
  it("shows skeleton rows and cards while the GET is in flight", async () => {
    let resolveTickets!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveTickets = resolve;
    });
    setupFetch({ ticketsResponder: () => pending });
    renderScreen();

    expect(await screen.findAllByTestId("ticket-skeleton-row")).toHaveLength(3);
    expect(screen.getAllByTestId("ticket-skeleton-card")).toHaveLength(3);

    resolveTickets(jsonResponse(makeResult()));
    await waitFor(() => expect(screen.queryAllByTestId("ticket-skeleton-row")).toHaveLength(0));
  });

  // UI-19
  it("renders all 7 columns with correctly mapped values", async () => {
    setupFetch({ ticketsResponder: () => jsonResponse(makeResult()) });
    renderScreen();

    expect((await screen.findAllByText("TKT-2026-000001")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Laptop won't power on").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hardware").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("New").length).toBeGreaterThan(0);
    const createdDateText = new Date(baseTicket.createdAt).toLocaleDateString();
    const updatedDateText = new Date(baseTicket.updatedAt).toLocaleDateString();
    expect(screen.getAllByText(createdDateText).length).toBeGreaterThan(0);
    expect(screen.getAllByText(updatedDateText).length).toBeGreaterThan(0);
  });

  // UI-20
  it("shows the Empty state and hides the toolbar when the Requester owns zero Tickets", async () => {
    setupFetch({
      ticketsResponder: () => jsonResponse(makeResult({ data: [], totalCount: 0, totalPages: 0 })),
    });
    renderScreen();

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first ticket to get started.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Search by ticket number/)).not.toBeInTheDocument();
  });

  // UI-21
  it("shows the No-results state and keeps the toolbar visible when a filter matches nothing", async () => {
    setupFetch({
      ticketsResponder: (url) =>
        url.includes("requestedPriority=HIGH")
          ? jsonResponse(makeResult({ data: [], totalCount: 0, totalPages: 0 }))
          : jsonResponse(makeResult()),
    });
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    await userEvent.selectOptions(screen.getByLabelText("Requested Priority"), "HIGH");

    expect(await screen.findByText("No tickets match your search")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by ticket number/)).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: "Clear Filters" });
    expect(clearButtons.length).toBeGreaterThan(0);
    for (const btn of clearButtons) expect(btn).not.toBeDisabled();
  });

  // UI-22
  it("disables Clear Filters with no active filter and enables it once one is applied", async () => {
    setupFetch({ ticketsResponder: () => jsonResponse(makeResult()) });
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    const clearBtn = screen.getByRole("button", { name: "Clear Filters" });
    expect(clearBtn).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText("Requested Priority"), "HIGH");

    expect(clearBtn).not.toBeDisabled();
  });

  // UI-23
  it("toggles sortDir and updates the glyph when clicking the active sortable header", async () => {
    const { fetchMock } = setupFetch({ ticketsResponder: () => jsonResponse(makeResult()) });
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    const createdDateHeaderBtn = screen.getByRole("button", { name: /Created Date/ });
    expect(createdDateHeaderBtn.querySelector(".ticket-table__sort-icon")?.textContent).toBe("▼");

    await userEvent.click(createdDateHeaderBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calls.some((u) => u.includes("/api/tickets") && u.includes("sortDir=asc"))).toBe(true);
    });
    expect(createdDateHeaderBtn.querySelector(".ticket-table__sort-icon")?.textContent).toBe("▲");
  });

  // UI-24
  it("changing the page-size select updates pageSize and resets to page 1", async () => {
    const { fetchMock } = setupFetch({
      ticketsResponder: () => jsonResponse(makeResult({ totalCount: 25, totalPages: 3 })),
    });
    renderScreen();

    await screen.findAllByText("TKT-2026-000001");

    await userEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calls.some((u) => u.includes("/api/tickets") && u.includes("page=2"))).toBe(true);
    });

    await userEvent.selectOptions(screen.getByLabelText("Page Size"), "20");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.includes("/api/tickets"));
      const last = calls[calls.length - 1] ?? "";
      expect(last).toContain("pageSize=20");
      expect(last).toContain("page=1");
    });
  });

  // UI-25
  it("shows a failure banner with a Retry action that re-runs the fetch", async () => {
    const { setTicketsResponder } = setupFetch({
      ticketsResponder: () => jsonResponse({ error: "Unexpected server error" }, 500),
    });
    renderScreen();

    const banner = await screen.findByText("Couldn't load Tickets.");
    expect(banner.closest(".state-banner--error")).not.toBeNull();

    setTicketsResponder(() => jsonResponse(makeResult()));
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect((await screen.findAllByText("TKT-2026-000001")).length).toBeGreaterThan(0);
  });
});
