import { expect, test } from "@playwright/test";
import { createAlexTicketId, login, logout, SEEDED_USERS, setStatus } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await logout(page);
});

// E2E-03 — AC-09, AC-10, BR-18: the Requester's "appears resolved" is advisory;
// Status changes only after IT Staff act, and needs no Action Taken (BR-16).
test("E2E-03 Problem Appears Resolved leaves Status alone; staff then move the Ticket to Resolved", async ({
  page,
  browser,
}) => {
  const ticketId = await createAlexTicketId(browser);

  await login(page, SEEDED_USERS.requester.email);
  await page.goto(`/tickets/${ticketId}`);
  await expect(page.locator(".badge--status-new")).toBeVisible();
  await page.getByRole("button", { name: "Problem Appears Resolved" }).click();
  await expect(page.getByText(/Problem appears resolved — recorded/)).toBeVisible();
  await expect(page.locator(".badge--status-new")).toBeVisible();

  await login(page, SEEDED_USERS.staff.email);
  await page.goto(`/staff/tickets/${ticketId}`);
  await page.getByRole("button", { name: "Claim" }).click();
  await expect(page.locator(".badge--status-new")).toBeVisible();
  for (const target of ["OPEN", "IN_PROGRESS", "RESOLVED"]) {
    await setStatus(page, target);
    await expect(page.locator(`.badge--status-${target.toLowerCase()}`)).toBeVisible();
  }
});

// E2E-04 — AC-08, AC-17: two staff sessions on one Ticket; the second write
// is stale, shows the conflict banner, and succeeds after Refresh.
test("E2E-04 a stale second session gets the conflict banner, and Refresh then retry succeeds", async ({
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

    // The first session still holds the older updatedAt.
    await setStatus(page, "OPEN");
    await expect(page.locator(".ticket-conflict-banner")).toContainText("changed by someone else");
    await expect(page.locator(".badge--status-new")).toBeVisible();

    await page.locator(".ticket-conflict-banner").getByRole("button", { name: "Refresh" }).click();
    await expect(page.locator(".ticket-conflict-banner")).toHaveCount(0);
    await setStatus(page, "OPEN");
    await expect(page.locator(".badge--status-open")).toBeVisible();
  } finally {
    await otherContext.close();
  }
});
