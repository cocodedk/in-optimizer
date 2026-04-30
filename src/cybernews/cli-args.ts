import type { Severity } from "./state.ts";

export type Cmd = "discover" | "fetch" | "post" | "status" | "help";

export type Args = {
  cmd: Cmd;
  handle: string;
  id?: string;
  stateDir: string;
  mediaOut?: string;
  mediaDir?: string;
  draftPath?: string;
  profileDir: string;
  severity?: Severity;
  json: boolean;
  limit: number;
  autoPost: boolean;
  headless: boolean;
  dryRun: boolean;
  seed: number;
  dailyCap: number;
  force: boolean;
};

const SEVERITIES: readonly Severity[] = ["info", "notable", "critical", "zero-day"];

function parseSeverity(value: string): Severity {
  if ((SEVERITIES as readonly string[]).includes(value)) return value as Severity;
  console.error(`invalid --severity=${value}. expected one of: ${SEVERITIES.join(", ")}`);
  process.exit(2);
}

export function parse(argv: string[]): Args {
  const a: Args = {
    cmd: "help",
    handle: "IntCyberDigest",
    stateDir: "state/cybernews",
    profileDir: ".profile",
    json: false,
    limit: 20,
    autoPost: false,
    headless: false,
    dryRun: false,
    seed: Date.now() & 0xffff_ffff,
    dailyCap: 3,
    force: false,
  };
  if (!argv[0]) return a;
  const cmd = argv[0];
  if (cmd === "discover" || cmd === "fetch" || cmd === "post" || cmd === "status" || cmd === "help") a.cmd = cmd;
  for (let i = 1; i < argv.length; i++) {
    const v = argv[i]!;
    if (v === "--json") a.json = true;
    else if (v === "--auto-post") a.autoPost = true;
    else if (v === "--headless") a.headless = true;
    else if (v === "--dry-run") a.dryRun = true;
    else if (v === "--force") a.force = true;
    else if (v.startsWith("--daily-cap=")) a.dailyCap = Number(v.slice(12));
    else if (v.startsWith("--handle=")) a.handle = v.slice(9);
    else if (v.startsWith("--id=")) a.id = v.slice(5);
    else if (v.startsWith("--state-dir=")) a.stateDir = v.slice(12);
    else if (v.startsWith("--profile-dir=")) a.profileDir = v.slice(14);
    else if (v.startsWith("--media-out=")) a.mediaOut = v.slice(12);
    else if (v.startsWith("--media-dir=")) a.mediaDir = v.slice(12);
    else if (v.startsWith("--draft=")) a.draftPath = v.slice(8);
    else if (v.startsWith("--severity=")) a.severity = parseSeverity(v.slice(11));
    else if (v.startsWith("--seed=")) a.seed = Number(v.slice(7));
    else if (v.startsWith("--limit=")) a.limit = Number(v.slice(8));
  }
  return a;
}

export const HELP = `in-optimizer cyber-news — fetch & post cybersecurity tweets to LinkedIn (Danish).

Usage:
  cyber-news discover                  list new tweet IDs from a handle since high-water mark
        [--handle=IntCyberDigest]
        [--state-dir=state/cybernews]
        [--limit=20]
        [--json]
  cyber-news fetch --id=TWEETID        fetch one tweet (text + media), print classification
        [--media-out=DIR]              also download media files into DIR
        [--json]
  cyber-news post --id=ID --draft=PATH compose & submit one LinkedIn post
        [--media-dir=DIR]              attach images/videos from DIR (sorted by name)
        [--severity=info|notable|critical|zero-day]
        [--profile-dir=.profile]
        [--auto-post]                  skip the confirmation gate (default: type "go" to submit)
        [--headless]                   hide the browser (NOT recommended)
        [--dry-run]                    print body + media list, don't open browser
        [--seed=N]                     RNG seed for reproducibility
        [--daily-cap=N]                max posts per local day (default 3, 0 disables)
        [--force]                      bypass the daily cap
  cyber-news status                    show summary of posted/skipped/failed
        [--state-dir=state/cybernews]
        [--json]                       JSON output (includes postedToday)
  cyber-news help

Notes:
  The destructive step is the post subcommand. It defaults to a confirm
  gate; pass --auto-post only when you've already verified the draft. The
  /in-optimize:cyber-news skill drives the full loop end-to-end.
`;
