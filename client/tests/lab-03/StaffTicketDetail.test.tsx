import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const assignableUsers = [
  { id: 9, name: "Jordan Blake", role: "IT_STAFF" },
  { id: 20, name: "Robin Park", role: "ADMINISTRATOR" },
];

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
  status: "NEW",
  ownerId: null,
  requesterIndicatedResolvedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  attachments: [],
  comments: [{ id: 1, ticketId: 1, authorId: 1, authorName: "Alex Rivera", authorRole: "REQUESTER", body: "Still broken.", createdAt: "2026-08-01T10:00:00.000Z" }],
  notes: [{ id: 1, ticketId: 1, authorId: 9, authorName: "Jordan Blake", authorRole: "IT_STAFF", body: "Ordered a replacement part.", createdAt: "2026-08-01T11:00:00.000Z" }],
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

type TicketResponder = () => Response | Promise<Response>;

function setupFetch(
  options: {
    ticket?: Record<string, unknown>;
    ticketResponder?: TicketResponder;
  } = {},
) {
  const ticket = options.ticket ?? baseTicket;
  const state: { ticketResponder?: TicketResponder } = { ticketResponder: options.ticketResponder };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/auth/me")) return jsonResponse(staffUser);
    if (url.includes("/api/categories")) return jsonResponse([{ id: 1, name: "Hardware" }]);
    if (url.includes("/api/related-systems")) return jsonResponse([{ id: 1, name: "Email" }]);
    if (url.includes("/api/staff/assignable-users")) return jsonResponse({ data: assignableUsers });

    if (url.match(/\/api\/staff\/tickets\/\d+$/) && method === "GET") {
      if (state.ticketResponder) return state.ticketResponder();
      return jsonResponse(ticket);
    }
    if (url.includes("/owner") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ ...ticket, ownerId: body.ownerId });
    }
    if (url.includes("/it-priority") && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ ...ticket, itPriority: body.itPriority });
    }
    if (url.includes("/status") && method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ ...ticket, status: body.status });
    }
    if (url.includes("/comments") && method === "POST") {
      return jsonResponse({ id: 99, ticketId: 1, authorId: 9, authorName: "Jordan Blake", authorRole: "IT_STAFF", body: "new comment", createdAt: "2026-08-03T00:00:00.000Z" }, 201);
    }
    if (url.includes("/notes") && method === "POST") {
      return jsonResponse({ id: 99, ticketId: 1, authorId: 9, authorName: "Jordan Blake", authorRole: "IT_STAFF", body: "new note", createdAt: "2026-08-03T00:00:00.000Z" }, 201);
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return { fetchMock };
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/staff/tickets/1"]}>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
          <Route path="/staff/tickets" element={<h1>Ticket Queue</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("StaffTicketDetail", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-13
  it("renders a one-click Claim button when unassigned, and the Owner select when assigned", async () => {
    setupFetch({ ticket: { ...baseTicket, ownerId: null } });
    renderScreen();

    expect(await screen.findByRole("button", { name: "Claim" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Owner")).not.toBeInTheDocument();
  });

  it("renders the Owner select (not Claim) once the Ticket is assigned", async () => {
    setupFetch({ ticket: { ...baseTicket, ownerId: 20 } });
    renderScreen();

    expect(await screen.findByLabelText("Owner")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
  });

  // UI-14
  it("Status select on a New Ticket offers only Open and Cancelled, nothing else", async () => {
    setupFetch({ ticket: { ...baseTicket, status: "NEW" } });
    renderScreen();

    const select = await screen.findByLabelText("Status");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);

    expect(options).toContain("Open");
    expect(options).toContain("Cancelled");
    expect(options).not.toContain("In Progress");
    expect(options).not.toContain("Closed");
    expect(options).not.toContain("New");
    // Placeholder + exactly the 2 legal targets.
    expect(options).toHaveLength(3);
  });

  // UI-15
  it("selecting Cancelled opens a confirmation dialog; the PATCH is sent only after Confirm", async () => {
    const { fetchMock } = setupFetch({ ticket: { ...baseTicket, status: "NEW" } });
    renderScreen();

    const select = await screen.findByLabelText("Status");
    await userEvent.selectOptions(select, "CANCELLED");

    expect(await screen.findByRole("dialog", { name: "Confirm status change" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/status"))).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/status"));
      expect(calls.length).toBe(1);
    });
  });

  it("Cancel on the confirmation dialog sends no request", async () => {
    const { fetchMock } = setupFetch({ ticket: { ...baseTicket, status: "NEW" } });
    renderScreen();

    const select = await screen.findByLabelText("Status");
    await userEvent.selectOptions(select, "CANCELLED");
    await screen.findByRole("dialog", { name: "Confirm status change" });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Confirm status change" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/status"))).toBe(false);
  });

  // UI-16
  it("switching between the Public Comments and Internal Notes tabs renders the correct panel and compose box", async () => {
    setupFetch();
    renderScreen();

    await screen.findByText("Still broken.");
    expect(screen.getByText("Public Comments — visible to the Requester")).toBeInTheDocument();
    expect(screen.getByLabelText("Add a comment")).toBeInTheDocument();
    expect(screen.queryByText("Ordered a replacement part.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Internal Notes" }));

    expect(screen.getByText("Internal Notes — visible to IT Staff and Administrators only")).toBeInTheDocument();
    expect(screen.getByLabelText("Add a note")).toBeInTheDocument();
    expect(screen.getByText("Ordered a replacement part.")).toBeInTheDocument();
    expect(screen.queryByText("Still broken.")).not.toBeInTheDocument();
  });

  // UI-17
  it("IT Priority renders editable-field styling; Requested Priority beside it stays read-only", async () => {
    setupFetch();
    renderScreen();

    const itPrioritySelect = await screen.findByLabelText("IT Priority");
    expect(itPrioritySelect.className).toContain("field__control");
    expect(itPrioritySelect.className).not.toContain("field__control--readonly");

    // Requested Priority renders as the read-only Badge, not an editable control.
    expect(screen.queryByLabelText("Requested Priority")).not.toBeInTheDocument();
    expect(document.querySelector(".badge--priority-high")).not.toBeNull();
  });

  // UI-24
  it("the Owner select is populated from the assignable-users response, not a full user list", async () => {
    setupFetch({ ticket: { ...baseTicket, ownerId: 20 } });
    renderScreen();

    const select = await screen.findByLabelText("Owner");
    const optionNames = Array.from(select.querySelectorAll("option")).map((o) => o.textContent);

    expect(optionNames).toEqual(expect.arrayContaining(["Jordan Blake", "Robin Park"]));
    expect(optionNames).toHaveLength(2);
  });
});
