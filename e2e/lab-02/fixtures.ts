import type { Page } from "@playwright/test";

// ui-spec.md §8 breakpoints (labsheet §8.7).
export const DESKTOP = { width: 1280, height: 800 };
export const TABLET = { width: 820, height: 1180 };
export const MOBILE = { width: 390, height: 844 };

// Navigates to /select-requester, picks the named Requester (matching the
// seed's Alex Rivera / Sam Okafor / Priya Nair / Dana Lim names), clicks
// Continue, and waits for navigation to /tickets.
export async function selectRequester(page: Page, name: string): Promise<void> {
  await page.goto("/select-requester");
  await page.locator(".requester-select__dropdown").selectOption({ label: name });
  await page.locator(".requester-select__continue-btn").click();
  await page.waitForURL("**/tickets");
}

// Clears sessionStorage directly — faster than clicking through the UI when
// a test just needs a clean starting state, not to exercise the Change
// Requester control itself (that control is exercised directly by E2E-06).
export async function clearRequester(page: Page): Promise<void> {
  await page.goto("/select-requester");
  await page.evaluate(() => window.sessionStorage.clear());
}
