import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { discover, newSince } from "./cybernews/discover.ts";
import { downloadMedia, fetchTweet } from "./cybernews/fetch.ts";
import { CyberNewsState, type Severity } from "./cybernews/state.ts";
import { classify } from "./cybernews/severity.ts";
import { pickHashtags } from "./cybernews/hashtags.ts";
import { runPostFlow } from "./cybernews/post-flow.ts";

type Cmd = "discover" | "fetch" | "post" | "status" | "help";

type Args = {
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
};

function parse(argv: string[]): Args {
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
    else if (v.startsWith("--handle=")) a.handle = v.slice(9);
    else if (v.startsWith("--id=")) a.id = v.slice(5);
    else if (v.startsWith("--state-dir=")) a.stateDir = v.slice(12);
    else if (v.startsWith("--profile-dir=")) a.profileDir = v.slice(14);
    else if (v.startsWith("--media-out=")) a.mediaOut = v.slice(12);
    else if (v.startsWith("--media-dir=")) a.mediaDir = v.slice(12);
    else if (v.startsWith("--draft=")) a.draftPath = v.slice(8);
    else if (v.startsWith("--severity=")) a.severity = v.slice(11) as Severity;
    else if (v.startsWith("--seed=")) a.seed = Number(v.slice(7));
    else if (v.startsWith("--limit=")) a.limit = Number(v.slice(8));
  }
  return a;
}

const HELP = `in-optimizer cyber-news — fetch & post cybersecurity tweets to LinkedIn (Danish).

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
        [--auto-post]                  skip the "press ENTER to submit" gate
        [--headless]                   hide the browser (NOT recommended)
        [--dry-run]                    print body + media list, don't open browser
        [--seed=N]                     RNG seed for reproducibility
  cyber-news status                    show summary of posted/skipped/failed
        [--state-dir=state/cybernews]
  cyber-news help

Notes:
  The destructive step is the post subcommand. It defaults to a confirm
  gate; pass --auto-post only when you've already verified the draft. The
  /in-optimize:cyber-news skill drives the full loop end-to-end.
`;

async function cmdDiscover(a: Args): Promise<number> {
  const state = new CyberNewsState(a.stateDir);
  const since = state.highWaterMark();
  const all = await discover(a.handle);
  const fresh = newSince(all, since).slice(0, a.limit);
  if (a.json) {
    process.stdout.write(JSON.stringify({ handle: a.handle, since, count: fresh.length, tweets: fresh }, null, 2) + "\n");
  } else {
    console.log(`handle:    @${a.handle}`);
    console.log(`since:     ${since ?? "(none)"}`);
    console.log(`fresh:     ${fresh.length}`);
    for (const t of fresh) console.log(`  ${t.id}${t.selfAuthored === false ? " (rt?)" : ""}`);
  }
  return 0;
}

async function cmdFetch(a: Args): Promise<number> {
  if (!a.id) {
    console.error("--id=TWEETID is required");
    return 2;
  }
  const tweet = await fetchTweet(a.id);
  const cls = classify(tweet.text);
  const tags = pickHashtags({ text: tweet.text, severity: cls.severity, signals: cls.signals });
  const payload = {
    tweet,
    classification: cls,
    hashtags: tags,
  };
  if (a.mediaOut) {
    mkdirSync(a.mediaOut, { recursive: true });
    let i = 0;
    for (const m of tweet.media) {
      const ext = inferExt(m.url, m.kind);
      const path = join(a.mediaOut, `${tweet.id}-${i}.${ext}`);
      const bytes = await downloadMedia(m.url);
      writeFileSync(path, bytes);
      i++;
    }
  }
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  return 0;
}

function cmdStatus(a: Args): number {
  const state = new CyberNewsState(a.stateDir);
  const s = state.summary();
  console.log(`state:     ${a.stateDir}`);
  console.log(`high-water: ${state.highWaterMark() ?? "(none)"}`);
  console.log(`total:     ${s.total}`);
  console.log(`  posted:  ${s.posted}`);
  console.log(`  skipped: ${s.skipped}`);
  console.log(`  failed:  ${s.failed}`);
  console.log(`  dryrun:  ${s.dryrun}`);
  return 0;
}

async function cmdPost(a: Args): Promise<number> {
  if (!a.id) {
    console.error("--id=TWEETID is required");
    return 2;
  }
  if (!a.draftPath) {
    console.error("--draft=PATH is required");
    return 2;
  }
  return runPostFlow({
    id: a.id,
    draftPath: a.draftPath,
    mediaDir: a.mediaDir,
    stateDir: a.stateDir,
    profileDir: a.profileDir,
    severity: a.severity,
    autoPost: a.autoPost,
    headless: a.headless,
    dryRun: a.dryRun,
    seed: a.seed,
  });
}

function inferExt(url: string, kind: string): string {
  if (kind === "video" || kind === "animated_gif") return "mp4";
  const m = url.match(/\.(jpg|jpeg|png|webp|gif)\b/i);
  return (m?.[1] ?? "jpg").toLowerCase();
}

async function main(): Promise<void> {
  const a = parse(process.argv.slice(2));
  if (a.cmd === "help") {
    process.stdout.write(HELP);
    process.exit(0);
  }
  try {
    if (a.cmd === "discover") process.exit(await cmdDiscover(a));
    if (a.cmd === "fetch") process.exit(await cmdFetch(a));
    if (a.cmd === "post") process.exit(await cmdPost(a));
    if (a.cmd === "status") process.exit(cmdStatus(a));
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
