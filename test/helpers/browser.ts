import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function pageFor(fixture: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const here = dirname(fileURLToPath(import.meta.url));
  const fixturesDir = join(here, "..", "fixtures");
  const url = pathToFileURL(join(fixturesDir, fixture)).toString();
  const b = await getBrowser();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(url);
  return { ctx, page };
}
