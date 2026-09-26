import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { login, logout, SEEDED_USERS } from "./fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "..", "lab-02", "fixtures", "sample.pdf");

test.beforeEach(async ({ page }) => {
  await logout(page);
});

async function cardValue(page: Page, name: string): Promise<number> {
  const text = await page.getByRole("region", { name }).locator(".metric-card__value").innerText();
  return Number(text);
}

async function listTotal(page: Page): Promise<number> {
  const text = await page.locator("main").getByText(/Showing .* of \d+/).innerText();
  return Number(text.match(/of (\d+)/)![1]);
}

// E2E-05 — AC-11, BR-25: a count card opens the Queue with the same filter.
test("E2E-05 the Unassigned and My Assigned cards open the Queue pre-filtered with a matching count", async ({
  page,
}) => {
  await login(page, SEEDED_USERS.staff.email);

  for (const name of ["Unassigned", "My Assigned"]) {
    await page.goto("/dashboard");
    const expected = await cardValue(page, name);
    expect(expected).toBeGreaterThan(0);
    await page.getByRole("link", { name: `View all: ${name}` }).click();
    await page.waitForURL(/\/staff\/tickets\?/);
    await expect(page.locator(".ticket-table__row").first()).toBeVisible();
    expect(await listTotal(page)).toBe(expected);
  }
});

// E2E-06 — AC-02, AC-13: values match the list they drill into; a Requester
// with zero Tickets sees zeros and empty states.
test("E2E-06 Requester dashboard values match My Tickets, and a Requester with no Tickets sees zeros", async ({
  page,
}) => {
  await login(page, SEEDED_USERS.requester.email);
  await page.goto("/dashboard");
  const open = await cardValue(page, "My Open Tickets");
  expect(open).toBeGreaterThan(0);
  await page.getByRole("link", { name: "View all: My Open Tickets" }).click();
  await page.waitForURL(/\/tickets\?status=/);
  await expect(page.locator(".ticket-table__row").first()).toBeVisible();
  expect(await listTotal(page)).toBe(open);

  await login(page, "priya.nair@example.com");
  await page.goto("/dashboard");
  expect(await cardValue(page, "My Open Tickets")).toBe(0);
  expect(await cardValue(page, "Waiting for Requester")).toBe(0);
  await expect(page.getByText("No recent activity yet.")).toBeVisible();
  await expect(page.getByText("No resolved tickets yet.")).toBeVisible();
});

// E2E-07 — AC-16, FR-12: Lab 1-3 flows still work after the Lab 4 changes.
test("E2E-07 representative Lab 1-3 flows still work", async ({ page, browser }) => {
  await login(page, SEEDED_USERS.requester.email);
  await page.goto("/");
  await page.waitForURL("**/dashboard");
  await page.getByRole("link", { name: "My Tickets" }).click();
  await page.waitForURL("**/tickets");
  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/tickets\/\d+$/);
  const ticketPath = new URL(page.url()).pathname;

  // attachment upload
  await page.locator(".ticket-detail__attachments button", { hasText: "Add Attachment" }).click();
  await page.locator('input[aria-label="Attachments"]').setInputFiles(SAMPLE_PDF);
  await page.locator(".ticket-detail__attachments button", { hasText: "Upload" }).click();
  await expect(page.locator(".attachment-item--active", { hasText: "sample.pdf" }).last()).toBeVisible();

  // Requester public comment
  const comment = `E2E regression comment ${Date.now()}`;
  await page.getByLabel("Add a comment").fill(comment);
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(comment)).toBeVisible();

  // staff: internal note on the same Ticket, which the Requester never sees
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  try {
    await login(staffPage, SEEDED_USERS.staff.email);
    await staffPage.goto(ticketPath.replace("/tickets/", "/staff/tickets/"));
    await staffPage.getByRole("tab", { name: "Internal Notes" }).click();
    const note = `E2E regression note ${Date.now()}`;
    await staffPage.getByLabel("Add a note").fill(note);
    await staffPage.getByRole("button", { name: "Post" }).click();
    await expect(staffPage.getByText(note)).toBeVisible();
    await page.reload();
    await expect(page.getByText(note)).toHaveCount(0);
  } finally {
    await staff.close();
  }

  // Administrator user management
  await login(page, SEEDED_USERS.admin.email);
  await page.goto("/admin/users");
  await expect(page.getByText(SEEDED_USERS.staff.name).first()).toBeVisible();
});
