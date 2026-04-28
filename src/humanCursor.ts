import type { Locator, Page } from "playwright";
import type { Rng } from "./pace.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastX = 200;
let lastY = 200;

type Vec = { x: number; y: number };

function bezier(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

export async function humanMoveTo(
  page: Page,
  target: Vec,
  rng: Rng,
  opts: { steps?: number; minPauseMs?: number; maxPauseMs?: number } = {},
): Promise<void> {
  const start = { x: lastX, y: lastY };
  const dx = target.x - start.x;
  const dy = target.y - start.y;
  const dist = Math.hypot(dx, dy);
  const steps = opts.steps ?? Math.max(15, Math.min(40, Math.round(dist / 12)));

  const mx = (start.x + target.x) / 2;
  const my = (start.y + target.y) / 2;
  const perp = { x: -dy, y: dx };
  const perpLen = Math.hypot(perp.x, perp.y) || 1;
  const wobble = (rng() - 0.5) * Math.min(80, dist * 0.25);
  const c1 = { x: mx + (perp.x / perpLen) * wobble, y: my + (perp.y / perpLen) * wobble };
  const c2 = {
    x: mx + (perp.x / perpLen) * wobble * 0.5 + (rng() - 0.5) * 10,
    y: my + (perp.y / perpLen) * wobble * 0.5 + (rng() - 0.5) * 10,
  };

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = bezier(start, c1, c2, target, t);
    await page.mouse.move(p.x, p.y, { steps: 1 });
    await sleep(4 + rng() * 12);
  }
  lastX = target.x;
  lastY = target.y;
  const minP = opts.minPauseMs ?? 80;
  const maxP = opts.maxPauseMs ?? 220;
  await sleep(minP + rng() * (maxP - minP));
}

export async function humanClick(page: Page, locator: Locator, rng: Rng): Promise<void> {
  await locator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  const box = await locator.boundingBox();
  if (!box) {
    await locator.click({ timeout: 5000 });
    return;
  }
  const cx = box.x + box.width / 2 + (rng() - 0.5) * box.width * 0.3;
  const cy = box.y + box.height / 2 + (rng() - 0.5) * box.height * 0.3;
  await humanMoveTo(page, { x: cx, y: cy }, rng);
  await page.mouse.down();
  await sleep(40 + rng() * 80);
  await page.mouse.up();
}
