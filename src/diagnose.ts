import type { Locator, Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type DiagMeta = {
  reason: string;
  url?: string;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");

export async function capture(
  page: Page,
  card: Locator | null,
  rootDir: string,
  meta: DiagMeta,
): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(rootDir, `${ts}-${slug(meta.reason)}`);
  mkdirSync(dir, { recursive: true });

  await page.screenshot({ path: join(dir, "screenshot.png"), fullPage: true }).catch(() => {});
  const pageHtml = await page.content().catch(() => "");
  writeFileSync(join(dir, "page.html"), pageHtml, "utf8");

  if (card) {
    const cardHtml = await card.evaluate((el) => (el as Element).outerHTML).catch(() => "");
    if (cardHtml) writeFileSync(join(dir, "comment.html"), cardHtml, "utf8");
  }

  let snapshot: unknown = null;
  try {
    const a11y = (page as unknown as { accessibility?: { snapshot?: Function } }).accessibility;
    if (a11y && typeof a11y.snapshot === "function") {
      snapshot = await a11y.snapshot.call(a11y, { interestingOnly: false });
    }
  } catch {
    snapshot = null;
  }
  writeFileSync(join(dir, "snapshot.txt"), JSON.stringify(snapshot, null, 2), "utf8");

  writeFileSync(
    join(dir, "meta.json"),
    JSON.stringify({ ts: new Date().toISOString(), pageUrl: page.url(), ...meta }, null, 2),
    "utf8",
  );

  return dir;
}
