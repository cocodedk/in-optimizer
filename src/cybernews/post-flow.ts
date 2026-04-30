/**
 * End-to-end "post one tweet to LinkedIn" flow used by the CLI's `post`
 * subcommand. Owns the browser lifecycle, calls into poster.ts, and records
 * the outcome to state.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { launchPersistent, isLoggedIn } from "../browser.ts";
import { makeRng } from "../pace.ts";
import { compose, parkCursor, submit } from "./poster.ts";
import { CyberNewsState, type Severity } from "./state.ts";

export type PostFlowOpts = {
  id: string;
  draftPath: string;
  mediaDir?: string;
  stateDir: string;
  profileDir: string;
  severity?: Severity;
  autoPost: boolean;
  headless: boolean;
  seed: number;
  dryRun: boolean;
};

export async function runPostFlow(opts: PostFlowOpts): Promise<number> {
  if (!existsSync(opts.draftPath)) {
    console.error(`draft not found: ${opts.draftPath}`);
    return 2;
  }
  const body = readFileSync(opts.draftPath, "utf8").trim();
  if (!body) {
    console.error("draft is empty");
    return 2;
  }
  const mediaPaths = collectMedia(opts.mediaDir);
  const state = new CyberNewsState(opts.stateDir);
  if (state.isTerminal(opts.id)) {
    const prior = state.recordFor(opts.id)!.outcome;
    console.error(`tweet ${opts.id} already ${prior}`);
    return 0;
  }

  if (opts.dryRun) {
    return reportDryRun(body, mediaPaths, opts, state);
  }

  const rng = makeRng(opts.seed);
  const ctx = await launchPersistent({ profileDir: opts.profileDir, headless: opts.headless });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    if (!(await isLoggedIn(page))) {
      console.error("not logged in. Run `npm run login` first.");
      return 3;
    }
    const composed = await compose(ctx, body, mediaPaths, { rng });
    await parkCursor(composed.page, rng);

    if (!opts.autoPost) {
      console.log(
        "\ncomposer is ready. inspect the modal, then type 'go' (or 'y') to submit. anything else aborts:",
      );
      const ans = (await prompt()).toLowerCase();
      const proceed = ans === "go" || ans === "y" || ans === "yes" || ans === "ja";
      if (!proceed) {
        const reason = ans === "" ? "user-abort-empty" : "user-abort";
        state.markPosted(opts.id, { outcome: "skipped", reason, severity: opts.severity });
        state.appendLog({ id: opts.id, action: "skipped", reason, severity: opts.severity });
        state.flush();
        console.log("aborted. recorded as skipped.");
        return 0;
      }
    }

    const result = await submit(composed.page, rng);
    if (result.status === "posted") {
      state.markPosted(opts.id, { outcome: "posted", liUrl: result.liUrl, severity: opts.severity });
      state.appendLog({ id: opts.id, action: "posted", liUrl: result.liUrl, severity: opts.severity });
      state.flush();
      console.log(`posted${result.liUrl ? ` → ${result.liUrl}` : ""}`);
      return 0;
    }
    state.markPosted(opts.id, { outcome: "failed", reason: result.reason, severity: opts.severity });
    state.appendLog({ id: opts.id, action: "failed", reason: result.reason, severity: opts.severity });
    state.flush();
    console.error(`failed: ${result.reason}`);
    return 4;
  } finally {
    await ctx.close().catch(() => {});
  }
}

function collectMedia(dir: string | undefined): string[] {
  if (!dir || !existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((n) => /\.(jpg|jpeg|png|webp|gif|mp4)$/i.test(n))
    .sort()
    .map((n) => join(dir, n));
}

async function prompt(): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question("> ")).trim();
  } finally {
    rl.close();
  }
}

function reportDryRun(
  body: string,
  mediaPaths: string[],
  opts: PostFlowOpts,
  state: CyberNewsState,
): number {
  console.log("--- dry-run ---");
  console.log(`id:        ${opts.id}`);
  console.log(`severity:  ${opts.severity ?? "(unset)"}`);
  console.log(`media:     ${mediaPaths.length} file(s)`);
  for (const p of mediaPaths) console.log(`  ${p}`);
  console.log("body:");
  console.log(body);
  state.markPosted(opts.id, { outcome: "dryrun", severity: opts.severity });
  state.appendLog({ id: opts.id, action: "dryrun", severity: opts.severity });
  state.flush();
  return 0;
}
