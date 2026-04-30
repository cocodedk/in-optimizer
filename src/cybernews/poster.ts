/**
 * Drives the LinkedIn /feed/ composer to post a Danish cybersecurity update.
 *
 * Reuses src/humanCursor.ts for mouse motion and adds per-char keydown jitter
 * for typing. Splits compose-and-attach from submit so the caller can
 * confirm before the destructive click.
 */

import type { BrowserContext, Page } from "playwright";
import { humanClick, humanMoveTo } from "../humanCursor.ts";
import { jitter, type Rng } from "../pace.ts";
import { FEED_URL, LI_SELECTORS } from "./selectors-li.ts";
import { attachMedia } from "./composer-media.ts";
import { captureUrl, waitForEnabled } from "./post-result.ts";

const SHORT_TIMEOUT = 8000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PosterOpts = {
  rng: Rng;
  /** Per-key minimum delay in ms (default 35). */
  keyMinMs?: number;
  /** Per-key maximum delay in ms (default 95). */
  keyMaxMs?: number;
};

export type ComposeResult = {
  status: "composed";
  page: Page;
};

export type SubmitResult =
  | { status: "posted"; liUrl?: string }
  | { status: "failed"; reason: string };

export async function openComposer(
  ctx: BrowserContext,
  rng: Rng,
): Promise<Page> {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(FEED_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
  // The trigger area takes ~5s to settle on first paint; settle longer
  // than feels strictly necessary so React doesn't re-render the trigger
  // out from under our click.
  await page.waitForTimeout(5000);
  const trigger = page.locator(LI_SELECTORS.startPostTrigger).first();
  await trigger.waitFor({ state: "visible", timeout: SHORT_TIMEOUT });
  await humanClick(page, trigger, rng);
  // Composer modal opens inside a shadow root and animates in over a
  // few seconds. Wait long enough that the editor is actually mounted
  // before the typeBody locator tries to find it.
  await page.waitForTimeout(5000);
  return page;
}

export async function typeBody(page: Page, body: string, opts: PosterOpts): Promise<void> {
  const editor = page.locator(LI_SELECTORS.bodyEditor).first();
  await editor.waitFor({ state: "visible", timeout: SHORT_TIMEOUT });
  await editor.click();
  await sleep(jitter(220, 0.4, opts.rng));
  const minMs = opts.keyMinMs ?? 35;
  const maxMs = opts.keyMaxMs ?? 95;
  // keyboard.type() emits keydown + keypress + input + keyup per char,
  // which is what we want for humanization. insertText would emit only
  // input, leaving the keystroke pattern empty.
  //
  // NOTE: don't press Escape after `#` to dismiss hashtag autocomplete —
  // Escape also closes the composer modal. Typing past the suggestion is
  // harmless; the suggestion isn't committed unless Tab/Enter selects it.
  for (const ch of body) {
    if (ch === "\n") {
      await page.keyboard.press("Enter");
    } else {
      await page.keyboard.type(ch);
    }
    const delay = minMs + Math.round(opts.rng() * (maxMs - minMs));
    await sleep(delay);
  }
  await sleep(jitter(500, 0.4, opts.rng));
}

export async function compose(
  ctx: BrowserContext,
  body: string,
  mediaPaths: string[],
  opts: PosterOpts,
): Promise<ComposeResult> {
  const page = await openComposer(ctx, opts.rng);
  // Attach media BEFORE typing the body — LinkedIn collapses the secondary
  // toolbar (which holds Add media) once the editor has substantial
  // content, so the button disappears mid-flow if we type first.
  await attachMedia(page, mediaPaths, opts.rng);
  await typeBody(page, body, opts);
  return { status: "composed", page };
}

export async function submit(page: Page, rng: Rng): Promise<SubmitResult> {
  const submit = page.locator(LI_SELECTORS.postSubmitButton).first();
  try {
    await submit.waitFor({ state: "visible", timeout: SHORT_TIMEOUT });
  } catch {
    return { status: "failed", reason: "submit-button-missing" };
  }
  if (!(await waitForEnabled(submit, SHORT_TIMEOUT))) {
    return { status: "failed", reason: "submit-button-disabled" };
  }
  try {
    await humanClick(page, submit, rng);
  } catch {
    return { status: "failed", reason: "submit-click-failed" };
  }
  await sleep(jitter(1500, 0.3, rng));
  const liUrl = await captureUrl(page);
  return { status: "posted", liUrl };
}

/** Park the cursor somewhere benign before/after composing — purely cosmetic. */
export async function parkCursor(page: Page, rng: Rng): Promise<void> {
  const x = 200 + rng() * 400;
  const y = 200 + rng() * 400;
  await humanMoveTo(page, { x, y }, rng).catch(() => {});
}
