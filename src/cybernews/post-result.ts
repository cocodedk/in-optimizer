import { mkdirSync, writeFileSync } from "node:fs";
import type { Locator, Page } from "playwright";
import { LI_SELECTORS, RECENT_ACTIVITY_URL } from "./selectors-li.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract the activity URN from any LinkedIn href and return the canonical
 * feed permalink. LinkedIn exposes the same URN through several href shapes
 * (`/feed/update/urn:li:activity:<id>/`, `/analytics/post-summary/...`), so
 * we only key off the `urn:li:activity:<id>` token. Returns undefined when no
 * activity URN is present (e.g. `urn:li:share:` or a messaging redirect).
 */
export function activityUrlFromHref(href: string | null | undefined): string | undefined {
  const m = href?.match(/urn:li:activity:(\d+)/);
  if (!m) return undefined;
  return `https://www.linkedin.com/feed/update/urn:li:activity:${m[1]}/`;
}

export async function waitForEnabled(loc: Locator, timeoutMs: number): Promise<boolean> {
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

/**
 * Resolve the URL of the post we just submitted. Two strategies, in order:
 *  1. the ephemeral success toast on /feed/ (fast, no navigation);
 *  2. the newest permalink on the author's /recent-activity/all/ page
 *     (deterministic — independent of the toast firing or feed ordering).
 * On a total miss we dump a diagnostic bundle so selectors can be retriaged
 * against a real fixture (the historical failure mode for this capture).
 */
export async function captureUrl(page: Page): Promise<string | undefined> {
  const fromToast = await fromToastLink(page);
  if (fromToast) return fromToast;
  const fromActivity = await fromRecentActivity(page);
  if (fromActivity) return fromActivity;
  await dumpDiagnostic(page, "urlcap-fail");
  return undefined;
}

async function fromToastLink(page: Page): Promise<string | undefined> {
  const toast = page.locator(LI_SELECTORS.postedToast).first();
  try {
    await toast.waitFor({ state: "visible", timeout: 6000 });
    return activityUrlFromHref(await toast.getAttribute("href"));
  } catch {
    return undefined;
  }
}

async function fromRecentActivity(page: Page): Promise<string | undefined> {
  try {
    // Let the create request commit and the composer dismiss before we
    // navigate away, so we never abandon an in-flight submit.
    await page
      .locator(LI_SELECTORS.composerDialog)
      .first()
      .waitFor({ state: "detached", timeout: 8000 })
      .catch(() => {});
    if (!(await gotoRecentActivity(page))) return undefined;
    const link = page.locator(LI_SELECTORS.activityPermalink).first();
    await link.waitFor({ state: "visible", timeout: 8000 });
    return activityUrlFromHref(await link.getAttribute("href"));
  } catch {
    return undefined;
  }
}

/**
 * Navigate to the author's recent activity, tolerating a one-off client
 * redirect: a restored messaging tab can hijack the first navigation, so we
 * retry once and confirm we actually landed on the activity page.
 */
async function gotoRecentActivity(page: Page): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto(RECENT_ACTIVITY_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await sleep(3000);
    if (page.url().includes("recent-activity")) return true;
  }
  return false;
}

async function dumpDiagnostic(page: Page, reason: string): Promise<void> {
  try {
    const dir = `state/cybernews/diagnostics/${Date.now()}-${reason}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/page.html`, await page.content());
    await page.screenshot({ path: `${dir}/screenshot.png` }).catch(() => {});
  } catch {
    /* best-effort; capture must never throw into the post flow */
  }
}
