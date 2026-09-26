import type { Page } from "@playwright/test";

// ui-spec.md §8 breakpoints (labsheet §8.7).
export const DESKTOP = { width: 1280, height: 800 };
export const TABLET = { width: 820, height: 1180 };
export const MOBILE = { width: 390, height: 844 };

// docs/lab-03/specification.md BR-15 removed the Development Requester
// selector and X-Requester-Id header entirely, replacing "pick a Requester"
// with real login. selectRequester keeps its name/signature (every lab-02
// spec calls it the same way) but now logs in as the named seeded
// Requester through the real /login + forced Change Password flow instead
// — the "unmodified" regression re-run (specification.md §10) is about the
// spec bodies' assertions on Ticket behavior, not this fixture, which has
// to follow wherever the app under test actually put the login gate.
const SEED_PASSWORD = "ChangeMe123!";
// Fixed password this fixture leaves an account at after its first
// first-login-forces-change flow within a given Playwright run (global
// setup truncates+reseeds User before every run, so every account starts
// at SEED_PASSWORD/mustChangePassword:true — but a later call for the same
// Requester within the same run finds the password already changed).
const CHANGED_PASSWORD = "ChangedPassword1";

const REQUESTER_EMAILS: Record<string, string> = {
  "Alex Rivera": "alex.rivera@example.com",
  "Sam Okafor": "sam.okafor@example.com",
  "Priya Nair": "priya.nair@example.com",
  "Dana Lim": "dana.lim@example.com",
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

// Logs in as the named seeded Requester (matching Alex Rivera / Sam Okafor
// / Priya Nair / Dana Lim), completing the forced Change Password step on
// first login this run, and waits for navigation to /tickets. Always clears
// any existing session cookie first — LoginRoute redirects an already-
// authenticated visit to /login straight back to "/", so calling this
// mid-test to switch Requesters would otherwise never see the form.
export async function selectRequester(page: Page, name: string): Promise<void> {
  const email = REQUESTER_EMAILS[name];
  if (!email) throw new Error(`No seeded Requester named "${name}"`);

  await page.context().clearCookies();

  let ok = await attemptLogin(page, email, SEED_PASSWORD);
  if (!ok) {
    // The seed password was rejected — an earlier call this run already
    // changed it. Retry with the fixed post-change password instead.
    ok = await attemptLogin(page, email, CHANGED_PASSWORD);
  }
  if (!ok) {
    throw new Error(`selectRequester() failed to log in as ${name} with both known passwords`);
  }

  if (page.url().includes("/change-password")) {
    await page.locator("#change-password-current").fill(SEED_PASSWORD);
    await page.locator("#change-password-new").fill(CHANGED_PASSWORD);
    await page.locator("#change-password-confirm").fill(CHANGED_PASSWORD);
    await page.locator('button[type="submit"]').click();
  }

  // Lab 4 — every role now lands on its Dashboard; the Lab 2 flows start from My Tickets.
  await page.waitForURL("**/dashboard");
  await page.goto("/tickets");
}

// Logs out (session cookie cleared) and lands back on /login — the
// equivalent of the old "clear the selected Requester" starting state, now
// that identity comes from a real session instead of sessionStorage.
export async function clearRequester(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
}
