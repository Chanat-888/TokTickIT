import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { clearRequester, selectRequester } from "./fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "fixtures", "sample.pdf");

test.beforeEach(async ({ page }) => {
  await clearRequester(page);
});

// E2E-01 — AC-01, AC-15, AC-27: full happy path.
test("E2E-01 full happy path: create a ticket with an attachment, then view it", async ({ page }) => {
  await selectRequester(page, "Alex Rivera");

  await page.goto("/tickets/new");
  await page.locator("#ticket-category").selectOption({ index: 1 });
  await page.locator("#ticket-related-system").selectOption({ index: 1 });
  await page.locator("#ticket-priority").selectOption("HIGH");
  await page.locator("#ticket-summary").fill("E2E-01 happy path ticket");
  await page
    .locator("#ticket-description")
    .fill("Full happy-path E2E test: create ticket with one attachment, then view it.");
  await page.locator('input[aria-label="Attachments"]').setInputFiles(SAMPLE_PDF);

  await page.locator('button[type="submit"]').click();

  const successBanner = page.locator(".state-banner--success");
  await expect(successBanner).toBeVisible();
  const bannerText = await successBanner.innerText();
  const match = bannerText.match(/TKT-\d{4}-\d{6}/);
  expect(match).not.toBeNull();
  const ticketNumber = match![0];
  expect(ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);

  await successBanner.getByText("View Ticket").click();
  await page.waitForURL(/\/tickets\/\d+$/);

  await expect(page.locator(".ticket-detail__header")).toContainText(ticketNumber);
  await expect(page.locator(".ticket-detail__header")).toContainText("E2E-01 happy path ticket");

  const attachmentRows = page.locator(".attachment-item--active");
  await expect(attachmentRows).toHaveCount(1);
  await expect(attachmentRows.first()).toContainText("sample.pdf");
});

// E2E-02 — AC-02: opening My Tickets with no session. The Development
// Requester selector this originally targeted was removed by
// specification.md BR-15 (Lab 3 Phase 4) in favor of real login; the
// behavior this test actually cares about — an unauthenticated visit to a
// protected route doesn't show the screen — now redirects to /login
// instead of /select-requester.
test("E2E-02 opening My Tickets with no session redirects to Login", async ({ page }) => {
  await page.goto("/tickets");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

// E2E-03 — AC-04: submitting Create Ticket with invalid data.
test("E2E-03 submitting Create Ticket with an empty Summary shows an inline error and does not navigate away", async ({
  page,
}) => {
  await selectRequester(page, "Alex Rivera");

  await page.goto("/tickets/new");
  await page.locator("#ticket-category").selectOption({ index: 1 });
  await page.locator("#ticket-related-system").selectOption({ index: 1 });
  await page
    .locator("#ticket-description")
    .fill("Description is filled in but Summary is left empty for this test.");

  await page.locator('button[type="submit"]').click();

  await expect(page.locator("#ticket-summary-message")).toBeVisible();
  await expect(page.locator("#ticket-summary-message")).toContainText("Summary is required");
  expect(page.url()).toContain("/tickets/new");
});

// E2E-04 — AC-09, AC-10, AC-11, AC-12: search/filter/sort/paginate against
// the seeded ~25-ticket Requester.
function parseTotalCount(summaryText: string): number {
  const match = summaryText.match(/of (\d+)/);
  if (!match) throw new Error(`Could not parse total count from "${summaryText}"`);
  return Number(match[1]);
}

// Alex Rivera is the seeded 25-ticket Requester. Global setup truncates and
// reseeds the DB before this run, and E2E-01 (which runs earlier in this
// file, single-worker) deterministically adds one more ticket for Alex —
// so the exact total at this point is always 25 + 1 = 26.
test("E2E-04 My Tickets search, filter, sort, and pagination work end-to-end", async ({ page }) => {
  await selectRequester(page, "Alex Rivera");
  await page.goto("/tickets");

  await expect(page.locator(".ticket-table__row")).toHaveCount(10);
  const initialSummary = await page.locator(".ticket-list__pagination-summary").innerText();
  const initialTotal = parseTotalCount(initialSummary);
  expect(initialTotal).toBe(26);

  // Search: narrow by a known seeded ticket number's full value.
  const firstTicketNumber = await page
    .locator(".ticket-table__row")
    .first()
    .locator("td")
    .first()
    .innerText();
  await page.locator(".ticket-toolbar__search").fill(firstTicketNumber);
  await expect(page.locator(".ticket-list__pagination-summary")).toContainText("of 1");
  await expect(page.locator(".ticket-table__row")).toHaveCount(1);
  await expect(page.locator(".ticket-table__row").first()).toContainText(firstTicketNumber);

  // Clear search, filter by Category, assert narrowing.
  await page.locator(".ticket-toolbar__search").fill("");
  await expect(page.locator(".ticket-list__pagination-summary")).toContainText(`of ${initialTotal}`);
  await page.locator('select[aria-label="Category"]').selectOption({ index: 1 });
  const filteredSummary = await page.locator(".ticket-list__pagination-summary").innerText();
  expect(parseTotalCount(filteredSummary)).toBeLessThan(initialTotal);

  // Clear filters, then exercise sorting by Requested Priority.
  await page.locator(".ticket-toolbar__clear-filters-btn").click();
  await expect(page.locator(".ticket-list__pagination-summary")).toContainText(`of ${initialTotal}`);

  const priorityHeaderBtn = page.locator(".ticket-table__header--sortable button", {
    hasText: "Requested Priority",
  });

  // Clicking a sortable header only updates state synchronously — the row
  // content itself changes after the resulting GET /api/tickets resolves,
  // so each click's response must be awaited before reading the first row.
  let responsePromise = page.waitForResponse((res) => res.url().includes("/api/tickets") && res.request().method() === "GET");
  await priorityHeaderBtn.click();
  await responsePromise;
  const iconAfterFirstClick = await priorityHeaderBtn.locator(".ticket-table__sort-icon").innerText();
  expect(["▲", "▼"]).toContain(iconAfterFirstClick);
  const firstRowPriorityAfterFirstClick = await page
    .locator(".ticket-table__row")
    .first()
    .locator("td")
    .nth(4)
    .innerText();

  responsePromise = page.waitForResponse((res) => res.url().includes("/api/tickets") && res.request().method() === "GET");
  await priorityHeaderBtn.click();
  await responsePromise;
  const iconAfterSecondClick = await priorityHeaderBtn.locator(".ticket-table__sort-icon").innerText();
  expect(iconAfterSecondClick).not.toBe(iconAfterFirstClick);
  const firstRowPriorityAfterSecondClick = await page
    .locator(".ticket-table__row")
    .first()
    .locator("td")
    .nth(4)
    .innerText();
  expect(firstRowPriorityAfterSecondClick).not.toBe(firstRowPriorityAfterFirstClick);

  // Pagination: page 2's rows differ from page 1's.
  const page1TicketNumbers = await page.locator(".ticket-table__row td:first-child").allInnerTexts();
  await page.locator(".pagination__page-btn", { hasText: "2" }).click();
  await expect(page.locator(".pagination__page-btn--active")).toHaveText("2");
  const page2TicketNumbers = await page.locator(".ticket-table__row td:first-child").allInnerTexts();
  expect(page2TicketNumbers).not.toEqual(page1TicketNumbers);
});

// E2E-05 — AC-20: Ticket Detail add then remove (with reason) an attachment.
test("E2E-05 adding then removing an attachment updates the row in place, without a page reload", async ({
  page,
}) => {
  await selectRequester(page, "Alex Rivera");
  await page.goto("/tickets");
  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/tickets\/\d+$/);

  // Marker proving no full page navigation/reload occurs during the
  // add/remove sequence below — a reload would reset window state.
  await page.evaluate(() => {
    (window as unknown as { __e2eNoReloadMarker?: boolean }).__e2eNoReloadMarker = true;
  });

  await page.locator(".ticket-detail__attachments button", { hasText: "Add Attachment" }).click();
  await page.locator('input[aria-label="Attachments"]').setInputFiles(SAMPLE_PDF);
  await page.locator(".ticket-detail__attachments button", { hasText: "Upload" }).click();

  const addedRow = page.locator(".attachment-item--active", { hasText: "sample.pdf" }).last();
  await expect(addedRow).toBeVisible();

  await addedRow.locator(".attachment-item__remove-btn").click();
  await page.locator("#attachment-remove-reason").fill("No longer needed for E2E-05");
  await page.locator(".attachment-remove-confirm .btn--destructive").click();

  const removedRow = page.locator(".attachment-item--removed", { hasText: "sample.pdf" }).last();
  await expect(removedRow).toBeVisible();
  await expect(removedRow).toContainText("Removed");

  const markerStillPresent = await page.evaluate(
    () => (window as unknown as { __e2eNoReloadMarker?: boolean }).__e2eNoReloadMarker === true,
  );
  expect(markerStillPresent).toBe(true);
});

// E2E-06 — AC-22, BR-08: Change Requester mid-session, A -> B. The
// Development Requester selector this originally clicked through to
// (.app-shell__change-requester-btn -> /select-requester) was removed by
// specification.md BR-15 (Lab 3 Phase 4) in favor of real login; that CSS
// class is now reused by the Logout button (same header position), and
// clicking it no longer navigates anywhere resembling a Requester picker.
// selectRequester() itself already clears the session and logs in as the
// named Requester (see its doc comment in fixtures.ts), so "switching"
// mid-test is just calling it again for the new name.
test("E2E-06 switching Requester replaces the ticket list with the new Requester's own tickets", async ({
  page,
}) => {
  await selectRequester(page, "Alex Rivera");
  await page.goto("/tickets");

  const alexTicketNumber = await page
    .locator(".ticket-table__row")
    .first()
    .locator("td")
    .first()
    .innerText();

  await selectRequester(page, "Sam Okafor");
  await page.goto("/tickets");

  await expect(page.getByText(alexTicketNumber, { exact: true })).toHaveCount(0);
  await expect(page.locator(".ticket-list__pagination-summary")).toContainText("of 5");
});

// E2E-07 — AC-25: keyboard-only navigation. The Requester Selection screen
// this originally targeted (#requester-select-dropdown,
// .requester-select__continue-btn) no longer exists at all — BR-15 removed
// it, not merely relocated it, so there is no reachable equivalent of that
// specific dropdown-then-continue flow. The closest genuinely-reachable
// screen serving the same role (the first keyboard-operable screen an
// unauthenticated visitor reaches) is now Login, so this exercises that
// instead: Tab to Email, then Password, then Submit, each with a visible
// focus indicator, submitting via Enter.
test("E2E-07 Login is fully operable via keyboard with a visible focus indicator", async ({ page }) => {
  // Self-healing like fixtures.ts's selectRequester()/attemptLogin() — an
  // earlier test in this shared single-worker run may have already changed
  // Alex Rivera's password away from the seed value. The two literals here
  // duplicate fixtures.ts's own (unexported) SEED_PASSWORD/CHANGED_PASSWORD.
  async function tabFillSubmit(password: string): Promise<boolean> {
    await page.goto("/login");

    await page.keyboard.press("Tab");
    await expect(page.locator("#login-email")).toBeFocused();
    await expect(page.locator(":focus")).toHaveCSS("outline-style", "solid");
    await page.keyboard.type("alex.rivera@example.com");

    await page.keyboard.press("Tab");
    await expect(page.locator("#login-password")).toBeFocused();
    await expect(page.locator(":focus")).toHaveCSS("outline-style", "solid");
    await page.keyboard.type(password);

    await page.keyboard.press("Tab");
    await expect(page.locator('button[type="submit"]')).toBeFocused();
    await expect(page.locator(":focus")).toHaveCSS("outline-style", "solid");

    await page.keyboard.press("Enter");
    await Promise.race([
      page.waitForURL((url) => !url.pathname.startsWith("/login")),
      page.locator(".state-banner--error").waitFor({ state: "visible" }),
    ]);
    return !page.url().includes("/login");
  }

  let ok = await tabFillSubmit("ChangeMe123!");
  if (!ok) {
    ok = await tabFillSubmit("ChangedPassword1");
  }
  expect(ok).toBe(true);
});

// E2E-08 — AC-03: Requester B opens Requester A's Ticket Detail URL
// directly. Switches Requester the same way E2E-06 now does — see that
// test's comment on why the old click-through-to-/select-requester step is
// gone.
test("E2E-08 opening another Requester's Ticket Detail URL directly renders the not-found panel", async ({
  page,
}) => {
  await selectRequester(page, "Alex Rivera");
  await page.goto("/tickets");
  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/tickets\/(\d+)$/);
  const url = page.url();
  const ticketId = url.match(/\/tickets\/(\d+)$/)![1];

  await selectRequester(page, "Sam Okafor");

  await page.goto(`/tickets/${ticketId}`);

  await expect(page.getByText("Ticket not found")).toBeVisible();
  await expect(page.getByText("This ticket doesn't exist, or isn't available to you.")).toBeVisible();
});
