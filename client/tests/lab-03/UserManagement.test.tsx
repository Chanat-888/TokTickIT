import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserManagement from "../../src/screens/UserManagement.js";
import { AuthProvider } from "../../src/lib/authContext.js";

const adminUser = {
  id: 99,
  name: "Robin Park",
  email: "robin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function makeUser(overrides: Partial<typeof adminUser> & { id: number }) {
  return {
    name: "Jordan Blake",
    email: "jordan@example.com",
    role: "IT_STAFF",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const baseUsers = [
  makeUser({ id: 1, name: "Jordan Blake", email: "jordan@example.com", role: "IT_STAFF" }),
  makeUser({ id: 2, name: "Alex Rivera", email: "alex@example.com", role: "REQUESTER" }),
  makeUser({ id: 5, name: "Only Admin", email: "only-admin@example.com", role: "ADMINISTRATOR", isActive: true }),
];

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function setupFetch(
  options: {
    users?: typeof baseUsers;
    createResponder?: () => Response | Promise<Response>;
    patchResponder?: () => Response | Promise<Response>;
  } = {},
) {
  const users = options.users ?? baseUsers;

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/auth/me")) return jsonResponse(adminUser);

    if (url.includes("/api/admin/users") && !url.match(/\/api\/admin\/users\/\d+/) && method === "GET") {
      const parsed = new URL(url, "http://localhost");
      const search = parsed.searchParams.get("search");
      const role = parsed.searchParams.get("role");
      let data = users;
      if (search) {
        data = data.filter(
          (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
        );
      }
      if (role) {
        data = data.filter((u) => u.role === role);
      }
      return jsonResponse({ data });
    }

    if (url.includes("/api/admin/users") && method === "POST" && !url.includes("/password")) {
      if (options.createResponder) return options.createResponder();
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ id: 999, ...body, mustChangePassword: true }, 201);
    }

    if (url.match(/\/api\/admin\/users\/\d+$/) && method === "PATCH") {
      if (options.patchResponder) return options.patchResponder();
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ ...users[0], ...body });
    }

    if (url.includes("/password") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse({ ...users[0], mustChangePassword: true, __newPassword: body.newPassword });
    }

    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return { fetchMock };
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route path="/admin/users" element={<UserManagement />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

// The desktop `.user-table` and mobile `.user-card-list` both render at
// once in jsdom (the collapse is CSS-only, unlike a real viewport), so a
// name appears twice — pick the `<tr>` match specifically, same pattern as
// StaffTicketQueue.test.tsx.
async function findRow(name: string) {
  const matches = await screen.findAllByText(name);
  const row = matches.map((el) => el.closest("tr")).find((tr): tr is HTMLTableRowElement => tr !== null);
  if (!row) throw new Error(`No table row found for "${name}"`);
  return row;
}

describe("UserManagement", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-18
  it("renders the user list with Name, Email, Role badge, Status pill, and an Edit action per row", async () => {
    setupFetch();
    renderScreen();

    const row = await findRow("Jordan Blake");
    expect(within(row).getByText("jordan@example.com")).toBeInTheDocument();
    expect(within(row).getByText("IT Staff")).toBeInTheDocument();
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  // UI-19
  it("typing in the search box triggers a filtered query and results update", async () => {
    const { fetchMock } = setupFetch();
    renderScreen();

    expect((await screen.findAllByText("Jordan Blake")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alex Rivera").length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText("Search"), "jordan");

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(calls.some((u) => u.includes("/api/admin/users") && u.includes("search=jordan"))).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryAllByText("Alex Rivera")).toHaveLength(0);
    });
    expect(screen.getAllByText("Jordan Blake").length).toBeGreaterThan(0);
  });

  // UI-20
  it("on a 409 from the Create form, an inline message renders beside the Email field and form values are preserved", async () => {
    setupFetch({ createResponder: () => jsonResponse({ error: "Email already in use" }, 409) });
    renderScreen();

    await screen.findAllByText("Jordan Blake");
    await userEvent.click(screen.getByRole("button", { name: "Create User" }));

    // Field's required marker ("*") is appended inside the label text, so
    // required fields need a prefix match (same convention as
    // tests/lab-02/CreateTicketForm.test.tsx).
    const form = screen.getByRole("form", { name: "Create User" });
    await userEvent.type(within(form).getByLabelText(/^Name/), "Sam Okafor");
    await userEvent.type(within(form).getByLabelText(/^Email/), "taken@example.com");
    await userEvent.type(within(form).getByLabelText(/^Initial Password/), "Password1");

    await userEvent.click(within(form).getByRole("button", { name: "Create User" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Sam Okafor");
    expect(screen.getByLabelText(/^Email/)).toHaveValue("taken@example.com");
  });

  // UI-21
  it("the currently-authenticated Administrator's own row renders a disabled Active toggle with an explanatory message", async () => {
    const users = [...baseUsers, makeUser({ id: 99, name: "Robin Park", email: "robin@example.com", role: "ADMINISTRATOR" })];
    setupFetch({ users });
    renderScreen();

    const row = await findRow("Robin Park");
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const toggle = await screen.findByLabelText("Active");
    expect(toggle).toBeDisabled();
    expect(screen.getByText("You cannot deactivate your own account.")).toBeInTheDocument();
  });

  // UI-22
  it("the sole active Administrator's row, viewed by a different Admin, renders a disabled Active toggle with an explanatory message", async () => {
    setupFetch();
    renderScreen();

    const row = await findRow("Only Admin");
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    const toggle = await screen.findByLabelText("Active");
    expect(toggle).toBeDisabled();
    expect(screen.getByText("At least one active Administrator is required.")).toBeInTheDocument();
  });

  // UI-23
  it('"Set New Initial Password" opens a separate sub-panel, distinct from the edit form', async () => {
    setupFetch();
    renderScreen();

    const row = await findRow("Jordan Blake");
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));

    expect(screen.queryByRole("dialog", { name: "Set new initial password" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Set New Initial Password" }));

    const subpanel = await screen.findByRole("dialog", { name: "Set new initial password" });
    expect(within(subpanel).getByLabelText(/^New Initial Password/)).toBeInTheDocument();
    // Distinct from the edit form's own fields.
    expect(within(subpanel).queryByLabelText(/^Name/)).not.toBeInTheDocument();
  });
});
