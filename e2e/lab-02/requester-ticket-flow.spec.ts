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

// E2E-02 — AC-02: opening My Tickets with no Requester selected.
test("E2E-02 opening My Tickets with no Requester selected redirects to Requester Selection", async ({
  page,
}) => {
  await page.goto("/tickets");
  await page.waitForURL("**/select-requester");
  expect(page.url()).toContain("/select-requester");
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

// E2E-06 — AC-22, BR-08: Change Requester mid-session, A -> B.
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

  await page.locator(".app-shell__change-requester-btn").click();
  await page.waitForURL("**/select-requester");
  await selectRequester(page, "Sam Okafor");

  await expect(page.getByText(alexTicketNumber, { exact: true })).toHaveCount(0);
  await expect(page.locator(".ticket-list__pagination-summary")).toContainText("of 5");
});

// E2E-07 — AC-25: keyboard-only navigation of Requester Selection.
test("E2E-07 Requester Selection is fully operable via keyboard with a visible focus indicator", async ({
  page,
}) => {
  await page.goto("/select-requester");

  let reachedDropdown = false;
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    const id = await focused.evaluate((el) => el.id).catch(() => "");
    if (id === "requester-select-dropdown") {
      reachedDropdown = true;
      break;
    }
  }
  expect(reachedDropdown).toBe(true);

  const dropdown = page.locator(":focus");
  await expect(dropdown).toHaveCSS("outline-style", "solid");

  // Arrow-key select the first active Requester (Alex Rivera, lowest id).
  await page.keyboard.press("ArrowDown");

  let reachedContinue = false;
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    const className = await focused.evaluate((el) => el.className).catch(() => "");
    if (className.includes("requester-select__continue-btn")) {
      reachedContinue = true;
      break;
    }
  }
  expect(reachedContinue).toBe(true);
  await expect(page.locator(":focus")).toHaveCSS("outline-style", "solid");

  await page.keyboard.press("Enter");
  await page.waitForURL("**/tickets");
});

// E2E-08 — AC-03: Requester B opens Requester A's Ticket Detail URL directly.
test("E2E-08 opening another Requester's Ticket Detail URL directly renders the not-found panel", async ({
  page,
}) => {
  await selectRequester(page, "Alex Rivera");
  await page.goto("/tickets");
  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/tickets\/(\d+)$/);
  const url = page.url();
  const ticketId = url.match(/\/tickets\/(\d+)$/)![1];

  await page.locator(".app-shell__change-requester-btn").click();
  await page.waitForURL("**/select-requester");
  await selectRequester(page, "Sam Okafor");

  await page.goto(`/tickets/${ticketId}`);

  await expect(page.getByText("Ticket not found")).toBeVisible();
  await expect(page.getByText("This ticket doesn't exist, or isn't available to you.")).toBeVisible();
});
