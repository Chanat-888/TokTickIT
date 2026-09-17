import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserManagement from "../../../src/screens/UserManagement.js";
import { AuthProvider } from "../../../src/lib/authContext.js";

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

const users = [
  {
    id: 1,
    name: "Jordan Blake",
    email: "jordan@example.com",
    role: "IT_STAFF",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function setupFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/auth/me")) return jsonResponse(adminUser);
      if (url.includes("/api/admin/users")) return jsonResponse({ data: users });
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
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

// STYLE-07 — the markup for both breakpoints always exists in the rendered
// DOM (CSS controls which is visible per viewport); RESP-05 in
// e2e/lab-03/responsive-visual.spec.ts is what actually exercises the
// breakpoint in a real browser. This file only asserts the classes exist.
describe("Administrator user list style", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it(".user-table is present", async () => {
    setupFetch();
    const { container } = renderScreen();

    await screen.findAllByText("Jordan Blake");
    expect(container.querySelector(".user-table")).not.toBeNull();
  });

  it(".user-card is present", async () => {
    setupFetch();
    const { container } = renderScreen();

    await screen.findAllByText("Jordan Blake");
    expect(container.querySelector(".user-card-list .user-card")).not.toBeNull();
  });
});
