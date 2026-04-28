import { firstPage, isLoggedIn, launchPersistent } from "./browser.ts";
import { runDeleteComments } from "./runner.ts";
import { Scheduler } from "./scheduler.ts";
import { ErrorBudget } from "./errors.ts";
import { makeRng } from "./pace.ts";
import { ACTIVITY_COMMENTS_URL } from "./selectors.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Args = {
  cmd: "login" | "run" | "probe" | "help";
  dryRun: boolean;
  max: number;
  profileDir: string;
  stateDir: string;
  headless: boolean;
  collectPath?: string;
  onlyIdsPath?: string;
};

function parse(argv: string[]): Args {
  const a: Args = {
    cmd: "help",
    dryRun: false,
    max: 100,
    profileDir: ".profile",
    stateDir: "state",
    headless: false,
  };
  if (!argv[0]) return a;
  const cmd = argv[0];
  if (cmd === "login" || cmd === "run" || cmd === "probe" || cmd === "help") a.cmd = cmd;
  for (let i = 1; i < argv.length; i++) {
    const v = argv[i]!;
    if (v === "--dry-run") a.dryRun = true;
    else if (v === "--headless") a.headless = true;
    else if (v.startsWith("--max=")) a.max = Number(v.slice(6));
    else if (v.startsWith("--limit=")) a.max = Number(v.slice(8));
    else if (v.startsWith("--profile-dir=")) a.profileDir = v.slice(14);
    else if (v.startsWith("--state-dir=")) a.stateDir = v.slice(12);
    else if (v.startsWith("--collect=")) a.collectPath = v.slice(10);
    else if (v.startsWith("--only-ids=")) a.onlyIdsPath = v.slice(11);
  }
  if (a.collectPath) a.dryRun = true;
  return a;
}

const HELP = `in-optimizer — delete your own LinkedIn comments, slowly.

Usage:
  in-optimizer login                  open Chromium so you can sign in
  in-optimizer probe                  check whether the saved profile is logged in
  in-optimizer run                    delete comments from /in/me/recent-activity/comments/
        [--dry-run]                   list what would be deleted, don't click
        [--max=N | --limit=N]         hard cap on items in this run (default 100)
        [--profile-dir=./.profile]    where browser profile lives
        [--state-dir=./state]         where logs/diagnostics go
        [--headless]                  hide the browser (NOT recommended)
        [--collect=PATH]              write enumerated comments to PATH as JSON; implies --dry-run
        [--only-ids=PATH]             only process comment ids listed in PATH (one per line)

Defaults pace ~1 delete / 5–8 s, with a long break every 20 deletes, an hourly
cap of 200, and a daily cap of 500. See README.md.`;

async function main() {
  const args = parse(process.argv.slice(2));

  if (args.cmd === "help") {
    console.log(HELP);
    return;
  }

  if (args.cmd === "login") {
    const ctx = await launchPersistent({ profileDir: args.profileDir, headless: false });
    const page = await firstPage(ctx);
    await page.goto("https://www.linkedin.com/login");
    console.log("Sign in in the open window. I'll auto-close when you reach the feed.");
    const deadline = Date.now() + 15 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const url = page.url();
      if (
        url.startsWith("https://www.linkedin.com/feed") ||
        url.startsWith("https://www.linkedin.com/home")
      ) {
        console.log("login detected — saving profile and closing.");
        break;
      }
    }
    await ctx.close();
    return;
  }

  if (args.cmd === "probe") {
    const ctx = await launchPersistent({ profileDir: args.profileDir, headless: args.headless });
    const page = await firstPage(ctx);
    const ok = await isLoggedIn(page);
    if (ok) {
      await page.goto(ACTIVITY_COMMENTS_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      console.log(`logged in — opened ${page.url()}`);
    } else {
      console.log("NOT logged in");
    }
    await ctx.close();
    return;
  }

  if (args.cmd === "run") {
    const ctx = await launchPersistent({ profileDir: args.profileDir, headless: args.headless });
    const rng = makeRng(Date.now() & 0xffff);
    const scheduler = new Scheduler({
      baseDelayMs: 6_000,
      jitterFraction: 0.4,
      longBreakEvery: 20,
      longBreakMinMs: 30_000,
      longBreakMaxMs: 90_000,
      hourlyCap: 200,
      dailyCap: 500,
      rng,
    });
    const budget = new ErrorBudget({ pauseAt: 3, abortAt: 10 });
    const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);
    const onlyIds = args.onlyIdsPath
      ? new Set(
          readFileSync(resolve(args.onlyIdsPath), "utf8")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : undefined;
    const { summary } = await runDeleteComments(ctx, {
      stateDir: resolve(args.stateDir),
      scheduler,
      budget,
      micro: { baseMs: 700, fraction: 0.4, rng },
      maxIds: args.max,
      scrollPauseMs: 4000,
      dryRun: args.dryRun,
      log,
      collectPath: args.collectPath ? resolve(args.collectPath) : undefined,
      onlyIds,
    });
    console.log("summary:", JSON.stringify(summary, null, 2));
    await ctx.close();
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
