import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

const ticket = {
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
  updatedAt: "2026-08-02T00:00:00.000Z",
  attachments: [],
  comments: [],
  notes: [],
};

const base = {
  id: 1,
  ticketId: 1,
  performedById: 9,
  performedByName: "Jordan Blake",
  description: "Collected logs",
  result: "Logs attached",
  attachmentNotes: null,
  createdAt: "2026-08-03T09:00:00.000Z",
  updatedAt: "2026-08-03T09:00:00.000Z",
};

const json = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function setup() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/me")) return json(staffUser);
      if (url.includes("/api/categories")) return json([{ id: 1, name: "Hardware" }]);
      if (url.includes("/api/related-systems")) return json([{ id: 1, name: "Email" }]);
      if (url.includes("assignable-users")) return json({ data: [] });
      if (url.endsWith("/actions-taken")) {
        return json({
          data: [
            { ...base, followUpRequired: false, followUpNote: null },
            { ...base, id: 2, followUpRequired: true, followUpNote: "Check Friday" },
          ],
        });
      }
      if (url.match(/\/api\/staff\/tickets\/1$/)) return json(ticket);
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
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

describe("Actions Taken style rules (ui-spec.md §2, §4.3, §6)", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // STYLE-03
  it("the Follow-up chip is text-labelled and appears only on rows that need follow-up", async () => {
    setup();
    await userEvent.click(await screen.findByRole("tab", { name: /Actions Taken/ }));

    const rows = document.querySelectorAll(".action-taken-entry");
    const chips = document.querySelectorAll(".action-taken-entry__followup");
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent("Follow-up needed");
    expect(rows[1].contains(chips[0])).toBe(true);
    expect(rows[0].querySelector(".action-taken-entry__followup")).toBeNull();
    expect(document.querySelector(".actions-taken-panel")).not.toBeNull();
  });

  // STYLE-04
  it("the form has labels above controls, required asterisks, adjacent validation messages, and an edit control with an accessible label", async () => {
    setup();
    await userEvent.click(await screen.findByRole("tab", { name: /Actions Taken/ }));

    const form = screen.getByRole("form", { name: "Add Action Taken" });
    expect(form).toHaveClass("action-taken-form");

    for (const label of ["Description", "Result"]) {
      const control = within(form).getByLabelText(new RegExp(label));
      const wrapper = control.closest(".field") as HTMLElement;
      expect(wrapper.querySelector(".field__label")).toHaveTextContent(label);
      expect(wrapper.querySelector(".field__required-marker")).not.toBeNull();
      expect(control).toHaveClass("field__control");
    }
    expect(within(form).getByLabelText("Attachment Notes").closest(".field")!.querySelector(".field__required-marker")).toBeNull();

    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));
    const descField = within(form).getByLabelText(/Description/).closest(".field") as HTMLElement;
    const message = descField.querySelector(".field__message--error");
    expect(message).toHaveTextContent("Description cannot be empty");
    expect(within(form).getByLabelText(/Description/)).toHaveAttribute("aria-invalid", "true");

    expect(screen.getAllByRole("button", { name: "Edit this action" })).toHaveLength(2);
  });
});
