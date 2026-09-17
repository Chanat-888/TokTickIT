import { expect, test } from "@playwright/test";
import { login, logout, SEEDED_USERS } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await login(page, SEEDED_USERS.admin.email);
  await page.goto("/admin/users");
});

// E2E-09 — AC-08, FR-17: an Administrator creates a user; that user's
// first login is forced into Change Password.
test("E2E-09 a user created by the Administrator is forced into Change Password on first login", async ({
  page,
  browser,
}) => {
  const email = `e2e-09-${Date.now()}@example.com`;

  await page.getByRole("button", { name: "Create User" }).click();
  const form = page.locator(".user-form-panel");
  await form.getByLabel("Name").fill("E2E Nine");
  await form.getByLabel("Email").fill(email);
  // The toolbar's Role *filter* select shares the same "Role" label text —
  // must scope to the form, or getByLabel resolves to both.
  await form.getByLabel("Role").selectOption("REQUESTER");
  await form.getByLabel("Initial Password").fill("InitialPass1");
  await form.getByRole("button", { name: "Create User" }).click();

  await expect(page.getByText("E2E Nine created.")).toBeVisible();

  const newUserContext = await browser.newContext();
  const newUserPage = await newUserContext.newPage();
  try {
    await newUserPage.goto("/login");
    await newUserPage.locator("#login-email").fill(email);
    await newUserPage.locator("#login-password").fill("InitialPass1");
    await newUserPage.locator('button[type="submit"]').click();
    await newUserPage.waitForURL("**/change-password");
    expect(newUserPage.url()).toContain("/change-password");
  } finally {
    await newUserContext.close();
  }
});

// E2E-10 — AC-22: editing a user to an email already in use shows an
// inline 409 message and does not navigate away from the form.
test("E2E-10 editing a user to an email already in use shows an inline message and stays on the form", async ({
  page,
}) => {
  const row = page.locator("tr", { hasText: SEEDED_USERS.staff.name });
  await row.getByRole("button", { name: "Edit" }).click();

  await page.getByLabel("Email").fill(SEEDED_USERS.admin.email);
  await page.locator(".user-form-panel").getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByText("Email already in use")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(page.url()).toContain("/admin/users");
});

// E2E-11 — AC-23: an Administrator attempting to deactivate their own
// account is rejected client-side; the account stays active.
test("E2E-11 an Administrator cannot deactivate their own account", async ({ page }) => {
  const row = page.locator("tr", { hasText: SEEDED_USERS.admin.name });
  await row.getByRole("button", { name: "Edit" }).click();

  const activeToggle = page.getByLabel("Active");
  await expect(activeToggle).toBeDisabled();
  await expect(page.getByText("You cannot deactivate your own account.")).toBeVisible();

  await page.reload();
  const reloadedRow = page.locator("tr", { hasText: SEEDED_USERS.admin.name });
  await expect(reloadedRow.getByText("Active")).toBeVisible();
});

// E2E-12 — AC-24: with exactly one active Administrator, an attempt to
// deactivate that account is rejected; the system still has one active
// Administrator afterward.
test("E2E-12 the sole active Administrator cannot be deactivated, and the system still has one afterward", async ({
  page,
}) => {
  const row = page.locator("tr", { hasText: SEEDED_USERS.admin.name });
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByLabel("Active")).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.reload();
  const reloadedRow = page.locator("tr", { hasText: SEEDED_USERS.admin.name });
  await expect(reloadedRow.getByText("Active")).toBeVisible();
});

// E2E-13 — AC-25: a Requester navigating directly to the User Management
// URL sees a forbidden state, not the screen.
test("E2E-13 a Requester visiting User Management directly sees a forbidden state, not the screen", async ({
  page,
}) => {
  await logout(page);
  await login(page, SEEDED_USERS.requester.email);
  await page.goto("/admin/users");

  await expect(page.getByText("You don't have access to this screen.")).toBeVisible();
  await expect(page.locator(".user-table")).toHaveCount(0);
});
