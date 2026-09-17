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

const assignableUsers = [{ id: 9, name: "Jordan Blake", role: "IT_STAFF" }];

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
  ownerId: 9,
  requesterIndicatedResolvedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  attachments: [],
  comments: [],
  notes: [],
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
      if (url.includes("/api/staff/assignable-users")) return jsonResponse({ data: assignableUsers });
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

describe("IT Staff Ticket Detail Operations panel style", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // STYLE-05
  it(".ticket-ops-panel, .owner-select, and .status-select are all present", async () => {
    setupFetch();
    renderScreen();

    const ownerSelect = await screen.findByLabelText("Owner");
    expect(ownerSelect).toHaveClass("owner-select");
    expect(ownerSelect.closest(".ticket-ops-panel")).not.toBeNull();

    const statusSelect = screen.getByLabelText("Status");
    expect(statusSelect).toHaveClass("status-select");
    expect(statusSelect.closest(".ticket-ops-panel")).not.toBeNull();
  });

  // STYLE-06
  it(".confirm-dialog is present when targeting Cancelled", async () => {
    setupFetch();
    renderScreen();

    const statusSelect = await screen.findByLabelText("Status");
    await userEvent.selectOptions(statusSelect, "CANCELLED");

    expect(await screen.findByRole("dialog", { name: "Confirm status change" })).toHaveClass("confirm-dialog");
  });
});
