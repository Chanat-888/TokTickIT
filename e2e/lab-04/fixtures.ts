import type { Browser, Page } from "@playwright/test";
import { login, SEEDED_USERS } from "../lab-03/fixtures.js";

export { DESKTOP, login, logout, MOBILE, SEEDED_USERS, TABLET } from "../lab-03/fixtures.js";

// Creates a brand-new Ticket as Alex Rivera and returns its id. Each spec gets a
// fresh Ticket, so it starts New, unassigned and with no Actions Taken
// whatever earlier specs did to the seeded ones.
export async function createAlexTicketId(browser: Browser): Promise<number> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, SEEDED_USERS.requester.email);
    await page.goto("/tickets/new");
    await page.locator("#ticket-category").selectOption({ index: 1 });
    await page.locator("#ticket-related-system").selectOption({ index: 1 });
    await page.locator("#ticket-summary").fill("Lab 4 screenshot ticket with no actions");
    await page.locator("#ticket-description").fill("Created by the Lab 4 responsive spec to show the empty Actions Taken state.");
    await page.locator('button[type="submit"]').click();
    await page.getByText("View Ticket").click();
    await page.waitForURL(/\/tickets\/\d+$/);
    return Number(page.url().match(/\/tickets\/(\d+)$/)![1]);
  } finally {
    await context.close();
  }
}

export async function openActionsTab(page: Page): Promise<void> {
  await page.getByRole("tab", { name: /Actions Taken/ }).click();
  await page.locator(".actions-taken-panel").waitFor({ state: "visible" });
}

// Confirms the status-change dialog when the target needs one (lab-03 §5).
export async function setStatus(page: Page, target: string): Promise<void> {
  await page.locator('select[aria-label="Status"]').selectOption(target);
  const dialog = page.getByRole("dialog", { name: "Confirm status change" });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: "Confirm" }).click();
  }
}

export async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.scrollWidth <= document.body.clientWidth);
}

// For a failing no-horizontal-scroll check: which elements poke past the viewport.
export async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    return [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > limit + 1)
      .slice(0, 8)
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} in .${String(el.parentElement?.className).split(" ")[0]} "${(el.textContent ?? "").trim().slice(0, 40)}" (${Math.round(el.getBoundingClientRect().right)}px)`,
      );
  });
}
