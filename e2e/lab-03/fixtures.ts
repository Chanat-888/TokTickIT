import type { Page } from "@playwright/test";

// ui-spec.md §8 breakpoints (labsheet §8.7) — same values as lab-02's own
// fixtures.ts; duplicated rather than imported since lab-02's file is
// Requester-selector-flow-specific (selectRequester/clearRequester) and
// this file's login() is role-agnostic.
export const DESKTOP = { width: 1280, height: 800 };
export const TABLET = { width: 820, height: 1180 };
export const MOBILE = { width: 390, height: 844 };

// specification.md §11.9 — every seeded account starts here, forced to
// change it at first login (mustChangePassword). global-setup.ts
// truncates+reseeds User before every run, so this is always valid at the
// start of a run for every account.
export const SEED_PASSWORD = "ChangeMe123!";
// Fixed password login() leaves an account at after completing its first
// forced Change Password this run — a later call for the same account
// within the same run finds SEED_PASSWORD already rejected and falls back
// to this one instead.
const CHANGED_PASSWORD = "ChangedPassword1";

export const SEEDED_USERS = {
  requester: { name: "Alex Rivera", email: "alex.rivera@example.com" },
  requesterInactive: { name: "Chris Boonmee", email: "chris.boonmee@example.com" },
  staff: { name: "Jordan Blake", email: "jordan.blake@example.com" },
  staffTwo: { name: "Morgan Silva", email: "morgan.silva@example.com" },
  admin: { name: "Robin Park", email: "robin.park@example.com" },
};

async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator('button[type="submit"]').click();
}

// A failed login never navigates at all — the SPA shows an inline error in
// place, so page.waitForURL alone hangs until its timeout instead of
// detecting the failure. Race the URL change against the error banner
// appearing, and report which one happened.
async function attemptLogin(page: Page, email: string, password: string): Promise<boolean> {
  await submitLogin(page, email, password);
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith("/login")),
    page.locator(".state-banner--error").waitFor({ state: "visible" }),
  ]);
  return !page.url().includes("/login");
}

// Logs in as the given seeded account's email, self-healing across repeat
// calls within the same run (see CHANGED_PASSWORD above), and completes
// the forced Change Password step transparently, landing on the role's
// home screen (My Tickets for Requester, Ticket Queue for IT Staff/Admin).
// Always clears any existing session cookie first — LoginRoute redirects an
// already-authenticated visit to /login straight back to "/", so calling
// this mid-test to switch accounts would otherwise never see the form.
export async function login(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();

  let ok = await attemptLogin(page, email, SEED_PASSWORD);
  if (!ok) {
    // SEED_PASSWORD was rejected — an earlier call this run already changed
    // it. Retry with the fixed post-change password instead.
    ok = await attemptLogin(page, email, CHANGED_PASSWORD);
  }
  if (!ok) {
    throw new Error(`login() failed for ${email} with both known passwords`);
  }

  if (page.url().includes("/change-password")) {
    await page.locator("#change-password-current").fill(SEED_PASSWORD);
    await page.locator("#change-password-new").fill(CHANGED_PASSWORD);
    await page.locator("#change-password-confirm").fill(CHANGED_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith("/change-password"));
  }
}

export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
}
