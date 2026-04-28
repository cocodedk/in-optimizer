import type { Locator, Page } from "playwright";
import { SELECTORS } from "./selectors.ts";
import { jitter, type Rng } from "./pace.ts";
import { humanClick } from "./humanCursor.ts";

export type Outcome = "deleted" | "not-found" | "error" | "skipped";

export type DeleteResult = {
  outcome: Outcome;
  reason?: string;
};

export type MicroPace = { baseMs: number; fraction: number; rng: Rng };

const SHORT_TIMEOUT_MS = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const wait = (p: MicroPace) => sleep(jitter(p.baseMs, p.fraction, p.rng));

/**
 * Click the "..." trigger inside a comment card, pick "Delete" from the
 * dropdown menu, then confirm in the modal. LinkedIn's React tree shifts when
 * the menu/modal mount, so we resolve each step against the *page* after the
 * trigger click rather than holding stale references.
 */
export async function deleteComment(
  page: Page,
  card: Locator,
  pace: MicroPace,
): Promise<DeleteResult> {
  const trigger = card.locator(SELECTORS.trigger).first();
  if ((await trigger.count()) === 0) {
    return { outcome: "error", reason: "trigger-missing" };
  }
  try {
    await humanClick(page, trigger, pace.rng);
  } catch {
    return { outcome: "error", reason: "trigger-click-failed" };
  }
  await wait(pace);

  const deleteItem = page
    .locator(SELECTORS.menuitem, { hasText: /delete/i })
    .first();
  try {
    await deleteItem.waitFor({ state: "visible", timeout: SHORT_TIMEOUT_MS });
  } catch {
    return { outcome: "error", reason: "delete-menuitem-missing" };
  }
  try {
    await humanClick(page, deleteItem, pace.rng);
  } catch {
    return { outcome: "error", reason: "delete-menuitem-click-failed" };
  }
  await wait(pace);

  const dialog = page.locator(SELECTORS.confirmDialog).first();
  try {
    await dialog.waitFor({ state: "visible", timeout: SHORT_TIMEOUT_MS });
  } catch {
    return { outcome: "error", reason: "confirm-dialog-missing" };
  }

  // Prefer the structural primary-action button; fall back to text match if
  // LinkedIn renames or moves the action bar.
  let confirm = dialog.locator(SELECTORS.confirmButton).first();
  try {
    await confirm.waitFor({ state: "visible", timeout: SHORT_TIMEOUT_MS });
  } catch {
    confirm = dialog.locator("button", { hasText: SELECTORS.confirmText }).first();
    try {
      await confirm.waitFor({ state: "visible", timeout: SHORT_TIMEOUT_MS });
    } catch {
      return { outcome: "error", reason: "confirm-button-missing" };
    }
  }
  try {
    await humanClick(page, confirm, pace.rng);
  } catch {
    return { outcome: "error", reason: "confirm-click-failed" };
  }
  await wait(pace);

  // Wait for the dialog to close as a soft signal the delete went through.
  await dialog.waitFor({ state: "hidden", timeout: SHORT_TIMEOUT_MS }).catch(() => {});

  return { outcome: "deleted" };
}
