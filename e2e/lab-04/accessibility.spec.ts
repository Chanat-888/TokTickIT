import { expect, test, type Locator } from "@playwright/test";
import { createAlexTicketId, login, logout, openActionsTab, SEEDED_USERS, setStatus } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await logout(page);
});

// ui-spec.md §3 / lab-02 §9 — every interactive Lab 4 control shows a visible
// keyboard focus indicator (a solid 2px outline, on the element or, for the
// stretched card link, its ::after overlay).
async function focusOutline(target: Locator, pseudo?: "::after"): Promise<{ style: string; width: number }> {
  await target.page().keyboard.press("Tab"); // put the page in keyboard modality
  await target.focus();
  return target.evaluate((el, p) => {
    const cs = getComputedStyle(el, p ?? null);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  }, pseudo);
}

test("A11Y-01 dashboard cards, status chips and list rows show a visible keyboard focus", async ({ page }) => {
  await login(page, SEEDED_USERS.staff.email);
  await page.goto("/dashboard");
  await expect(page.locator(".metric-card").first()).toBeVisible();

  const card = await focusOutline(page.locator(".metric-card__link").first(), "::after");
  expect(card.style).toBe("solid");
  expect(card.width).toBeGreaterThanOrEqual(2);

  const chip = await focusOutline(page.locator(".status-breakdown__chip").first());
  expect(chip.style).toBe("solid");
  expect(chip.width).toBeGreaterThanOrEqual(2);

  const row = await focusOutline(page.locator(".list-panel__row").first());
  expect(row.style).toBe("solid");
  expect(row.width).toBeGreaterThanOrEqual(2);
});

test("A11Y-02 status is never colour alone, and metric cards keep their number at 0", async ({ page }) => {
  await login(page, SEEDED_USERS.staff.email);
  await page.goto("/dashboard");
  const badges = page.locator(".list-panel .badge");
  await expect(badges.first()).toBeVisible();
  for (const text of await badges.allInnerTexts()) expect(text.trim().length).toBeGreaterThan(0);
  for (const value of await page.locator(".metric-card__value").allInnerTexts()) expect(value).toMatch(/^\d+$/);

  await login(page, SEEDED_USERS.requester.email);
  await page.goto("/tickets/new");
  await login(page, "priya.nair@example.com");
  await page.goto("/dashboard");
  await expect(page.locator(".metric-card__value").first()).toHaveText("0");
});

test("A11Y-03 the Edit action and the conflict Refresh action show a visible keyboard focus", async ({
  page,
  browser,
}) => {
  await login(page, SEEDED_USERS.staff.email);
  await page.goto("/dashboard");
  await page.locator(".list-panel", { hasText: "My Recent Actions Taken" }).locator(".list-panel__row").first().click();
  await page.waitForURL(/\/staff\/tickets\/\d+$/);
  await openActionsTab(page);
  const edit = await focusOutline(page.getByRole("button", { name: "Edit this action" }).first());
  expect(edit.style).toBe("solid");
  expect(edit.width).toBeGreaterThanOrEqual(2);

  const ticketId = await createAlexTicketId(browser);
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  try {
    await page.goto(`/staff/tickets/${ticketId}`);
    await expect(page.locator('select[aria-label="Status"]')).toBeVisible();
    await login(other, SEEDED_USERS.staffTwo.email);
    await other.goto(`/staff/tickets/${ticketId}`);
    await other.getByRole("button", { name: "Claim" }).click();
    await expect(other.locator('select[aria-label="Owner"]')).toBeVisible();

    await setStatus(page, "OPEN");
    const refresh = await focusOutline(page.locator(".ticket-conflict-banner").getByRole("button", { name: "Refresh" }));
    expect(refresh.style).toBe("solid");
    expect(refresh.width).toBeGreaterThanOrEqual(2);
  } finally {
    await otherContext.close();
  }
});
