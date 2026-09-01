// UI-28/29/30/32 (Remove confirmation, removed-row control absence, 404
// preview/download, and Preview-opens-new-tab) are not written here — they
// exercise the attachment Preview/Download/Remove endpoints from Issue #21,
// which don't exist yet. Only UI-26, UI-27, and UI-31 are covered.

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TicketDetail from "../../src/screens/TicketDetail.js";
import { RequesterProvider, setSelectedRequester } from "../../src/lib/requesterContext.js";

const baseTicket = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 1,
  summary: "Laptop won't power on after firmware update",
  description: "Laptop screen stays black after the scheduled firmware update finished overnight.",
  requestedPriority: "HIGH",
  status: "NEW",
  createdAt: "2026-08-29T10:15:00.000Z",
  updatedAt: "2026-08-29T10:15:00.000Z",
  attachments: [
    {
      id: 101,
      ticketId: 42,
      originalFilename: "screenshot.png",
      mimeType: "image/png",
      sizeBytes: 245678,
      createdAt: "2026-08-29T10:16:00.000Z",
      isRemoved: false,
      removedAt: null,
      removalReason: null,
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

type TicketResponder = () => Response | Promise<Response>;

function setupFetch(options: { categories?: unknown[]; relatedSystems?: unknown[]; ticketResponder: TicketResponder }) {
  const categories = options.categories ?? [{ id: 1, name: "Hardware" }];
  const relatedSystems = options.relatedSystems ?? [{ id: 1, name: "Email" }];

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/categories")) return jsonResponse(categories);
    if (url.includes("/api/related-systems")) return jsonResponse(relatedSystems);
    if (url.match(/\/api\/tickets\/\d+$/)) return options.ticketResponder();
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return { fetchMock };
}

function renderScreen(ticketId = "42") {
  setSelectedRequester({ id: 1, name: "Alex Rivera" });
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/tickets" element={<h1>My Tickets</h1>} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

describe("TicketDetail", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-31
  it("shows a skeleton placeholder for both panels while the GET is in flight", async () => {
    let resolveTicket!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveTicket = resolve;
    });
    setupFetch({ ticketResponder: () => pending });
    renderScreen();

    expect(screen.getByTestId("ticket-detail-header-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-detail-attachments-skeleton")).toBeInTheDocument();

    resolveTicket(jsonResponse(baseTicket));
    await waitFor(() => expect(screen.queryByTestId("ticket-detail-header-skeleton")).not.toBeInTheDocument());
  });

  // UI-26
  it("renders the read-only header fields and Attachments panel with badges, once loaded", async () => {
    setupFetch({ ticketResponder: () => jsonResponse(baseTicket) });
    renderScreen();

    expect(await screen.findByText("TKT-2026-000042")).toBeInTheDocument();
    expect(screen.getByText("Laptop won't power on after firmware update")).toBeInTheDocument();
    expect(
      screen.getByText("Laptop screen stays black after the scheduled firmware update finished overnight."),
    ).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();

    expect(screen.getByText("Attachments (1 active)")).toBeInTheDocument();
    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
  });

  // UI-27
  it("renders an identically-worded not-found panel whether the Ticket is missing or owned by someone else", async () => {
    setupFetch({ ticketResponder: () => jsonResponse({ error: "Not found" }, 404) });
    renderScreen();

    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
    expect(
      screen.getByText("This ticket doesn't exist, or isn't available to you."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to My Tickets" })).toBeInTheDocument();
  });
});
