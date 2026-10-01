import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { discover, newSince, type DiscoveredTweet } from "./cybernews/discover.ts";
import { DiscoverCache, isRateLimitError } from "./cybernews/discover-cache.ts";
import { downloadMedia, fetchTweet } from "./cybernews/fetch.ts";
import { CyberNewsState } from "./cybernews/state.ts";
import { classify } from "./cybernews/severity.ts";
import { pickHashtags } from "./cybernews/hashtags.ts";
import { runPostFlow } from "./cybernews/post-flow.ts";
import { type Args, HELP, parse } from "./cybernews/cli-args.ts";

async function cmdDiscover(a: Args): Promise<number> {
  const state = new CyberNewsState(a.stateDir);
  const since = state.highWaterMark();
  const cache = new DiscoverCache(a.stateDir);

  let all: DiscoveredTweet[];
  let source: "fresh-cache" | "live" | "stale-cache-fallback";
  let cacheAge: number | null = null;

  if (!a.noCache && cache.isFresh(a.handle, a.cacheTtl)) {
    all = cache.get(a.handle)!.tweets;
    source = "fresh-cache";
    cacheAge = Math.round(cache.ageSeconds(a.handle));
  } else {
    try {
      all = await discover(a.handle);
      cache.set(a.handle, all);
      cache.flush();
      source = "live";
    } catch (err) {
      const stale = cache.get(a.handle);
      if (isRateLimitError(err) && stale) {
        all = stale.tweets;
        source = "stale-cache-fallback";
        cacheAge = Math.round(cache.ageSeconds(a.handle));
      } else throw err;
    }
  }

  const fresh = newSince(all, since).slice(0, a.limit);
  if (a.json) {
    process.stdout.write(
      JSON.stringify(
        { handle: a.handle, since, count: fresh.length, source, cacheAgeSeconds: cacheAge, tweets: fresh },
        null,
        2,
      ) + "\n",
    );
  } else {
    console.log(`handle:    @${a.handle}`);
    console.log(`since:     ${since ?? "(none)"}`);
    console.log(`source:    ${source}${cacheAge !== null ? ` (age ${cacheAge}s)` : ""}`);
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
  const today = state.postedToday();
  if (a.json) {
    process.stdout.write(
      JSON.stringify(
        {
          stateDir: a.stateDir,
          highWaterMark: state.highWaterMark() ?? null,
          summary: s,
          postedToday: today,
          dailyCap: a.dailyCap,
        },
        null,
        2,
      ) + "\n",
    );
    return 0;
  }
  console.log(`state:        ${a.stateDir}`);
  console.log(`high-water:   ${state.highWaterMark() ?? "(none)"}`);
  console.log(`postedToday:  ${today} / cap=${a.dailyCap}`);
  console.log(`total:        ${s.total}`);
  console.log(`  posted:     ${s.posted}`);
  console.log(`  skipped:    ${s.skipped}`);
  console.log(`  failed:     ${s.failed}`);
  console.log(`  dryrun:     ${s.dryrun}`);
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
    dailyCap: a.dailyCap,
    force: a.force,
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
