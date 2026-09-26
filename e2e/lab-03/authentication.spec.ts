import { expect, test } from "@playwright/test";
import { login, logout, SEEDED_USERS, SEED_PASSWORD } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await logout(page);
});

// E2E-01 — AC-01, AC-02, AC-08: a must-change-password seeded user logs in,
// is forced into Change Password, then lands on the role's home screen.
// Uses Morgan Silva (IT Staff) rather than a Requester specifically because
// this test needs an account still at mustChangePassword:true — the global
// dev DB reset happens once per suite run, and lab-02's own specs (which
// run first, alphabetically before lab-03) already log in as every seeded
// Requester at least once, flipping that flag false before this file ever
// runs. No lab-02 spec touches IT Staff/Administrator accounts.
test("E2E-01 login with a must-change-password seeded user forces Change Password, then lands on the Ticket Queue", async ({
  page,
}) => {
  await page.goto("/login");
  await page.locator("#login-email").fill(SEEDED_USERS.staffTwo.email);
  await page.locator("#login-password").fill(SEED_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL("**/change-password");
  await page.locator("#change-password-current").fill(SEED_PASSWORD);
  await page.locator("#change-password-new").fill("ChangedPassword1");
  await page.locator("#change-password-confirm").fill("ChangedPassword1");
  await page.locator('button[type="submit"]').click();

  await page.waitForURL("**/dashboard");
  await expect(page.locator(".dashboard")).toBeVisible();
});

// E2E-02 — AC-05, AC-06: invalid login, then a correct-credentials
// inactive-account login, each with a distinct message.
test("E2E-02 invalid credentials and an inactive account show distinct messages", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-email").fill(SEEDED_USERS.requester.email);
  await page.locator("#login-password").fill("WrongPassword1");
  await page.locator('button[type="submit"]').click();

  const errorBanner = page.locator(".state-banner--error");
  await expect(errorBanner).toBeVisible();
  await expect(errorBanner).toContainText("Invalid email or password");

  await page.locator("#login-email").fill(SEEDED_USERS.requesterInactive.email);
  await page.locator("#login-password").fill(SEED_PASSWORD);
  await page.locator('button[type="submit"]').click();

  await expect(errorBanner).toBeVisible();
  await expect(errorBanner).toContainText("This account is inactive");
});

// E2E-03 — AC-07: logout, then direct navigation to a protected URL.
test("E2E-03 logout then a direct visit to a protected URL redirects to Login", async ({ page }) => {
  await login(page, SEEDED_USERS.staff.email);

  await page.locator("button", { hasText: "Logout" }).click();
  await page.waitForURL("**/login");

  await page.goto("/staff/tickets");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

// E2E-04 — AC-26: a migrated Lab 2 Requester logs in with the documented
// seed password; their pre-existing Tickets (the seed's 25-ticket Alex
// Rivera, standing in for a migrated Lab 2 Requester) are visible.
test("E2E-04 a migrated Requester's pre-existing Tickets are visible in My Tickets after login", async ({
  page,
}) => {
  await login(page, SEEDED_USERS.requester.email);
  // Lab 4: login lands on the Dashboard; My Tickets is one navigation away.
  await page.goto("/tickets");

  await expect(page.locator(".my-tickets")).toBeVisible();
  // At least the seeded 25 — other specs in this same shared, single-worker
  // suite run (e.g. lab-02's own Create Ticket screenshot checklist) also
  // create Tickets for Alex Rivera as a side effect, same reasoning as the
  // "always + N more" comment already on lab-02/requester-ticket-flow.spec.ts's
  // own E2E-06, so an exact count here would be order-dependent and flaky.
  const summaryText = await page.locator(".ticket-list__pagination-summary").innerText();
  const match = summaryText.match(/of (\d+)/);
  expect(match).not.toBeNull();
  expect(Number(match![1])).toBeGreaterThanOrEqual(25);
});
