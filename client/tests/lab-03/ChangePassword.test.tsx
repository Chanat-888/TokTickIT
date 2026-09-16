import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ChangePassword from "../../src/screens/ChangePassword.js";
import { AuthProvider } from "../../src/lib/authContext.js";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const currentUser = {
  id: 1,
  name: "Alex Rivera",
  email: "alex@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: true,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

type ChangeResponder = () => Response | Promise<Response>;

function setupFetch(changeResponder: ChangeResponder) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/auth/me")) return jsonResponse(currentUser);
    if (url.includes("/auth/change-password") && method === "POST") return changeResponder();
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/change-password"]}>
        <Routes>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/" element={<h1>Home Screen</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("ChangePassword", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-05
  it("updates the inline validation message live as the New Password field is typed", async () => {
    setupFetch(() => jsonResponse(currentUser));
    renderScreen();

    const newPasswordField = await screen.findByLabelText(/^New Password/);
    await userEvent.type(newPasswordField, "short");
    expect(
      await screen.findByText("Password must be at least 8 characters and include a letter and a digit"),
    ).toBeInTheDocument();

    await userEvent.type(newPasswordField, "1234");
    await waitFor(() => {
      expect(
        screen.queryByText("Password must be at least 8 characters and include a letter and a digit"),
      ).not.toBeInTheDocument();
    });
  });

  // UI-06
  it("blocks submit client-side on a Confirm Password mismatch and sends no request", async () => {
    const { fetchMock } = setupFetch(() => jsonResponse(currentUser));
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Current Password/), "OldPassword1");
    await userEvent.type(screen.getByLabelText(/^New Password/), "NewPassword1");
    await userEvent.type(screen.getByLabelText(/^Confirm New Password/), "Mismatch1");

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save New Password" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Save New Password" }));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/auth/change-password"))).toBe(false);
  });

  // UI-07
  it("routes directly into the home screen on a successful change, with no extra confirmation screen", async () => {
    setupFetch(() => jsonResponse({ ...currentUser, mustChangePassword: false }));
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Current Password/), "OldPassword1");
    await userEvent.type(screen.getByLabelText(/^New Password/), "NewPassword1");
    await userEvent.type(screen.getByLabelText(/^Confirm New Password/), "NewPassword1");
    await userEvent.click(screen.getByRole("button", { name: "Save New Password" }));

    expect(await screen.findByText("Home Screen")).toBeInTheDocument();
  });

  it("shows the server's error message on a 401 (wrong current password)", async () => {
    setupFetch(() => jsonResponse({ error: "Current password is incorrect" }, 401));
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Current Password/), "WrongPassword1");
    await userEvent.type(screen.getByLabelText(/^New Password/), "NewPassword1");
    await userEvent.type(screen.getByLabelText(/^Confirm New Password/), "NewPassword1");
    await userEvent.click(screen.getByRole("button", { name: "Save New Password" }));

    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
  });
});
