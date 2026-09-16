import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Badge from "../../../src/components/Badge.js";
import AppShell from "../../../src/components/AppShell.js";
import { AuthProvider } from "../../../src/lib/authContext.js";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const adminUser = {
  id: 1,
  name: "Robin Park",
  email: "robin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("Badge / role-badge style", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // STYLE-01 — app shell.
  it(".role-badge is present in the app shell with the correct role text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/auth/me")) return jsonResponse(adminUser);
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(
      <AuthProvider>
        <MemoryRouter>
          <AppShell>
            <p>content</p>
          </AppShell>
        </MemoryRouter>
      </AuthProvider>,
    );

    const badge = await screen.findByText("Administrator");
    expect(badge).toHaveClass("role-badge");
  });

  // STYLE-01 — badge component itself, as used on ticket priority/status
  // badges (role-badge on the User list is covered by UserManagement.test.tsx
  // UI-18; this file's job is the class name, not the whole screen).
  it(".priority-badge and .status-badge classes render via the shared Badge component", () => {
    const { container: priorityContainer } = render(<Badge kind="priority" value="HIGH" />);
    expect(priorityContainer.querySelector(".badge.badge--priority-high")).not.toBeNull();

    const { container: statusContainer } = render(<Badge kind="status" value="OPEN" />);
    expect(statusContainer.querySelector(".badge.badge--status-open")).not.toBeNull();
  });

  // STYLE-02
  it(".status-badge--terminal is present on Closed/Cancelled and absent on non-terminal statuses", () => {
    const { container: closedContainer } = render(<Badge kind="status" value="CLOSED" />);
    expect(closedContainer.querySelector(".status-badge--terminal")).not.toBeNull();

    const { container: cancelledContainer } = render(<Badge kind="status" value="CANCELLED" />);
    expect(cancelledContainer.querySelector(".status-badge--terminal")).not.toBeNull();

    const { container: openContainer } = render(<Badge kind="status" value="OPEN" />);
    expect(openContainer.querySelector(".status-badge--terminal")).toBeNull();

    const { container: resolvedContainer } = render(<Badge kind="status" value="RESOLVED" />);
    expect(resolvedContainer.querySelector(".status-badge--terminal")).toBeNull();
  });

  // STYLE-03
  it(".priority-badge--it is present on the IT Priority badge, rendered after Requested Priority in DOM order", () => {
    const { container } = render(
      <div>
        <Badge kind="priority" value="MEDIUM" />
        <Badge kind="priority" value="HIGH" itPriority />
      </div>,
    );

    const badges = container.querySelectorAll(".badge");
    expect(badges).toHaveLength(2);
    expect(badges[0]).not.toHaveClass("priority-badge--it");
    expect(badges[1]).toHaveClass("priority-badge--it");
  });
});
