import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { clearRequester, selectRequester, DESKTOP, TABLET, MOBILE } from "./fixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PDF = path.join(__dirname, "fixtures", "sample.pdf");
const INVALID_FILE = path.join(__dirname, "fixtures", "invalid.txt");
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

function shotPath(...segments: string[]): string {
  return path.join(SCREENSHOTS_DIR, ...segments);
}

async function openFirstTicketDetail(page: Page): Promise<void> {
  await page.goto("/tickets");
  await page.locator(".ticket-table__row").first().click();
  await page.waitForURL(/\/tickets\/\d+$/);
}

test.beforeEach(async ({ page }) => {
  await clearRequester(page);
});

// ---------------------------------------------------------------------
// RESP-01/02/03 — My Tickets breakpoints (AC-24, ui-spec.md §8)
// ---------------------------------------------------------------------

test("RESP-01 My Tickets at <768px shows stacked cards, no table, no horizontal scroll", async ({
  page,
}) => {
  await selectRequester(page, "Alex Rivera");
  await page.setViewportSize(MOBILE);
  await page.goto("/tickets");

  await expect(page.locator(".ticket-card").first()).toBeVisible();
  await expect(page.locator(".ticket-table")).toBeHidden();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    clientWidth: document.body.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("RESP-02 My Tickets at 768-991px renders the table", async ({ page }) => {
  await selectRequester(page, "Alex Rivera");
  await page.setViewportSize(TABLET);
  await page.goto("/tickets");

  await expect(page.locator(".ticket-table")).toBeVisible();
});

test("RESP-03 My Tickets at >=992px renders all 7 column headers", async ({ page }) => {
  await selectRequester(page, "Alex Rivera");
  await page.setViewportSize(DESKTOP);
  await page.goto("/tickets");

  await expect(page.locator(".ticket-table")).toBeVisible();
  const headerText = await page.locator(".ticket-table thead").innerText();
  for (const expected of [
    "Ticket No.",
    "Created Date",
    "Summary",
    "Category",
    "Requested Priority",
    "Current Status",
    "Last Updated",
  ]) {
    expect(headerText).toContain(expected);
  }
});

// ---------------------------------------------------------------------
// RESP-04 — Create Ticket responsive grid (ui-spec.md §8)
// ---------------------------------------------------------------------

test("RESP-04 Create Ticket's classification row column count differs by breakpoint", async ({
  page,
}) => {
  await selectRequester(page, "Alex Rivera");

  async function columnCount(viewport: { width: number; height: number }): Promise<number> {
    await page.setViewportSize(viewport);
    await page.goto("/tickets/new");
    const value = await page
      .locator(".create-ticket__classification-row")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    return value.trim().split(/\s+/).length;
  }

  const desktopColumns = await columnCount(DESKTOP);
  const tabletColumns = await columnCount(TABLET);
  const mobileColumns = await columnCount(MOBILE);

  expect(desktopColumns).toBe(3);
  expect(tabletColumns).toBe(2);
  expect(mobileColumns).toBe(1);
});

// ---------------------------------------------------------------------
// RESP-05 — App shell mobile nav (ui-spec.md §8, §10)
// ---------------------------------------------------------------------

test("RESP-05 App shell collapses nav into a hamburger toggle below 768px", async ({ page }) => {
  await selectRequester(page, "Alex Rivera");
  await page.setViewportSize(MOBILE);
  await page.goto("/tickets");

  await expect(page.locator(".app-shell__mobile-toggle")).toBeVisible();
  await expect(page.locator(".app-shell__nav")).toBeHidden();

  await page.locator(".app-shell__mobile-toggle").click();

  await expect(page.locator(".app-shell__nav")).toBeVisible();
  const flexDirection = await page
    .locator(".app-shell__nav")
    .evaluate((el) => getComputedStyle(el).flexDirection);
  expect(flexDirection).toBe("column");
});

// ---------------------------------------------------------------------
// RESP-06 — Ticket Detail header grid (ui-spec.md §8)
// ---------------------------------------------------------------------

test("RESP-06 Ticket Detail header grid rearranges fields by breakpoint", async ({ page }) => {
  await selectRequester(page, "Alex Rivera");
  await page.setViewportSize(DESKTOP);
  await openFirstTicketDetail(page);

  const fields = page.locator(".ticket-detail__header > .field");
  const box0 = await fields.nth(0).boundingBox();
  const box1 = await fields.nth(1).boundingBox();
  expect(box0).not.toBeNull();
  expect(box1).not.toBeNull();
  // Desktop: multi-column grid — the first two fields share a row.
  expect(Math.abs(box0!.y - box1!.y)).toBeLessThan(5);

  await page.setViewportSize(TABLET);
  await expect(page.locator(".ticket-detail__header")).toBeVisible();

  await page.setViewportSize(MOBILE);
  await expect(page.locator(".ticket-detail__header")).toBeVisible();
  const box0Mobile = await fields.nth(0).boundingBox();
  const box1Mobile = await fields.nth(1).boundingBox();
  // Mobile: single column — fields stack, so the second field starts on a
  // new row well below the first.
  expect(box1Mobile!.y - box0Mobile!.y).toBeGreaterThan(20);
});

// ---------------------------------------------------------------------
// RESP-07 and tests.md §4 — screenshot checklist
// ---------------------------------------------------------------------

test.describe("Screenshot checklist — Requester Selection", () => {
  test("requester-select loading/loaded/empty/failure (desktop)", async ({ page }) => {
    await page.setViewportSize(DESKTOP);

    await test.step("loading", async () => {
      await page.route("**/api/requesters", async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      const responsePromise = page.waitForResponse("**/api/requesters");
      await page.goto("/select-requester");
      await expect(page.locator(".state-banner--loading")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "requester-select-loading-desktop.png"), fullPage: true });
      // Wait for the delayed response to actually resolve before unrouting —
      // otherwise the pending handler's route.continue() can fire after a
      // later navigation has already disposed the route (Playwright then
      // throws "Route is already handled").
      await responsePromise;
      await page.unroute("**/api/requesters");
    });

    await test.step("loaded", async () => {
      await page.goto("/select-requester");
      await expect(page.locator(".requester-select__dropdown")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "requester-select-loaded-desktop.png"), fullPage: true });
    });

    await test.step("empty", async () => {
      await page.route("**/api/requesters", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
      await page.goto("/select-requester");
      await expect(page.getByText("No active Development Requesters are available.")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "requester-select-empty-desktop.png"), fullPage: true });
      await page.unroute("**/api/requesters");
    });

    await test.step("failure", async () => {
      await page.route("**/api/requesters", (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unexpected server error"}' }));
      await page.goto("/select-requester");
      await expect(page.locator(".state-banner--error")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "requester-select-failure-desktop.png"), fullPage: true });
      await page.unroute("**/api/requesters");
    });
  });
});

test.describe("Screenshot checklist — Create Ticket", () => {
  test("create-ticket initial at all three viewports", async ({ page }) => {
    await selectRequester(page, "Alex Rivera");

    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`initial (${name})`, async () => {
        await page.setViewportSize(viewport);
        await page.goto("/tickets/new");
        await expect(page.locator(".create-ticket")).toBeVisible();
        await page.screenshot({ path: shotPath("create-ticket", `create-ticket-initial-${name}.png`), fullPage: true });
      });
    }
  });

  test("create-ticket validation/submitting/success/api-failure/invalid-attachment (desktop)", async ({
    page,
  }) => {
    await selectRequester(page, "Alex Rivera");
    await page.setViewportSize(DESKTOP);

    await test.step("validation failure", async () => {
      await page.goto("/tickets/new");
      await page.locator('button[type="submit"]').click();
      await expect(page.locator(".field__message--error").first()).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "create-ticket-validation-desktop.png"), fullPage: true });
    });

    await test.step("submitting (busy)", async () => {
      await page.goto("/tickets/new");
      await page.locator("#ticket-category").selectOption({ index: 1 });
      await page.locator("#ticket-related-system").selectOption({ index: 1 });
      await page.locator("#ticket-summary").fill("RESP-07 submitting state ticket");
      await page.locator("#ticket-description").fill("Screenshot capture of the busy Submit button state.");

      await page.route("**/api/tickets", async (route) => {
        if (route.request().method() === "POST") {
          await new Promise((r) => setTimeout(r, 1500));
        }
        await route.continue();
      });
      await page.locator('button[type="submit"]').click();
      await expect(page.locator(".btn--busy")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "create-ticket-submitting-desktop.png"), fullPage: true });
      await page.unroute("**/api/tickets");
      await expect(page.locator(".state-banner--success")).toBeVisible({ timeout: 10_000 });
    });

    await test.step("success", async () => {
      await page.goto("/tickets/new");
      await page.locator("#ticket-category").selectOption({ index: 1 });
      await page.locator("#ticket-related-system").selectOption({ index: 1 });
      await page.locator("#ticket-summary").fill("RESP-07 success state ticket");
      await page.locator("#ticket-description").fill("Screenshot capture of the Create Ticket success banner.");
      await page.locator('button[type="submit"]').click();
      await expect(page.locator(".state-banner--success")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "create-ticket-success-desktop.png"), fullPage: true });
    });

    await test.step("api/network failure", async () => {
      await page.goto("/tickets/new");
      await page.locator("#ticket-category").selectOption({ index: 1 });
      await page.locator("#ticket-related-system").selectOption({ index: 1 });
      await page.locator("#ticket-summary").fill("RESP-07 api failure ticket");
      await page.locator("#ticket-description").fill("Screenshot capture of the Create Ticket failure banner.");

      await page.route("**/api/tickets", (route) =>
        route.request().method() === "POST"
          ? route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unexpected server error"}' })
          : route.continue(),
      );
      await page.locator('button[type="submit"]').click();
      await expect(page.locator(".state-banner--error")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "create-ticket-api-failure-desktop.png"), fullPage: true });
      await page.unroute("**/api/tickets");
    });

    await test.step("invalid attachment selected", async () => {
      await page.goto("/tickets/new");
      await page.locator('input[aria-label="Attachments"]').setInputFiles(INVALID_FILE);
      await expect(page.locator(".attachment-picker__chip--invalid")).toBeVisible();
      await page.screenshot({ path: shotPath("create-ticket", "create-ticket-invalid-attachment-desktop.png"), fullPage: true });
    });
  });
});

test.describe("Screenshot checklist — My Tickets", () => {
  test("my-tickets loading/list/empty/no-results/failure (desktop, plus list at tablet/mobile)", async ({
    page,
  }) => {
    await selectRequester(page, "Alex Rivera");
    await page.setViewportSize(DESKTOP);

    await test.step("loading", async () => {
      await page.route("**/api/tickets*", async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      const responsePromise = page.waitForResponse("**/api/tickets*");
      await page.goto("/tickets");
      await expect(page.locator('[data-testid="ticket-skeleton-row"]').first()).toBeVisible();
      await page.screenshot({ path: shotPath("my-tickets", "my-tickets-loading-desktop.png"), fullPage: true });
      // Wait for the delayed response before unrouting — see the matching
      // comment on the Requester Selection "loading" step above.
      await responsePromise;
      await page.unroute("**/api/tickets*");
    });

    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`populated list (${name})`, async () => {
        await page.setViewportSize(viewport);
        await page.goto("/tickets");
        await expect(page.locator(".my-tickets")).toBeVisible();
        await page.screenshot({ path: shotPath("my-tickets", `my-tickets-list-${name}.png`), fullPage: true });
      });
    }

    await page.setViewportSize(DESKTOP);

    await test.step("empty state", async () => {
      await selectRequester(page, "Priya Nair");
      await page.goto("/tickets");
      await expect(page.getByText("No tickets yet")).toBeVisible();
      await page.screenshot({ path: shotPath("my-tickets", "my-tickets-empty-desktop.png"), fullPage: true });
    });

    await test.step("no-results state", async () => {
      await selectRequester(page, "Alex Rivera");
      await page.goto("/tickets");
      await page.locator(".ticket-toolbar__search").fill("zzz-no-such-ticket-zzz");
      await expect(page.getByText("No tickets match your search")).toBeVisible();
      await page.screenshot({ path: shotPath("my-tickets", "my-tickets-no-results-desktop.png"), fullPage: true });
    });

    await test.step("failure state", async () => {
      await page.route("**/api/tickets*", (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Unexpected server error"}' }),
      );
      await page.goto("/tickets");
      await expect(page.locator(".state-banner--error")).toBeVisible();
      await page.screenshot({ path: shotPath("my-tickets", "my-tickets-failure-desktop.png"), fullPage: true });
      await page.unroute("**/api/tickets*");
    });
  });

  test("my-tickets requester-switch before/after (desktop)", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await selectRequester(page, "Alex Rivera");
    await page.goto("/tickets");

    await test.step("before switch (Alex Rivera)", async () => {
      await expect(page.locator(".my-tickets")).toBeVisible();
      await page.screenshot({ path: shotPath("my-tickets", "my-tickets-requester-switch-before-desktop.png"), fullPage: true });
    });

    await test.step("after switch (Sam Okafor)", async () => {
      await page.locator(".app-shell__change-requester-btn").click();
      await page.waitForURL("**/select-requester");
      await selectRequester(page, "Sam Okafor");
      await page.goto("/tickets");
      await expect(page.locator(".my-tickets")).toBeVisible();
      await page.screenshot({ path: shotPath("my-tickets", "my-tickets-requester-switch-after-desktop.png"), fullPage: true });
    });
  });
});

test.describe("Screenshot checklist — Ticket Detail", () => {
  test("ticket-detail loaded at all three viewports", async ({ page }) => {
    await selectRequester(page, "Alex Rivera");
    await page.setViewportSize(DESKTOP);
    await openFirstTicketDetail(page);
    const ticketUrl = page.url();

    for (const [viewport, name] of [
      [DESKTOP, "desktop"],
      [TABLET, "tablet"],
      [MOBILE, "mobile"],
    ] as const) {
      await test.step(`loaded (${name})`, async () => {
        await page.setViewportSize(viewport);
        await page.goto(ticketUrl);
        await expect(page.locator(".ticket-detail__header")).toBeVisible();
        await page.screenshot({ path: shotPath("ticket-detail", `ticket-detail-loaded-${name}.png`), fullPage: true });
      });
    }
  });

  test("ticket-detail removed-attachment / remove-confirm / not-found (desktop)", async ({ page }) => {
    await selectRequester(page, "Alex Rivera");
    await page.setViewportSize(DESKTOP);
    await openFirstTicketDetail(page);

    await test.step("add an attachment to remove", async () => {
      await page.locator(".ticket-detail__attachments button", { hasText: "Add Attachment" }).click();
      await page.locator('input[aria-label="Attachments"]').setInputFiles(SAMPLE_PDF);
      await page.locator(".ticket-detail__attachments button", { hasText: "Upload" }).click();
      await expect(page.locator(".attachment-item--active", { hasText: "sample.pdf" }).last()).toBeVisible();
    });

    await test.step("remove-confirm panel open", async () => {
      const row = page.locator(".attachment-item--active", { hasText: "sample.pdf" }).last();
      await row.locator(".attachment-item__remove-btn").click();
      await expect(page.locator(".attachment-remove-confirm")).toBeVisible();
      await page.screenshot({ path: shotPath("ticket-detail", "ticket-detail-remove-confirm-desktop.png"), fullPage: true });
    });

    await test.step("removed attachment shown", async () => {
      await page.locator("#attachment-remove-reason").fill("Captured for the RESP-07 screenshot checklist");
      await page.locator(".attachment-remove-confirm .btn--destructive").click();
      await expect(page.locator(".attachment-item--removed", { hasText: "sample.pdf" }).last()).toBeVisible();
      await page.screenshot({ path: shotPath("ticket-detail", "ticket-detail-removed-attachment-desktop.png"), fullPage: true });
    });
  });

  test("ticket-detail not-found (desktop)", async ({ page }) => {
    await selectRequester(page, "Alex Rivera");
    await page.setViewportSize(DESKTOP);
    await page.goto("/tickets/999999999");
    await expect(page.getByText("Ticket not found")).toBeVisible();
    await page.screenshot({ path: shotPath("ticket-detail", "ticket-detail-not-found-desktop.png"), fullPage: true });
  });
});
