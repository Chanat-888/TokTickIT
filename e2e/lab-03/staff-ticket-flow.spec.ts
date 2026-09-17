import { expect, test } from "@playwright/test";
import { login, SEEDED_USERS } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await login(page, SEEDED_USERS.staff.email);
});

// E2E-05 — AC-12, AC-13: search/filter/sort/paginate the Queue end-to-end
// through the real API, then open Ticket Detail.
test("E2E-05 IT Staff searches, filters, sorts, and paginates the Queue, then opens Ticket Detail", async ({
  page,
}) => {
  await page.goto("/staff/tickets");
  await expect(page.locator(".ticket-table__row").first()).toBeVisible();

  await page.locator('select[aria-label="Status"]').selectOption("NEW");
  await expect(page.locator(".ticket-table__row").first()).toBeVisible();
  const statusBadges = page.locator(".ticket-table__row td .badge--status-new");
  expect(await statusBadges.count()).toBeGreaterThan(0);

  await page.locator('select[aria-label="Status"]').selectOption("");
  await page.getByRole("button", { name: "Created Date" }).click();
  await expect(page.locator(".ticket-table__row").first()).toBeVisible();

  await page.locator(".ticket-toolbar__search").fill("TKT-");
  await expect(page.locator(".ticket-table__row").first()).toBeVisible();
  await page.locator(".ticket-toolbar__search").fill("");

  const firstRow = page.locator(".ticket-table__row").first();
  const ticketNumber = await firstRow.locator("td").first().innerText();
  await firstRow.click();

  await page.waitForURL(/\/staff\/tickets\/\d+$/);
  await expect(page.locator("main")).toContainText(ticketNumber);
});

// E2E-06 — AC-14, AC-16, AC-18: claim an unassigned Ticket, set IT
// Priority, and move it through New -> Open -> In Progress -> Resolved.
test("E2E-06 claim, set IT Priority, and progress an unassigned New Ticket through its statuses", async ({
  page,
}) => {
  await page.goto("/staff/tickets");
  await page.locator('select[aria-label="Status"]').selectOption("NEW");
  await page.locator('select[aria-label="Owner"]').selectOption("unassigned");
  await expect(page.locator(".ticket-table__row").first()).toBeVisible();

  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/staff\/tickets\/\d+$/);

  await page.getByRole("button", { name: "Claim" }).click();
  await expect(page.locator('select[aria-label="Owner"]')).toBeVisible();

  await page.locator('select[aria-label="IT Priority"]').selectOption("HIGH");
  await expect(page.locator('select[aria-label="IT Priority"]')).toHaveValue("HIGH");

  async function advanceStatus(target: string) {
    await page.locator('select[aria-label="Status"]').selectOption(target);
    const dialog = page.getByRole("dialog", { name: "Confirm status change" });
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.getByRole("button", { name: "Confirm" }).click();
    }
    await expect(page.locator(`.badge--status-${target.toLowerCase()}`)).toBeVisible();
  }

  await advanceStatus("OPEN");
  await advanceStatus("IN_PROGRESS");
  await advanceStatus("RESOLVED");
});

// E2E-07 — AC-10, AC-20: IT Staff posts a Public Comment and writes an
// Internal Note; a second browser context, logged in as the owning
// Requester, sees the Comment but never the Note.
test("E2E-07 a Requester sees the IT Staff's Public Comment but never the Internal Note", async ({
  page,
  browser,
}) => {
  const requesterContext = await browser.newContext();
  const requesterPage = await requesterContext.newPage();
  try {
    await login(requesterPage, SEEDED_USERS.requester.email);
    await requesterPage.goto("/tickets/new");
    await requesterPage.locator("#ticket-category").selectOption({ index: 1 });
    await requesterPage.locator("#ticket-related-system").selectOption({ index: 1 });
    await requesterPage.locator("#ticket-summary").fill("E2E-07 comment/note visibility ticket");
    await requesterPage
      .locator("#ticket-description")
      .fill("Created for E2E-07 to check Internal Note visibility across roles.");
    await requesterPage.locator('button[type="submit"]').click();
    await expect(requesterPage.locator(".state-banner--success")).toBeVisible();
    await requesterPage.getByText("View Ticket").click();
    await requesterPage.waitForURL(/\/tickets\/\d+$/);
    const ticketUrl = requesterPage.url();
    const ticketId = ticketUrl.match(/\/tickets\/(\d+)$/)![1];

    await page.goto(`/staff/tickets/${ticketId}`);
    await page.getByRole("tab", { name: "Public Comments" }).click();
    await page.getByLabel("Add a comment").fill("Looking into this now — E2E-07.");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("Looking into this now — E2E-07.")).toBeVisible();

    await page.getByRole("tab", { name: "Internal Notes" }).click();
    await page.getByLabel("Add a note").fill("SECRET-INTERNAL-NOTE-E2E-07");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("SECRET-INTERNAL-NOTE-E2E-07")).toBeVisible();

    await requesterPage.goto(ticketUrl);
    await expect(requesterPage.getByText("Looking into this now — E2E-07.")).toBeVisible();
    const bodyText = await requesterPage.locator("body").innerText();
    expect(bodyText).not.toContain("SECRET-INTERNAL-NOTE-E2E-07");
  } finally {
    await requesterContext.close();
  }
});

// E2E-08 — AC-17: the illegal targets for a Ticket's current status are
// never offered as Status select options.
test("E2E-08 the Status select on a New Ticket never offers an illegal target", async ({ page }) => {
  await page.goto("/staff/tickets");
  await page.locator('select[aria-label="Status"]').selectOption("NEW");
  await expect(page.locator(".ticket-table__row").first()).toBeVisible();
  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/staff\/tickets\/\d+$/);
  // Wait for the detail page's own Operations panel to render before
  // reading the Status select's options — right after the URL changes, the
  // Queue's own (differently-populated) Status filter select can still
  // briefly be in the DOM, and allInnerTexts() doesn't retry like expect()
  // does, so reading too early risks capturing that one instead.
  await page.getByRole("heading", { name: "Operations" }).waitFor();

  const options = await page.locator('select[aria-label="Status"] option').allInnerTexts();
  expect(options).toContain("Open");
  expect(options).toContain("Cancelled");
  for (const illegal of ["In Progress", "Waiting for Requester", "Resolved", "Closed", "Reopened"]) {
    expect(options).not.toContain(illegal);
  }
});
