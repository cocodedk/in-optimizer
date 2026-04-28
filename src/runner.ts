import type { BrowserContext, Page } from "playwright";
import { State } from "./state.ts";
import { Scheduler } from "./scheduler.ts";
import { ErrorBudget } from "./errors.ts";
import { deleteComment, type MicroPace } from "./delete.ts";
import { capture } from "./diagnose.ts";
import { enumerateComments, locateCard, type Comment } from "./commentDetector.ts";
import { scrollAndExpand } from "./scroll.ts";
import { ACTIVITY_COMMENTS_URL, isLoggedOutUrl } from "./selectors.ts";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export type RunOpts = {
  stateDir: string;
  scheduler: Scheduler;
  budget: ErrorBudget;
  micro: MicroPace;
  maxIds: number;
  scrollPauseMs: number;
  dryRun: boolean;
  log: (msg: string) => void;
  collectPath?: string;
  onlyIds?: Set<string>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SETTLE_AFTER_DELETE_MS = 1500;
const MAX_ATTEMPTS_PER_ID = 3;
const MAX_IDLE_SCROLLS = 8;
const RELOAD_AFTER_IDLE = 4;

export async function runDeleteComments(
  ctx: BrowserContext,
  opts: RunOpts,
): Promise<{ summary: ReturnType<State["summary"]> }> {
  const state = new State(opts.stateDir);
  const diagDir = join(opts.stateDir, "diagnostics");
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  await page.goto(ACTIVITY_COMMENTS_URL, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await sleep(3000);

  if (isLoggedOutUrl(page.url())) {
    opts.log("not logged in — run `npm run login` first");
    return { summary: state.summary() };
  }

  if (opts.dryRun) return await runDryRun(page, state, opts);
  return await runInPlace(page, state, diagDir, opts);
}

async function runDryRun(page: Page, state: State, opts: RunOpts) {
  opts.log("dry-run: enumerating my comments, no clicks...");
  let idleScrolls = 0;
  const seen = new Map<string, Comment>();

  while (idleScrolls < MAX_IDLE_SCROLLS && seen.size < opts.maxIds) {
    const items = await enumerateComments(page);
    const before = seen.size;
    for (const it of items) {
      if (seen.size >= opts.maxIds) break;
      if (state.isTerminal(it.id)) continue;
      if (opts.onlyIds && !opts.onlyIds.has(it.id)) continue;
      if (!seen.has(it.id)) seen.set(it.id, it);
    }
    if (seen.size === before) idleScrolls++;
    else idleScrolls = 0;
    if (seen.size >= opts.maxIds) break;
    await scrollAndExpand(page, opts.scrollPauseMs);
  }

  if (opts.collectPath) {
    const payload = {
      capturedAt: new Date().toISOString(),
      url: ACTIVITY_COMMENTS_URL,
      comments: Array.from(seen.values()),
    };
    writeFileSync(opts.collectPath, JSON.stringify(payload, null, 2), "utf8");
    opts.log(`collected ${seen.size} → ${opts.collectPath}`);
    return { summary: state.summary() };
  }

  const lines: string[] = [];
  for (const it of seen.values()) lines.push(`  ${it.id}  ${it.snippet}`);
  opts.log(`dry-run: would delete ${seen.size}:\n${lines.join("\n")}`);
  return { summary: state.summary() };
}

async function runInPlace(page: Page, state: State, diagDir: string, opts: RunOpts) {
  const attempts = new Map<string, number>();
  let idleScrolls = 0;
  let processed = 0;

  while (processed < opts.maxIds) {
    const step = await opts.scheduler.nextDelay();
    if (step.kind === "stop") {
      opts.log(`scheduler stopped: ${step.reason}`);
      break;
    }
    if (step.ms >= 15_000) {
      opts.log(`long break ${(step.ms / 1000).toFixed(0)}s...`);
    }
    if (step.ms > 0) await sleep(step.ms);

    const items = await enumerateComments(page);
    const next = items.find(
      (it) =>
        !state.isTerminal(it.id) &&
        (attempts.get(it.id) ?? 0) < MAX_ATTEMPTS_PER_ID &&
        (!opts.onlyIds || opts.onlyIds.has(it.id)),
    );

    if (!next) {
      idleScrolls++;
      if (idleScrolls >= MAX_IDLE_SCROLLS) {
        opts.log(`no more comments after ${MAX_IDLE_SCROLLS} idle scrolls — done.`);
        break;
      }
      if (idleScrolls === RELOAD_AFTER_IDLE) {
        opts.log("idle, reloading activity-comments to refresh feed...");
        await page.goto(ACTIVITY_COMMENTS_URL, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        await sleep(3000);
      } else {
        await scrollAndExpand(page, opts.scrollPauseMs);
      }
      continue;
    }
    idleScrolls = 0;

    const cardLoc = locateCard(page, next);
    try {
      await cardLoc.scrollIntoViewIfNeeded({ timeout: 5000 });
    } catch {
      // deleteComment will surface its own click errors
    }

    const r = await deleteComment(page, cardLoc, opts.micro);
    state.appendLog({
      id: next.id,
      action: r.outcome,
      reason: r.reason,
      url: next.url,
      snippet: next.snippet,
    });

    if (r.outcome === "error") {
      const n = (attempts.get(next.id) ?? 0) + 1;
      attempts.set(next.id, n);
      await capture(page, cardLoc, diagDir, { reason: r.reason ?? "unknown", url: next.url });
      if (n >= MAX_ATTEMPTS_PER_ID) {
        state.markProcessed(next.id, "skipped");
        opts.log(`${next.id} → skipped after ${n} errors (last: ${r.reason})`);
      } else {
        state.markProcessed(next.id, "error");
        opts.log(`${next.id} → error attempt ${n}/${MAX_ATTEMPTS_PER_ID}: ${r.reason}`);
      }
      opts.budget.recordError();
      if (opts.budget.shouldAbort()) {
        opts.log("aborting: too many consecutive errors");
        state.flushProcessed();
        break;
      }
      if (opts.budget.shouldPause()) {
        opts.log("pausing 30 min after consecutive errors");
        await sleep(30 * 60_000);
      }
      await page.goto(ACTIVITY_COMMENTS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await sleep(2500);
    } else {
      state.markProcessed(next.id, r.outcome);
      opts.budget.recordSuccess();
      attempts.delete(next.id);
      processed++;
      opts.log(`${next.id} → ${r.outcome}`);
    }
    state.flushProcessed();

    await sleep(SETTLE_AFTER_DELETE_MS);
  }

  return { summary: state.summary() };
}
