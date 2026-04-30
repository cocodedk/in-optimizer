/**
 * Drives the LinkedIn /feed/ composer to post a Danish cybersecurity update.
 *
 * Reuses src/humanCursor.ts for mouse motion and adds per-char keydown jitter
 * for typing. Splits compose-and-attach from submit so the caller can
 * confirm before the destructive click.
 */

import type { BrowserContext, Locator, Page } from "playwright";
import { humanClick, humanMoveTo } from "../humanCursor.ts";
import { jitter, type Rng } from "../pace.ts";
import { FEED_URL, LI_SELECTORS } from "./selectors-li.ts";

const SHORT_TIMEOUT = 8000;
const MEDIA_TIMEOUT = 60_000;

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
  await page.waitForTimeout(2000);
  const trigger = page.locator(LI_SELECTORS.startPostTrigger).first();
  await trigger.waitFor({ state: "visible", timeout: SHORT_TIMEOUT });
  await humanClick(page, trigger, rng);
  const dialog = page.locator(LI_SELECTORS.composerDialog).first();
  await dialog.waitFor({ state: "visible", timeout: SHORT_TIMEOUT });
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
  for (const ch of body) {
    if (ch === "\n") {
      await page.keyboard.press("Enter");
    } else {
      await page.keyboard.type(ch);
    }
    const delay = minMs + Math.round(opts.rng() * (maxMs - minMs));
    await sleep(delay);
    if (ch === "#") {
      await sleep(jitter(120, 0.4, opts.rng));
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  await sleep(jitter(500, 0.4, opts.rng));
}

export async function attachMedia(
  page: Page,
  paths: string[],
  rng: Rng,
): Promise<void> {
  if (paths.length === 0) return;
  const addBtn = page.locator(LI_SELECTORS.addMediaButton).first();
  if ((await addBtn.count()) > 0) {
    await humanClick(page, addBtn, rng).catch(() => {});
    await sleep(jitter(400, 0.3, rng));
  }
  const input = page.locator(LI_SELECTORS.fileInput).first();
  await input.waitFor({ state: "attached", timeout: SHORT_TIMEOUT });
  await input.setInputFiles(paths);
  const thumb = page.locator(LI_SELECTORS.mediaThumbnails).first();
  await thumb.waitFor({ state: "visible", timeout: MEDIA_TIMEOUT });
  await sleep(jitter(800, 0.3, rng));
  const done = page.locator(LI_SELECTORS.mediaDoneButton).first();
  if ((await done.count()) > 0) {
    await humanClick(page, done, rng).catch(() => {});
    await sleep(jitter(600, 0.3, rng));
  }
}

export async function compose(
  ctx: BrowserContext,
  body: string,
  mediaPaths: string[],
  opts: PosterOpts,
): Promise<ComposeResult> {
  const page = await openComposer(ctx, opts.rng);
  await typeBody(page, body, opts);
  await attachMedia(page, mediaPaths, opts.rng);
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

async function waitForEnabled(loc: Locator, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const disabled = await loc.evaluate(
      (el) => (el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true",
    );
    if (!disabled) return true;
    await sleep(200);
  }
  return false;
}

async function captureUrl(page: Page): Promise<string | undefined> {
  const toast = page.locator(LI_SELECTORS.postedToast).first();
  try {
    await toast.waitFor({ state: "visible", timeout: 6000 });
    const href = await toast.getAttribute("href");
    if (href) return absolute(href);
  } catch {
    /* fall through */
  }
  const feedLink = page.locator(LI_SELECTORS.feedFirstPostPermalink).first();
  try {
    await feedLink.waitFor({ state: "visible", timeout: 4000 });
    const href = await feedLink.getAttribute("href");
    if (href) return absolute(href);
  } catch {
    /* ignore */
  }
  return undefined;
}

function absolute(href: string): string {
  if (href.startsWith("http")) return href;
  return `https://www.linkedin.com${href.startsWith("/") ? "" : "/"}${href}`;
}

/** Park the cursor somewhere benign before/after composing — purely cosmetic. */
export async function parkCursor(page: Page, rng: Rng): Promise<void> {
  const x = 200 + rng() * 400;
  const y = 200 + rng() * 400;
  await humanMoveTo(page, { x, y }, rng).catch(() => {});
}
