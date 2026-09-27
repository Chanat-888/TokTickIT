import { expect, test } from "@playwright/test";
import { createAlexTicketId, login, logout, openActionsTab, SEEDED_USERS } from "./fixtures.js";

test.beforeEach(async ({ page }) => {
  await logout(page);
});

// E2E-01 — AC-01, AC-04, AC-15: Staff A adds an Action Taken; Staff B edits
// it; Performed By stays Staff A.
test("E2E-01 Staff A adds an Action Taken and Staff B edits it without changing Performed By", async ({
  page,
  browser,
}) => {
  const ticketId = await createAlexTicketId(browser);
  const description = `E2E rebooted the switch ${Date.now()}`;

  await login(page, SEEDED_USERS.staff.email);
  await page.goto(`/staff/tickets/${ticketId}`);
  await openActionsTab(page);

  const form = page.getByRole("form", { name: "Add Action Taken" });
  await form.getByLabel(/Description/).fill(description);
  await form.getByLabel(/Result/).fill("Link came back up");
  await form.getByRole("button", { name: "Add Action Taken" }).click();

  const entry = page.locator(".action-taken-entry", { hasText: description });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText(SEEDED_USERS.staff.name);

  await login(page, SEEDED_USERS.staffTwo.email);
  await page.goto(`/staff/tickets/${ticketId}`);
  await openActionsTab(page);

  const other = page.locator(".action-taken-entry", { hasText: description });
  await other.getByRole("button", { name: "Edit this action" }).click();
  const edit = page.getByRole("form", { name: "Edit Action Taken" });
  await edit.getByLabel(/Result/).fill("Link stable after 30 minutes");
  await edit.getByRole("button", { name: /Save/ }).click();

  const updated = page.locator(".action-taken-entry", { hasText: description });
  await expect(updated).toContainText("Link stable after 30 minutes");
  await expect(updated).toContainText(SEEDED_USERS.staff.name);
  await expect(updated).not.toContainText(SEEDED_USERS.staffTwo.name);
});

// E2E-02 — AC-03, AC-06: an invalid follow-up shows a field message; the
// owning Requester then sees every action read-only.
test("E2E-02 invalid follow-up shows a field message, and the Requester sees actions read-only", async ({
  page,
  browser,
}) => {
  const ticketId = await createAlexTicketId(browser);
  const description = `E2E follow-up check ${Date.now()}`;

  await login(page, SEEDED_USERS.staff.email);
  await page.goto(`/staff/tickets/${ticketId}`);
  await openActionsTab(page);

  const form = page.getByRole("form", { name: "Add Action Taken" });
  await form.getByLabel(/Description/).fill(description);
  await form.getByLabel(/Result/).fill("Waiting on vendor");
  await form.getByLabel("Follow-Up Required?").check();
  await form.getByRole("button", { name: "Add Action Taken" }).click();
  await expect(form).toContainText("Follow-up Note is required");
  await expect(page.locator(".action-taken-entry", { hasText: description })).toHaveCount(0);

  await form.getByLabel(/Follow-up Note/).fill("Call the vendor on Friday");
  await form.getByRole("button", { name: "Add Action Taken" }).click();
  await expect(page.locator(".action-taken-entry", { hasText: description })).toContainText("Follow-up needed");

  await login(page, SEEDED_USERS.requester.email);
  await page.goto(`/tickets/${ticketId}`);
  const entry = page.locator(".action-taken-entry", { hasText: description });
  await expect(entry).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit this action" })).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Add Action Taken" })).toHaveCount(0);
});
