import { expect, test } from "@playwright/test";
import { DESKTOP, login, logout, MOBILE, SEEDED_USERS, TABLET } from "./fixtures.js";

// RESP-06 (the full screenshot checklist against every path in
// ui-spec.md §8) is scoped to issue #44 "Lab 3: Screenshots and visual
// inspection" (lab3_plan.md Phase 10), not this file — this covers the
// functional breakpoint assertions (RESP-01 through RESP-05) only.

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
