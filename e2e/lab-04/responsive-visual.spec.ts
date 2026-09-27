import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import {
  createAlexTicketId,
  DESKTOP,
  login,
  logout,
  MOBILE,
  noHorizontalScroll,
  openActionsTab,
  overflowingElements,
  SEEDED_USERS,
  setStatus,
  TABLET,
} from "./fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ui-spec.md §7 — artifacts/lab-04/screenshots/{staff-dashboard,requester-dashboard,actions-taken,ticket-workflow}/
const SCREENSHOTS_DIR = path.join(__dirname, "..", "..", "artifacts", "lab-04", "screenshots");

const VIEWPORTS = [
  { name: "desktop", size: DESKTOP },
  { name: "tablet", size: TABLET },
  { name: "mobile", size: MOBILE },
] as const;

// One capture per breakpoint for a screen state (ui-spec.md §7), asserting the
// page never scrolls horizontally at any of them.
async function shootAll(page: Page, folder: string, state: string): Promise<void> {
  for (const { name, size } of VIEWPORTS) {
    await page.setViewportSize(size);
    expect(await noHorizontalScroll(page), `${folder}/${state} at ${name}: ${(await overflowingElements(page)).join(", ")}`).toBe(true);
    // A scrolled page would put the sticky header mid-way down a full-page capture.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, folder, `${state}-${name}.png`), fullPage: true });
  }
  await page.setViewportSize(DESKTOP);
}

// Grid column count of the metric-card row, read from the browser.
async function cardColumns(page: Page): Promise<number> {
  return page.evaluate(() => {
    const grid = document.querySelector(".dashboard-grid") as HTMLElement;
    return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  });
}

test.beforeEach(async ({ page }) => {
  await logout(page);
});

// RESP-01 — ui-spec.md §5.1: row of cards -> 2 per row -> single column.
test("RESP-01 the staff dashboard reflows from a row of cards to two per row to one column, in every state", async ({
  page,
}) => {
  await login(page, SEEDED_USERS.staff.email);
  await page.goto("/dashboard");
  await expect(page.locator(".metric-card").first()).toBeVisible();

  await page.setViewportSize(DESKTOP);
  expect(await cardColumns(page)).toBeGreaterThanOrEqual(3);
  await page.setViewportSize(TABLET);
  expect(await cardColumns(page)).toBe(2);
  await page.setViewportSize(MOBILE);
  expect(await cardColumns(page)).toBe(1);
  await page.setViewportSize(DESKTOP);

  await shootAll(page, "staff-dashboard", "loaded");

  // Administrator: same dashboard plus the Accounts card.
  await login(page, SEEDED_USERS.admin.email);
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Accounts" })).toBeVisible();
  await shootAll(page, "staff-dashboard", "administrator-accounts");

  // Zero state: Taylor Chen performs no Actions Taken.
  await login(page, "taylor.chen@example.com");
  await page.goto("/dashboard");
  await expect(page.getByText("No actions recorded yet.")).toBeVisible();
  await shootAll(page, "staff-dashboard", "empty-actions");

  // Loading, failure and forbidden states (route-mocked so they are reachable on demand).
  await login(page, SEEDED_USERS.staff.email);
  // A route handler that never answers keeps the request pending.
  await page.route("**/api/dashboard/staff", () => new Promise<void>(() => {}));
  await page.goto("/dashboard");
  await expect(page.getByText("Loading your dashboard…")).toBeVisible();
  await shootAll(page, "staff-dashboard", "loading");
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.route("**/api/dashboard/staff", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Unexpected server error" }) }),
  );
  await page.goto("/dashboard");
  await expect(page.getByText("We couldn't load your dashboard.")).toBeVisible();
  await shootAll(page, "staff-dashboard", "failure");
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.route("**/api/dashboard/staff", (route) =>
    route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Forbidden" }) }),
  );
  await page.goto("/dashboard");
  await expect(page.getByText("You don't have access to the dashboard.")).toBeVisible();
  await shootAll(page, "staff-dashboard", "forbidden");
});

// RESP-02 — ui-spec.md §4.2, same three widths.
test("RESP-02 the Requester dashboard reflows at the same three widths, with and without Tickets", async ({ page }) => {
  await login(page, SEEDED_USERS.requester.email);
  await page.goto("/dashboard");
  await expect(page.locator(".metric-card").first()).toBeVisible();

  await page.setViewportSize(TABLET);
  expect(await cardColumns(page)).toBe(2);
  await page.setViewportSize(MOBILE);
  expect(await cardColumns(page)).toBe(1);
  await page.setViewportSize(DESKTOP);
  await shootAll(page, "requester-dashboard", "loaded");

  await login(page, "priya.nair@example.com");
  await page.goto("/dashboard");
  await expect(page.getByText("No recent activity yet.")).toBeVisible();
  await shootAll(page, "requester-dashboard", "empty");

  await page.route("**/api/dashboard/requester", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Unexpected server error" }) }),
  );
  await page.goto("/dashboard");
  await expect(page.getByText("We couldn't load your dashboard.")).toBeVisible();
  await shootAll(page, "requester-dashboard", "failure");
});

// RESP-03 — ui-spec.md §4.3: list, validation, edit and empty states.
test("RESP-03 the Actions Taken tab has no clipping or horizontal scroll at three widths (list, create, edit, empty)", async ({
  page,
}) => {
  await login(page, SEEDED_USERS.staff.email);

  // A Ticket that already has Actions Taken: the first row of "My Recent Actions Taken".
  await page.goto("/dashboard");
  await page.locator(".list-panel", { hasText: "My Recent Actions Taken" }).locator(".list-panel__row").first().click();
  await page.waitForURL(/\/staff\/tickets\/\d+$/);
  await openActionsTab(page);
  await expect(page.locator(".action-taken-entry").first()).toBeVisible();
  const ticketWithActionsId = Number(page.url().match(/\/staff\/tickets\/(\d+)$/)![1]);
  await shootAll(page, "actions-taken", "list");

  const form = page.getByRole("form", { name: "Add Action Taken" });
  await form.getByLabel("Follow-Up Required?").check();
  await form.getByRole("button", { name: "Add Action Taken" }).click();
  await expect(form.locator(".field__message--error").first()).toBeVisible();
  await shootAll(page, "actions-taken", "create-validation");

  await page.locator(".action-taken-entry").first().getByRole("button", { name: "Edit this action" }).click();
  await expect(page.getByRole("form", { name: "Edit Action Taken" })).toBeVisible();
  await shootAll(page, "actions-taken", "edit");

  // Empty: a Ticket created just now, so nothing has been recorded on it.
  await page.goto(`/staff/tickets/${await createAlexTicketId(page.context().browser()!)}`);
  await openActionsTab(page);
  await expect(page.getByText("No actions recorded yet.")).toBeVisible();
  await shootAll(page, "actions-taken", "empty");

  // Safe failure: the list request fails, so the tab offers a retry instead of an empty list.
  await page.route("**/actions-taken", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Unexpected server error" }) })
      : route.continue(),
  );
  await page.reload();
  await openActionsTab(page);
  await expect(page.getByText("Couldn't load actions taken.")).toBeVisible();
  await shootAll(page, "actions-taken", "failure");
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // Requester read-only view of the same rows.
  await login(page, SEEDED_USERS.requester.email);
  await page.goto(`/tickets/${ticketWithActionsId}`);
  await expect(page.locator(".ticket-detail__actions .action-taken-entry").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit this action" })).toHaveCount(0);
  await shootAll(page, "actions-taken", "requester-read-only");
});

// RESP-04 — ui-spec.md §3: the conflict banner is visible and does not overlap the controls.
test("RESP-04 the conflict banner is visible and clear of the Operations controls at three widths", async ({
  page,
  browser,
}) => {
  const ticketId = await createAlexTicketId(browser);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  try {
    await login(page, SEEDED_USERS.staff.email);
    await page.goto(`/staff/tickets/${ticketId}`);
    await expect(page.locator('select[aria-label="Status"]')).toBeVisible();

    await login(other, SEEDED_USERS.staffTwo.email);
    await other.goto(`/staff/tickets/${ticketId}`);
    await other.getByRole("button", { name: "Claim" }).click();
    await expect(other.locator('select[aria-label="Owner"]')).toBeVisible();

    await setStatus(page, "OPEN");
    const banner = page.locator(".ticket-conflict-banner");
    await expect(banner).toBeVisible();

    for (const { size } of VIEWPORTS) {
      await page.setViewportSize(size);
      const bannerBox = (await banner.boundingBox())!;
      const statusBox = (await page.locator('select[aria-label="Status"]').boundingBox())!;
      const overlaps =
        bannerBox.x < statusBox.x + statusBox.width &&
        statusBox.x < bannerBox.x + bannerBox.width &&
        bannerBox.y < statusBox.y + statusBox.height &&
        statusBox.y < bannerBox.y + bannerBox.height;
      expect(overlaps).toBe(false);
    }
    await shootAll(page, "ticket-workflow", "conflict-banner");
  } finally {
    await otherContext.close();
  }
});
