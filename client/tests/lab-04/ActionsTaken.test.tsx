import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StaffTicketDetail from "../../src/screens/StaffTicketDetail.js";
import TicketDetail from "../../src/screens/TicketDetail.js";
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

const staffTicket = {
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

const requesterTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  requesterId: 1,
  categoryId: 1,
  relatedSystemId: 1,
  summary: "Laptop won't power on",
  description: "Screen stays black after the firmware update finished overnight.",
  requestedPriority: "HIGH",
  status: "IN_PROGRESS",
  requesterIndicatedResolvedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  attachments: [],
};

const action = (over: Record<string, unknown> = {}) => ({
  id: 1,
  ticketId: 1,
  performedById: 9,
  performedByName: "Jordan Blake",
  description: "Collected logs from the device",
  result: "Logs attached for review",
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  createdAt: "2026-08-03T09:00:00.000Z",
  updatedAt: "2026-08-03T09:00:00.000Z",
  ...over,
});

const ACTIONS = [
  action(),
  action({
    id: 2,
    performedById: 20,
    performedByName: "Morgan Silva",
    description: "Applied the vendor patch",
    result: "Patch installed",
    followUpRequired: true,
    followUpNote: "Check again on Friday",
    attachmentNotes: "Screenshot of the error is in the ticket attachments",
    createdAt: "2026-08-03T11:00:00.000Z",
  }),
];

const json = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

type Handlers = {
  list?: () => Response | Promise<Response>;
  post?: (body: Record<string, unknown>) => Response | Promise<Response>;
  patch?: (url: string, body: Record<string, unknown>) => Response | Promise<Response>;
};

function setupFetch(handlers: Handlers = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (url.includes("/auth/me")) return json(staffUser);
    if (url.includes("/api/categories")) return json([{ id: 1, name: "Hardware" }]);
    if (url.includes("/api/related-systems")) return json([{ id: 1, name: "Email" }]);
    if (url.includes("/api/staff/assignable-users")) return json({ data: [{ id: 9, name: "Jordan Blake", role: "IT_STAFF" }] });
    if (url.match(/\/api\/tickets\/1\/actions-taken\/\d+$/) && method === "PATCH") {
      return handlers.patch ? handlers.patch(url, body) : json({ ...ACTIONS[0], ...body });
    }
    if (url.match(/\/api\/tickets\/1\/actions-taken$/)) {
      if (method === "POST") return handlers.post ? handlers.post(body) : json(action({ id: 3, ...body }), 201);
      return handlers.list ? handlers.list() : json({ data: ACTIONS });
    }
    if (url.match(/\/api\/staff\/tickets\/1$/)) return json(staffTicket);
    if (url.match(/\/api\/tickets\/1\/comments$/)) return json({ data: [] });
    if (url.match(/\/api\/tickets\/1$/)) return json(requesterTicket);
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderStaff() {
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

function renderRequester() {
  return render(
    <MemoryRouter initialEntries={["/tickets/1"]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openActionsTab() {
  await userEvent.click(await screen.findByRole("tab", { name: /Actions Taken/ }));
}

const writes = (fetchMock: ReturnType<typeof vi.fn>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === method);

describe("Actions Taken on Ticket Detail", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-01
  it("staff see an 'Actions Taken (N)' tab listing every action oldest first with performer, time, description and result", async () => {
    setupFetch();
    renderStaff();

    const tab = await screen.findByRole("tab", { name: "Actions Taken (2)" });
    await userEvent.click(tab);

    const entries = document.querySelectorAll(".action-taken-entry");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Collected logs from the device");
    expect(entries[0]).toHaveTextContent("Logs attached for review");
    expect(entries[0]).toHaveTextContent("Jordan Blake");
    expect(entries[1]).toHaveTextContent("Morgan Silva");
    expect(entries[1]).toHaveTextContent("Applied the vendor patch");
    expect(entries[1]).toHaveTextContent("Check again on Friday");
    expect(entries[1]).toHaveTextContent("Screenshot of the error is in the ticket attachments");
    expect(within(entries[1] as HTMLElement).getByText("Follow-up needed")).toBeInTheDocument();
    expect(within(entries[0] as HTMLElement).queryByText("Follow-up needed")).not.toBeInTheDocument();
  });

  // UI-02
  it("Follow-up Note appears only when Follow-Up Required is checked; an empty submit shows field messages and sends nothing", async () => {
    const fetchMock = setupFetch();
    renderStaff();
    await openActionsTab();

    const form = screen.getByRole("form", { name: "Add Action Taken" });
    expect(within(form).queryByLabelText(/Follow-up Note/)).not.toBeInTheDocument();

    await userEvent.click(within(form).getByLabelText("Follow-Up Required?"));
    expect(within(form).getByLabelText(/Follow-up Note/)).toBeInTheDocument();

    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));

    expect(within(form).getByText("Description cannot be empty")).toBeInTheDocument();
    expect(within(form).getByText("Result cannot be empty")).toBeInTheDocument();
    expect(within(form).getByText("Follow-up Note is required when Follow-Up Required is checked")).toBeInTheDocument();
    expect(writes(fetchMock, "POST")).toHaveLength(0);

    await userEvent.click(within(form).getByLabelText("Follow-Up Required?"));
    expect(within(form).queryByLabelText(/Follow-up Note/)).not.toBeInTheDocument();
  });

  it("a valid submit POSTs the fields with a UUID idempotencyKey, appends the row, and resets the form", async () => {
    const fetchMock = setupFetch();
    renderStaff();
    await openActionsTab();

    const form = screen.getByRole("form", { name: "Add Action Taken" });
    await userEvent.type(within(form).getByLabelText(/Description/), "Rebooted the router");
    await userEvent.type(within(form).getByLabelText(/Result/), "Connection restored");
    await userEvent.type(within(form).getByLabelText("Attachment Notes"), "See photo in attachments");
    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));

    await waitFor(() => expect(document.querySelectorAll(".action-taken-entry")).toHaveLength(3));
    const [, init] = writes(fetchMock, "POST")[0];
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent).toMatchObject({
      description: "Rebooted the router",
      result: "Connection restored",
      followUpRequired: false,
      attachmentNotes: "See photo in attachments",
    });
    expect(sent.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(within(form).getByLabelText(/Description/)).toHaveValue("");
    expect(screen.getByRole("tab", { name: "Actions Taken (3)" })).toBeInTheDocument();
  });

  // UI-03
  it("Submit shows a busy state and a double click sends one request", async () => {
    let release!: (r: Response) => void;
    const pending = new Promise<Response>((resolve) => (release = resolve));
    const fetchMock = setupFetch({ post: () => pending });
    renderStaff();
    await openActionsTab();

    const form = screen.getByRole("form", { name: "Add Action Taken" });
    await userEvent.type(within(form).getByLabelText(/Description/), "Did a thing");
    await userEvent.type(within(form).getByLabelText(/Result/), "It worked");
    const submit = within(form).getByRole("button", { name: "Add Action Taken" });
    await userEvent.dblClick(submit);

    expect(within(form).getByRole("button", { name: /Saving/ })).toBeDisabled();
    expect(writes(fetchMock, "POST")).toHaveLength(1);
    release(json(action({ id: 3 }), 201));
    await waitFor(() => expect(document.querySelectorAll(".action-taken-entry")).toHaveLength(3));
  });

  it("a failed save keeps the entered values, shows a safe error, and the retry reuses the same idempotencyKey", async () => {
    let calls = 0;
    const fetchMock = setupFetch({
      post: () => (++calls === 1 ? json({ error: "Unexpected server error" }, 500) : json(action({ id: 3 }), 201)),
    });
    renderStaff();
    await openActionsTab();

    const form = screen.getByRole("form", { name: "Add Action Taken" });
    await userEvent.type(within(form).getByLabelText(/Description/), "Did a thing");
    await userEvent.type(within(form).getByLabelText(/Result/), "It worked");
    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));

    expect(await within(form).findByText(/Couldn't save this action/)).toBeInTheDocument();
    expect(within(form).getByLabelText(/Description/)).toHaveValue("Did a thing");
    expect(within(form).getByLabelText(/Result/)).toHaveValue("It worked");

    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));
    await waitFor(() => expect(writes(fetchMock, "POST")).toHaveLength(2));
    const keys = writes(fetchMock, "POST").map(([, init]) => JSON.parse(String((init as RequestInit).body)).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
  });

  // UI-20 — BR-13: a 200 means an earlier save of this same submission won
  it("a 200 (already saved) keeps the user's text, says so, shows the saved row, and the next submit uses a new key", async () => {
    let calls = 0;
    const fetchMock = setupFetch({
      post: () => (++calls === 1 ? json(action({ id: 3, description: "Original text" }), 200) : json(action({ id: 4 }), 201)),
    });
    renderStaff();
    await openActionsTab();

    const form = screen.getByRole("form", { name: "Add Action Taken" });
    await userEvent.type(within(form).getByLabelText(/Description/), "Edited text");
    await userEvent.type(within(form).getByLabelText(/Result/), "Some result");
    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));

    expect(await within(form).findByText(/already saved/)).toBeInTheDocument();
    expect(within(form).getByLabelText(/Description/)).toHaveValue("Edited text");
    expect(within(form).getByLabelText(/Result/)).toHaveValue("Some result");
    await waitFor(() => expect(document.querySelectorAll(".action-taken-entry")).toHaveLength(3));
    expect(screen.getByText("Original text")).toBeInTheDocument();

    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));
    await waitFor(() => expect(writes(fetchMock, "POST")).toHaveLength(2));
    const keys = writes(fetchMock, "POST").map(([, init]) => JSON.parse(String((init as RequestInit).body)).idempotencyKey);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("server field errors (400) are shown beside the matching fields", async () => {
    setupFetch({
      post: () => json({ errors: [{ field: "result", message: "Result must be 2000 characters or fewer" }] }, 400),
    });
    renderStaff();
    await openActionsTab();

    const form = screen.getByRole("form", { name: "Add Action Taken" });
    await userEvent.type(within(form).getByLabelText(/Description/), "Did a thing");
    await userEvent.type(within(form).getByLabelText(/Result/), "x");
    await userEvent.click(within(form).getByRole("button", { name: "Add Action Taken" }));

    expect(await within(form).findByText("Result must be 2000 characters or fewer")).toBeInTheDocument();
  });

  // UI-04
  it("Edit turns a row into a prefilled inline form; Cancel restores the view without a request; Save PATCHes", async () => {
    const fetchMock = setupFetch();
    renderStaff();
    await openActionsTab();

    const [firstEdit] = screen.getAllByRole("button", { name: "Edit this action" });
    await userEvent.click(firstEdit);

    const editForm = screen.getByRole("form", { name: "Edit Action Taken" });
    expect(within(editForm).getByLabelText(/Description/)).toHaveValue("Collected logs from the device");
    expect(within(editForm).getByLabelText(/Result/)).toHaveValue("Logs attached for review");

    await userEvent.click(within(editForm).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form", { name: "Edit Action Taken" })).not.toBeInTheDocument();
    expect(writes(fetchMock, "PATCH")).toHaveLength(0);

    await userEvent.click(screen.getAllByRole("button", { name: "Edit this action" })[0]);
    const again = screen.getByRole("form", { name: "Edit Action Taken" });
    await userEvent.clear(within(again).getByLabelText(/Result/));
    await userEvent.type(within(again).getByLabelText(/Result/), "Logs reviewed");
    await userEvent.click(within(again).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(writes(fetchMock, "PATCH")).toHaveLength(1));
    const [url, init] = writes(fetchMock, "PATCH")[0];
    expect(String(url)).toContain("/api/tickets/1/actions-taken/1");
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent.result).toBe("Logs reviewed");
    expect(sent).not.toHaveProperty("performedById");
    await waitFor(() => expect(screen.queryByRole("form", { name: "Edit Action Taken" })).not.toBeInTheDocument());
  });

  // UI-05
  it("the Requester sees every action, read-only: no create form and no edit control", async () => {
    setupFetch();
    renderRequester();

    expect(await screen.findByText("Collected logs from the device")).toBeInTheDocument();
    expect(screen.getByText("Applied the vendor patch")).toBeInTheDocument();
    expect(screen.getByText("Check again on Friday")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add Action Taken" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit this action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Action Taken" })).not.toBeInTheDocument();
  });

  // UI-06
  it("shows 'No actions recorded yet.' when empty, and a safe error when the list fails to load", async () => {
    setupFetch({ list: () => json({ data: [] }) });
    renderStaff();
    await openActionsTab();
    expect(await screen.findByText("No actions recorded yet.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Actions Taken (0)" })).toBeInTheDocument();
  });

  it("a list load failure shows a safe error with a retry that reloads", async () => {
    let fail = true;
    const fetchMock = setupFetch({ list: () => (fail ? json({ error: "boom" }, 500) : json({ data: ACTIONS })) });
    renderStaff();
    await openActionsTab();

    expect(await screen.findByText("Couldn't load actions taken.")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(document.querySelectorAll(".action-taken-entry")).toHaveLength(2));
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/actions-taken")).length).toBeGreaterThanOrEqual(2);
  });
});
