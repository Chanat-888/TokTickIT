import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "../../src/screens/Login.js";
import { AuthProvider } from "../../src/lib/authContext.js";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

type LoginResponder = () => Response | Promise<Response>;

function setupFetch(loginResponder: LoginResponder) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/auth/me")) return jsonResponse({ error: "Not authenticated" }, 401);
    if (url.includes("/auth/login") && method === "POST") return loginResponder();
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
}

function renderScreen() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<h1>Change Password Screen</h1>} />
          <Route path="/" element={<h1>Home Screen</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const validUser = {
  id: 1,
  name: "Alex Rivera",
  email: "alex@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("Login", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-01
  it("shows busy styling while the login request is pending and blocks a double-submit", async () => {
    let resolveLogin!: (res: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveLogin = resolve;
    });
    const { fetchMock } = setupFetch(() => pending);
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Email/), "alex@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "Password1");

    const submitButton = screen.getByRole("button", { name: "Log In" });
    await userEvent.click(submitButton);

    expect(await screen.findByRole("button", { name: "Logging in…" })).toBeDisabled();

    // A second click while pending must not fire a second request.
    await userEvent.click(screen.getByRole("button", { name: "Logging in…" }));
    const loginCallsBeforeResolve = fetchMock.mock.calls.filter(([url]) => String(url).includes("/auth/login")).length;
    expect(loginCallsBeforeResolve).toBe(1);

    resolveLogin(jsonResponse(validUser));
    await waitFor(() => expect(screen.getByText("Home Screen")).toBeInTheDocument());
  });

  // UI-02
  it("renders the generic invalid-credentials message on a 401", async () => {
    setupFetch(() => jsonResponse({ error: "Invalid email or password" }, 401));
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Email/), "alex@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "WrongPassword1");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  // UI-03
  it("renders the distinct inactive-account message on a 403", async () => {
    setupFetch(() => jsonResponse({ error: "This account is inactive" }, 403));
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Email/), "inactive@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "Password1");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("This account is inactive")).toBeInTheDocument();
  });

  // UI-04
  it("routes to Change Password when mustChangePassword is true", async () => {
    setupFetch(() => jsonResponse({ ...validUser, mustChangePassword: true }));
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Email/), "alex@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "Password1");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Change Password Screen")).toBeInTheDocument();
  });

  it("routes to the home screen when mustChangePassword is false", async () => {
    setupFetch(() => jsonResponse(validUser));
    renderScreen();

    await userEvent.type(await screen.findByLabelText(/^Email/), "alex@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "Password1");
    await userEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByText("Home Screen")).toBeInTheDocument();
  });
});
