import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CreateTicketForm from "../../src/screens/CreateTicketForm.js";
import { RequesterProvider, setSelectedRequester } from "../../src/lib/requesterContext.js";

const defaultTicket = {
  id: 42,
  ticketNumber: "TKT-2026-000042",
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 1,
  summary: "Laptop won't power on",
  description: "Screen stays black after the firmware update finished overnight.",
  requestedPriority: "MEDIUM",
  status: "NEW",
  createdAt: "2026-08-29T10:15:00.000Z",
  updatedAt: "2026-08-29T10:15:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

type ResponseSource = Response | (() => Response | Promise<Response>);

function resolveSource(source: ResponseSource | undefined, fallback: Response) {
  if (!source) return fallback;
  return typeof source === "function" ? source() : source;
}

function setupFetch(options: {
  categories?: unknown[];
  relatedSystems?: unknown[];
  createTicketResponse?: ResponseSource;
  uploadResponse?: ResponseSource;
} = {}) {
  const {
    categories = [{ id: 1, name: "Hardware" }],
    relatedSystems = [{ id: 1, name: "Email" }],
    createTicketResponse,
    uploadResponse,
  } = options;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/api/categories")) return jsonResponse(categories);
    if (url.includes("/api/related-systems")) return jsonResponse(relatedSystems);
    if (url.includes("/attachments")) {
      return resolveSource(uploadResponse, jsonResponse([], 201));
    }
    if (url.endsWith("/api/tickets") && method === "POST") {
      return resolveSource(createTicketResponse, jsonResponse(defaultTicket, 201));
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen() {
  setSelectedRequester({ id: 1, name: "Alex Rivera" });
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={["/tickets/new"]}>
        <Routes>
          <Route path="/tickets/new" element={<CreateTicketForm />} />
          <Route path="/tickets/:id" element={<h1>Ticket Detail</h1>} />
          <Route path="/tickets" element={<h1>My Tickets</h1>} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

async function fillValidForm() {
  await screen.findByLabelText(/^Category/);
  await userEvent.selectOptions(screen.getByLabelText(/^Category/), "1");
  await userEvent.selectOptions(screen.getByLabelText(/^Related System/), "1");
  await userEvent.type(screen.getByLabelText(/^Summary/), "Laptop won't power on");
  await userEvent.type(
    screen.getByLabelText(/^Description/),
    "Screen stays black after the firmware update finished overnight.",
  );
}

describe("CreateTicketForm", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-07
  it("renders read-only Ticket Number placeholder, today's date, and the Requester name", async () => {
    setupFetch();
    renderScreen();

    const ticketNumberField = await screen.findByLabelText("Ticket Number");
    expect(ticketNumberField).toHaveValue("Generated after creation");
    expect(ticketNumberField).toHaveClass("field__control--readonly");

    expect(screen.getByLabelText("Requester")).toHaveValue("Alex Rivera");
    expect(screen.getByLabelText("Requester")).toHaveClass("field__control--readonly");

    const todayText = new Date().toLocaleDateString();
    expect(screen.getByLabelText("Ticket Date")).toHaveValue(todayText);
  });

  // UI-08
  it("shows an inline message for an empty Summary and sends no API request", async () => {
    const fetchMock = setupFetch();
    renderScreen();

    await screen.findByLabelText(/^Category/);
    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/^Related System/), "1");
    await userEvent.type(
      screen.getByLabelText(/^Description/),
      "Screen stays black after the firmware update finished overnight.",
    );
    // Summary intentionally left empty.
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Summary is required")).toBeInTheDocument();

    const postCalls = fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST");
    expect(postCalls).toHaveLength(0);
  });

  // UI-09
  it("preserves entered values and attachment chips after a 400 response", async () => {
    setupFetch({
      createTicketResponse: () =>
        jsonResponse({ errors: [{ field: "summary", message: "Summary must be at least 5 characters" }] }, 400),
    });
    renderScreen();

    await fillValidForm();
    const file = new File(["hello"], "note.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Attachments"), file);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Summary must be at least 5 characters")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Summary/)).toHaveValue("Laptop won't power on");
    expect(screen.getByText("note.png")).toBeInTheDocument();
  });

  // UI-10
  it("shows busy state after the first click and ignores a rapid second click", async () => {
    let resolveCreate!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = setupFetch({ createTicketResponse: () => pending });
    renderScreen();

    await fillValidForm();
    const submitBtn = screen.getByRole("button", { name: "Submit" });

    await userEvent.click(submitBtn);
    await userEvent.click(submitBtn);

    const busyBtn = await screen.findByRole("button", { name: "Submitting…" });
    expect(busyBtn).toHaveClass("btn--busy");
    expect(busyBtn).toBeDisabled();

    const postCallsBeforeResolve = fetchMock.mock.calls.filter(
      ([url, init]) => String(url).endsWith("/api/tickets") && (init as RequestInit)?.method === "POST",
    );
    expect(postCallsBeforeResolve).toHaveLength(1);

    resolveCreate(jsonResponse(defaultTicket, 201));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Submitting…" })).not.toBeInTheDocument(),
    );
  });

  // UI-11
  it("shows a failure banner and preserves entered values on a network/API failure", async () => {
    setupFetch({
      createTicketResponse: () => {
        throw new Error("network down");
      },
    });
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Couldn't create the Ticket. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Summary/)).toHaveValue("Laptop won't power on");
  });

  // UI-12
  it("renders the Ticket Number and a View Ticket link on success", async () => {
    setupFetch();
    renderScreen();

    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/TKT-2026-000042 created/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Ticket" })).toHaveAttribute(
      "href",
      "/tickets/42",
    );
  });

  // UI-13
  it("shows success plus a Warning-token banner when the attachment upload fails", async () => {
    setupFetch({
      uploadResponse: () => jsonResponse({ error: "Unexpected server error" }, 500),
    });
    renderScreen();

    await fillValidForm();
    const file = new File(["hello"], "note.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Attachments"), file);

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/TKT-2026-000042 created/)).toBeInTheDocument();
    const warning = await screen.findByText(/Some attachments couldn't be uploaded/);
    expect(warning.closest(".state-banner--warning")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Ticket Detail" })).toHaveAttribute(
      "href",
      "/tickets/42",
    );
  });
});
