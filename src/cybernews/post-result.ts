import type { Locator, Page } from "playwright";
import { LI_SELECTORS } from "./selectors-li.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

export async function captureUrl(page: Page): Promise<string | undefined> {
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
