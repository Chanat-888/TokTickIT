import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

type Responder = () => Response | Promise<Response>;

// Extended beyond Issue #20's version to also route the Issue #21 attachment
// metadata GET and the attachment DELETE, needed by UI-28/29/30/32 below.
function setupFetch(options: {
  categories?: unknown[];
  relatedSystems?: unknown[];
  ticketResponder: Responder;
  attachmentResponder?: Responder;
  deleteResponder?: Responder;
}) {
  const categories = options.categories ?? [{ id: 1, name: "Hardware" }];
  const relatedSystems = options.relatedSystems ?? [{ id: 1, name: "Email" }];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/api/categories")) return jsonResponse(categories);
    if (url.includes("/api/related-systems")) return jsonResponse(relatedSystems);
    if (method === "DELETE" && url.match(/\/api\/tickets\/\d+\/attachments\/\d+$/)) {
      if (!options.deleteResponder) throw new Error(`Unexpected DELETE: ${url}`);
      return options.deleteResponder();
    }
    if (url.match(/\/api\/tickets\/\d+\/attachments\/\d+$/)) {
      if (!options.attachmentResponder) throw new Error(`Unexpected fetch: ${url}`);
      return options.attachmentResponder();
    }
    if (url.match(/\/api\/tickets\/\d+$/)) return options.ticketResponder();
    throw new Error(`Unexpected fetch: ${url} (${method})`);
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

  // UI-28
  it("Remove opens a confirmation panel with an optional Reason field; only Confirm calls the DELETE endpoint", async () => {
    const user = userEvent.setup();
    let ticketCallCount = 0;
    const removedTicket = {
      ...baseTicket,
      attachments: [
        {
          ...baseTicket.attachments[0],
          isRemoved: true,
          removedAt: "2026-08-30T09:00:00.000Z",
          removalReason: "Duplicate",
        },
      ],
    };

    const { fetchMock } = setupFetch({
      ticketResponder: () => {
        ticketCallCount += 1;
        return jsonResponse(ticketCallCount === 1 ? baseTicket : removedTicket);
      },
      deleteResponder: () => jsonResponse(removedTicket.attachments[0]),
    });

    renderScreen();
    await screen.findByText("screenshot.png");

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("dialog", { name: "Remove attachment" })).toBeInTheDocument();

    // Cancel does nothing — no DELETE call, panel closes.
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Remove attachment" })).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE"),
    ).toBe(false);

    // Reopen, enter a reason, Confirm — only now does the DELETE fire.
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.type(screen.getByLabelText("Reason (optional)"), "Duplicate");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(ticketCallCount).toBe(2));
    expect(screen.queryByRole("dialog", { name: "Remove attachment" })).not.toBeInTheDocument();

    const deleteCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    const [deleteUrl, deleteInit] = deleteCall!;
    expect(String(deleteUrl)).toContain("/api/tickets/42/attachments/101");
    expect(JSON.parse((deleteInit as RequestInit).body as string)).toEqual({ reason: "Duplicate" });
  });

  // UI-29
  it("a removed attachment row shows muted metadata with no Preview/Download/Remove controls", async () => {
    const removedTicket = {
      ...baseTicket,
      attachments: [
        {
          ...baseTicket.attachments[0],
          isRemoved: true,
          removedAt: "2026-08-30T09:00:00.000Z",
          removalReason: "Duplicate of another attached screenshot",
        },
      ],
    };
    setupFetch({ ticketResponder: () => jsonResponse(removedTicket) });
    renderScreen();

    await screen.findByText("screenshot.png");
    const row = screen.getByText("screenshot.png").closest(".attachment-item") as HTMLElement;
    expect(row).toHaveClass("attachment-item--removed");
    expect(screen.queryByRole("link", { name: "Preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Download" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(
      within(row).getByText(/Duplicate of another attached screenshot/),
    ).toBeInTheDocument();
  });

  // UI-30
  it("a Preview click that discovers the attachment was removed shows a transient message and disables that row's actions", async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const { fetchMock } = setupFetch({
      ticketResponder: () => jsonResponse(baseTicket),
      attachmentResponder: () =>
        jsonResponse({
          ...baseTicket.attachments[0],
          isRemoved: true,
          removedAt: "2026-08-30T09:00:00.000Z",
          removalReason: null,
        }),
    });

    renderScreen();
    await screen.findByText("screenshot.png");

    await user.click(screen.getByRole("link", { name: "Preview" }));

    expect(await screen.findByText("This attachment is no longer available.")).toBeInTheDocument();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Preview" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("aria-disabled", "true");

    const attachmentGetCalls = fetchMock.mock.calls.filter(([url]) => {
      const u = typeof url === "string" ? url : url.toString();
      return /\/api\/tickets\/\d+\/attachments\/\d+$/.test(u);
    });
    expect(attachmentGetCalls.length).toBeGreaterThanOrEqual(1);
  });

  // UI-32
  it("Preview opens the download URL in a new browser tab when the attachment is still active", async () => {
    const user = userEvent.setup();
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    setupFetch({
      ticketResponder: () => jsonResponse(baseTicket),
      attachmentResponder: () => jsonResponse(baseTicket.attachments[0]),
    });

    renderScreen();
    await screen.findByText("screenshot.png");

    const previewLink = screen.getByRole("link", { name: "Preview" });
    expect(previewLink).toHaveAttribute("target", "_blank");
    expect(previewLink).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(previewLink);

    await waitFor(() => expect(windowOpenSpy).toHaveBeenCalledTimes(1));
    const [url, target] = windowOpenSpy.mock.calls[0];
    expect(String(url)).toContain("/api/tickets/42/attachments/101/download");
    expect(target).toBe("_blank");
  });
});
