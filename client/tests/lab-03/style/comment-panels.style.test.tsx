import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../../src/screens/StaffTicketDetail.js";
import { AuthProvider } from "../../../src/lib/authContext.js";

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
  status: "NEW",
  ownerId: null,
  requesterIndicatedResolvedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  attachments: [],
  comments: [
    { id: 1, ticketId: 1, authorId: 1, authorName: "Alex Rivera", authorRole: "REQUESTER", body: "Still broken.", createdAt: "2026-08-01T10:00:00.000Z" },
  ],
  notes: [
    { id: 1, ticketId: 1, authorId: 9, authorName: "Jordan Blake", authorRole: "IT_STAFF", body: "Ordered a replacement part.", createdAt: "2026-08-01T11:00:00.000Z" },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function setupFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.includes("/auth/me")) return jsonResponse(staffUser);
      if (url.includes("/api/categories")) return jsonResponse([{ id: 1, name: "Hardware" }]);
      if (url.includes("/api/related-systems")) return jsonResponse([{ id: 1, name: "Email" }]);
      if (url.includes("/api/staff/assignable-users")) return jsonResponse({ data: [] });
      if (url.match(/\/api\/staff\/tickets\/\d+$/) && method === "GET") return jsonResponse(baseTicket);
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }),
  );
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

describe("Comment panel style", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // STYLE-04
  it(".comment-panel--public is present on the Public Comments tab with the fixed header copy", async () => {
    setupFetch();
    renderScreen();

    await screen.findByText("Still broken.");
    const header = screen.getByText("Public Comments — visible to the Requester");
    expect(header).toHaveClass("comment-panel__header");
    expect(header.closest(".comment-panel")).toHaveClass("comment-panel--public");
  });

  it(".comment-panel--internal is present on the Internal Notes tab with the fixed header copy", async () => {
    setupFetch();
    renderScreen();

    await screen.findByText("Still broken.");
    await userEvent.click(screen.getByRole("tab", { name: "Internal Notes" }));

    const header = screen.getByText("Internal Notes — visible to IT Staff and Administrators only");
    expect(header).toHaveClass("comment-panel__header");
    expect(header.closest(".comment-panel")).toHaveClass("comment-panel--internal");
  });
});
