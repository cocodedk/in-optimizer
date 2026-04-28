import type { Page } from "playwright";
import { SELECTORS } from "./selectors.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NETWORK_IDLE_TIMEOUT_MS = 15_000;
const SHOW_MORE_LOAD_TIMEOUT_MS = 15_000;
const SHOW_MORE_POLL_INTERVAL_MS = 1_000;

/**
 * Scroll the activity feed. LinkedIn lazy-loads in two ways:
 *   1. Infinite scroll: more cards stream in as you near the bottom.
 *   2. A "Show more results" button at the end of each chunk.
 *
 * Strategy:
 *   1. Scroll to the bottom and wait for the network to go idle (so the
 *      "Show more results" button has a chance to render before we check).
 *   2. If the button is visible, snapshot the current card count, click it,
 *      wait for network idle again, then poll the card count until it grows
 *      (or the timeout expires — LinkedIn can take >5 s to return older chunks).
 */
export async function scrollAndExpand(page: Page, pauseMs: number): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior });
  });
  await page
    .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS })
    .catch(() => {});
  await sleep(pauseMs);

  const more = page.locator("button", { hasText: /show more results/i }).first();
  if (await more.isVisible().catch(() => false)) {
    const before = await page.locator(SELECTORS.card).count();
    try {
      await more.click({ timeout: 3000 });
    } catch {
      return;
    }
    await page
      .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS })
      .catch(() => {});
    const deadline = Date.now() + SHOW_MORE_LOAD_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const now = await page.locator(SELECTORS.card).count();
      if (now > before) return;
      await sleep(SHOW_MORE_POLL_INTERVAL_MS);
    }
  }
}
