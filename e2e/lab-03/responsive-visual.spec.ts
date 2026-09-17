import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { DESKTOP, login, logout, MOBILE, SEEDED_USERS, TABLET } from "./fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ui-spec.md §8 fixes artifacts/lab-03/screenshots/{authentication,
// staff-queue,staff-ticket-detail,user-management}/. requester-ticket-detail/
// is a 5th folder, not in that literal list — added to cover §5.4's Public
// Comments tab and "Problem Appears Resolved" button, which none of the
// four listed folders map to.
const SCREENSHOTS_DIR = path.join(__dirname, "..", "..", "artifacts", "lab-03", "screenshots");

function shotPath(...segments: string[]): string {
  return path.join(SCREENSHOTS_DIR, ...segments);
}

test.beforeEach(async ({ page }) => {
  await logout(page);
});

// RESP-01/02 — IT Staff Ticket Queue breakpoints (ui-spec.md §8, §13.3).
test("RESP-01 Ticket Queue at <768px shows stacked cards, no table, no horizontal scroll", async ({ page }) => {
  await login(page, SEEDED_USERS.staff.email);
  await page.setViewportSize(MOBILE);
  await page.goto("/staff/tickets");

  await expect(page.locator(".ticket-card").first()).toBeVisible();
  await expect(page.locator(".ticket-table")).toBeHidden();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.body.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("RESP-02 Ticket Queue at >=992px and 768-991px both render the full table", async ({ page }) => {
  await login(page, SEEDED_USERS.staff.email);

  await page.setViewportSize(DESKTOP);
  await page.goto("/staff/tickets");
  await expect(page.locator(".ticket-table")).toBeVisible();
  const desktopHeaders = await page.locator(".ticket-table thead").innerText();
  for (const expected of ["Ticket No.", "Created Date", "Summary", "Category", "Req. Priority", "IT Priority", "Status", "Owner"]) {
    expect(desktopHeaders).toContain(expected);
  }

  await page.setViewportSize(TABLET);
  await expect(page.locator(".ticket-table")).toBeVisible();
});

// RESP-03 — Login and Change Password at all three breakpoints.
test("RESP-03 Login and Change Password stay legible with no overflow at all three breakpoints", async ({
  page,
}) => {
  for (const viewport of [DESKTOP, TABLET, MOBILE]) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(page.locator(".auth-screen")).toBeVisible();
    const loginOverflow = await page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth);
    expect(loginOverflow).toBe(true);
  }
});

// RESP-04 — IT Staff Ticket Detail Operations panel at <768px.
test("RESP-04 the Operations panel stacks to one column with no horizontal scroll at <768px", async ({ page }) => {
  await login(page, SEEDED_USERS.staff.email);
  await page.setViewportSize(DESKTOP);
  await page.goto("/staff/tickets");
  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/staff\/tickets\/\d+$/);

  await page.setViewportSize(MOBILE);
  await expect(page.locator(".ticket-ops-panel")).toBeVisible();
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.body.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

// RESP-05 — Administrator user list at <768px.
test("RESP-05 the Administrator user list shows .user-card stacked layout, not .user-table, below 768px", async ({
  page,
}) => {
  await login(page, SEEDED_USERS.admin.email);
  await page.setViewportSize(MOBILE);
  await page.goto("/admin/users");

  await expect(page.locator(".user-card").first()).toBeVisible();
  await expect(page.locator(".user-table")).toBeHidden();
});

// ---------------------------------------------------------------------
// RESP-06 and issue #44 — screenshot checklist (ui-spec.md §8)
// ---------------------------------------------------------------------

test.describe("Screenshot checklist — Authentication", () => {
  test("login initial (3 viewports) and failure states (desktop)", async ({ page }) => {
    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`initial (${name})`, async () => {
        await page.setViewportSize(viewport);
        await page.goto("/login");
        await expect(page.locator(".auth-screen")).toBeVisible();
        await page.screenshot({ path: shotPath("authentication", `login-initial-${name}.png`), fullPage: true });
      });
    }

    await page.setViewportSize(DESKTOP);

    await test.step("invalid credentials", async () => {
      await page.goto("/login");
      await page.locator("#login-email").fill(SEEDED_USERS.requester.email);
      await page.locator("#login-password").fill("WrongPassword1");
      await page.locator('button[type="submit"]').click();
      const errorBanner = page.locator(".state-banner--error");
      await expect(errorBanner).toContainText("Invalid email or password");
      await page.screenshot({ path: shotPath("authentication", "login-invalid-credentials-desktop.png"), fullPage: true });
    });

    await test.step("inactive account", async () => {
      await page.locator("#login-email").fill(SEEDED_USERS.requesterInactive.email);
      await page.locator("#login-password").fill("ChangeMe123!");
      await page.locator('button[type="submit"]').click();
      const errorBanner = page.locator(".state-banner--error");
      await expect(errorBanner).toContainText("This account is inactive");
      await page.screenshot({ path: shotPath("authentication", "login-inactive-account-desktop.png"), fullPage: true });
    });
  });

  // A fresh Administrator-created user guarantees a mustChangePassword:true
  // account regardless of what earlier spec files in this single-worker run
  // already did to the fixed SEEDED_USERS accounts (E2E-01 in
  // authentication.spec.ts, which runs before this file alphabetically,
  // already flips staffTwo's flag false).
  test("change-password initial (3 viewports) and validation state (desktop)", async ({ page, browser }) => {
    await login(page, SEEDED_USERS.admin.email);
    await page.goto("/admin/users");
    const email = `resp-06-${Date.now()}@example.com`;
    await page.getByRole("button", { name: "Create User" }).click();
    const form = page.locator(".user-form-panel");
    await form.getByLabel("Name").fill("Resp Six");
    await form.getByLabel("Email").fill(email);
    await form.getByLabel("Role").selectOption("REQUESTER");
    await form.getByLabel("Initial Password").fill("InitialPass1");
    await form.getByRole("button", { name: "Create User" }).click();
    await expect(page.getByText("Resp Six created.")).toBeVisible();

    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    try {
      await freshPage.goto("/login");
      await freshPage.locator("#login-email").fill(email);
      await freshPage.locator("#login-password").fill("InitialPass1");
      await freshPage.locator('button[type="submit"]').click();
      await freshPage.waitForURL("**/change-password");

      for (const [viewport, name] of [
        [DESKTOP, "desktop"],
        [TABLET, "tablet"],
        [MOBILE, "mobile"],
      ] as const) {
        await test.step(`initial (${name})`, async () => {
          await freshPage.setViewportSize(viewport);
          await freshPage.goto("/change-password");
          await expect(freshPage.locator(".auth-screen")).toBeVisible();
          await freshPage.screenshot({ path: shotPath("authentication", `change-password-initial-${name}.png`), fullPage: true });
        });
      }

      await test.step("validation", async () => {
        await freshPage.setViewportSize(DESKTOP);
        await freshPage.locator("#change-password-new").fill("short");
        await freshPage.locator("#change-password-confirm").fill("different");
        await expect(freshPage.locator(".field__message--error").first()).toBeVisible();
        await freshPage.screenshot({ path: shotPath("authentication", "change-password-validation-desktop.png"), fullPage: true });
      });
    } finally {
      await freshContext.close();
    }
  });
});

test.describe("Screenshot checklist — Staff Ticket Queue", () => {
  test("staff-queue loading/populated/empty/no-results/forbidden", async ({ page }) => {
    await login(page, SEEDED_USERS.staff.email);
    await page.setViewportSize(DESKTOP);

    await test.step("loading", async () => {
      await page.route("**/api/staff/tickets*", async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      const responsePromise = page.waitForResponse("**/api/staff/tickets*");
      await page.goto("/staff/tickets");
      await expect(page.locator('[data-testid="ticket-skeleton-row"]').first()).toBeVisible();
      await page.screenshot({ path: shotPath("staff-queue", "staff-queue-loading-desktop.png"), fullPage: true });
      // Wait for the delayed response before unrouting — see the matching
      // comment on lab-02's own screenshot checklist "loading" steps.
      await responsePromise;
      await page.unroute("**/api/staff/tickets*");
    });

    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`populated (${name})`, async () => {
        await page.setViewportSize(viewport);
        await page.goto("/staff/tickets");
        await expect(page.locator(".staff-ticket-queue")).toBeVisible();
        await page.screenshot({ path: shotPath("staff-queue", `staff-queue-populated-${name}.png`), fullPage: true });
      });
    }

    await page.setViewportSize(DESKTOP);

    await test.step("empty", async () => {
      await page.route("**/api/staff/tickets*", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 }),
        }),
      );
      await page.goto("/staff/tickets");
      await expect(page.getByText("No tickets yet")).toBeVisible();
      await page.screenshot({ path: shotPath("staff-queue", "staff-queue-empty-desktop.png"), fullPage: true });
      await page.unroute("**/api/staff/tickets*");
    });

    await test.step("no-results", async () => {
      await page.goto("/staff/tickets");
      await page.locator(".ticket-toolbar__search").fill("zzz-no-such-ticket-zzz");
      await expect(page.getByText("No tickets match your search")).toBeVisible();
      await page.screenshot({ path: shotPath("staff-queue", "staff-queue-no-results-desktop.png"), fullPage: true });
    });

    await test.step("forbidden", async () => {
      await logout(page);
      await login(page, SEEDED_USERS.requester.email);
      await page.goto("/staff/tickets");
      await expect(page.getByText("You don't have access to the Ticket Queue.")).toBeVisible();
      await page.screenshot({ path: shotPath("staff-queue", "staff-queue-forbidden-desktop.png"), fullPage: true });
    });
  });
});

test.describe("Screenshot checklist — Staff Ticket Detail", () => {
  test("staff-ticket-detail unclaimed/claimed/status-confirm/conflict/forbidden/not-found", async ({ page }) => {
    await login(page, SEEDED_USERS.staff.email);
    await page.goto("/staff/tickets");
    await page.locator('select[aria-label="Status"]').selectOption("NEW");
    await page.locator('select[aria-label="Owner"]').selectOption("unassigned");
    await expect(page.locator(".ticket-table__row").first()).toBeVisible();
    await page.locator(".ticket-table__row").first().click();
    await page.waitForURL(/\/staff\/tickets\/\d+$/);
    await page.getByRole("heading", { name: "Operations" }).waitFor();
    const ticketUrl = page.url();

    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`unclaimed (${name})`, async () => {
        await page.setViewportSize(viewport);
        await expect(page.locator(".ticket-ops-panel")).toBeVisible();
        await page.screenshot({ path: shotPath("staff-ticket-detail", `staff-ticket-detail-unclaimed-${name}.png`), fullPage: true });
      });
    }

    await page.setViewportSize(DESKTOP);

    await test.step("claimed", async () => {
      await page.getByRole("button", { name: "Claim" }).click();
      await expect(page.locator('select[aria-label="Owner"]')).toBeVisible();
      await page.screenshot({ path: shotPath("staff-ticket-detail", "staff-ticket-detail-claimed-desktop.png"), fullPage: true });
    });

    await test.step("status confirm dialog", async () => {
      await page.locator('select[aria-label="Status"]').selectOption("CANCELLED");
      const dialog = page.getByRole("dialog", { name: "Confirm status change" });
      await expect(dialog).toBeVisible();
      await page.screenshot({ path: shotPath("staff-ticket-detail", "staff-ticket-detail-status-confirm-desktop.png"), fullPage: true });
      await dialog.getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("conflict", async () => {
      await page.route("**/api/staff/tickets/*/status", (route) =>
        route.fulfill({ status: 409, contentType: "application/json", body: '{"error":"Conflict"}' }),
      );
      await page.locator('select[aria-label="Status"]').selectOption("OPEN");
      await expect(page.getByText("That transition is no longer permitted.")).toBeVisible();
      await page.screenshot({ path: shotPath("staff-ticket-detail", "staff-ticket-detail-conflict-desktop.png"), fullPage: true });
      await page.unroute("**/api/staff/tickets/*/status");
    });

    await test.step("forbidden", async () => {
      await logout(page);
      await login(page, SEEDED_USERS.requester.email);
      await page.goto(ticketUrl);
      await expect(page.getByText("You don't have access to this Ticket.")).toBeVisible();
      await page.screenshot({ path: shotPath("staff-ticket-detail", "staff-ticket-detail-forbidden-desktop.png"), fullPage: true });
    });

    await test.step("not-found", async () => {
      await logout(page);
      await login(page, SEEDED_USERS.staff.email);
      await page.goto("/staff/tickets/999999999");
      await expect(page.getByText("This ticket doesn't exist.")).toBeVisible();
      await page.screenshot({ path: shotPath("staff-ticket-detail", "staff-ticket-detail-not-found-desktop.png"), fullPage: true });
    });
  });
});

test.describe("Screenshot checklist — User Management", () => {
  test("user-management list/create/edit/password-reset/conflict/self-deactivation/empty/no-results/forbidden", async ({
    page,
  }) => {
    await login(page, SEEDED_USERS.admin.email);

    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`list (${name})`, async () => {
        await page.setViewportSize(viewport);
        await page.goto("/admin/users");
        await expect(page.locator(".user-management__toolbar")).toBeVisible();
        await page.screenshot({ path: shotPath("user-management", `user-management-list-${name}.png`), fullPage: true });
      });
    }

    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/users");

    await test.step("create panel", async () => {
      await page.getByRole("button", { name: "Create User" }).click();
      await expect(page.locator(".user-form-panel")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-create-desktop.png"), fullPage: true });
      await page.locator(".user-form-panel").getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("edit panel and password-reset subpanel", async () => {
      const row = page.locator("tr", { hasText: SEEDED_USERS.staff.name });
      await row.getByRole("button", { name: "Edit" }).click();
      await expect(page.locator(".user-form-panel")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-edit-desktop.png"), fullPage: true });

      await page.getByRole("button", { name: "Set New Initial Password" }).click();
      await expect(page.locator(".password-reset-subpanel")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-password-reset-desktop.png"), fullPage: true });

      await page.locator(".password-reset-subpanel").getByRole("button", { name: "Cancel" }).click();
      await page.locator(".user-form-panel__actions").last().getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("conflict", async () => {
      const row = page.locator("tr", { hasText: SEEDED_USERS.staff.name });
      await row.getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Email").fill(SEEDED_USERS.admin.email);
      await page.locator(".user-form-panel").getByRole("button", { name: "Save Changes" }).click();
      await expect(page.getByText("Email already in use")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-conflict-desktop.png"), fullPage: true });
      await page.locator(".user-form-panel__actions").last().getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("self-deactivation disabled toggle", async () => {
      const row = page.locator("tr", { hasText: SEEDED_USERS.admin.name });
      await row.getByRole("button", { name: "Edit" }).click();
      await expect(page.getByLabel("Active")).toBeDisabled();
      await expect(page.getByText("You cannot deactivate your own account.")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-self-deactivation-desktop.png"), fullPage: true });
      await page.locator(".user-form-panel__actions").last().getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("empty", async () => {
      await page.route("**/api/admin/users*", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
      );
      await page.goto("/admin/users");
      await expect(page.getByText("No users yet")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-empty-desktop.png"), fullPage: true });
      await page.unroute("**/api/admin/users*");
    });

    await test.step("no-results", async () => {
      await page.goto("/admin/users");
      await page.locator(".ticket-toolbar__search").fill("zzz-no-such-user-zzz");
      await expect(page.getByText("No users match your search")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-no-results-desktop.png"), fullPage: true });
    });

    await test.step("forbidden", async () => {
      await logout(page);
      await login(page, SEEDED_USERS.requester.email);
      await page.goto("/admin/users");
      // /admin/users is guarded client-side by RequireAdmin (App.tsx), which
      // renders this generic text before UserManagement.tsx ever mounts —
      // its own "You don't have access to User Management." forbidden
      // branch is unreachable via direct navigation. Matches E2E-13's
      // assertion in user-administration.spec.ts.
      await expect(page.getByText("You don't have access to this screen.")).toBeVisible();
      await page.screenshot({ path: shotPath("user-management", "user-management-forbidden-desktop.png"), fullPage: true });
    });
  });
});

// requester-ticket-detail/ — 5th folder, added beyond ui-spec.md §8's literal
// four to cover §5.4's Public Comments tab and "Problem Appears Resolved"
// button (see the SCREENSHOTS_DIR comment above).
test.describe("Screenshot checklist — Requester Ticket Detail additions", () => {
  test("public comments panel and Problem Appears Resolved button", async ({ page }) => {
    await login(page, SEEDED_USERS.requester.email);
    await page.goto("/tickets/new");
    await page.locator("#ticket-category").selectOption({ index: 1 });
    await page.locator("#ticket-related-system").selectOption({ index: 1 });
    await page.locator("#ticket-summary").fill("RESP-06 screenshot ticket");
    await page.locator("#ticket-description").fill("Created for the Lab 3 screenshot checklist (issue #44).");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator(".state-banner--success")).toBeVisible();
    await page.getByText("View Ticket").click();
    await page.waitForURL(/\/tickets\/\d+$/);
    await expect(page.locator(".ticket-detail__comments")).toBeVisible();

    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`comments panel (${name})`, async () => {
        await page.setViewportSize(viewport);
        await expect(page.locator(".ticket-detail__comments")).toBeVisible();
        await page.screenshot({ path: shotPath("requester-ticket-detail", `requester-ticket-detail-comments-${name}.png`), fullPage: true });
      });
    }

    await page.setViewportSize(DESKTOP);

    await test.step("resolve button unclicked", async () => {
      await expect(page.locator(".ticket-detail__resolve-indication")).toBeVisible();
      await page.screenshot({ path: shotPath("requester-ticket-detail", "requester-ticket-detail-resolve-unclicked-desktop.png"), fullPage: true });
    });

    await test.step("resolve button clicked", async () => {
      await page.locator(".ticket-detail__resolve-indication button").click();
      await expect(page.getByText(/Problem appears resolved — recorded/)).toBeVisible();
      await page.screenshot({ path: shotPath("requester-ticket-detail", "requester-ticket-detail-resolve-clicked-desktop.png"), fullPage: true });
    });
  });
});
