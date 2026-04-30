/**
 * Discover recent tweet IDs from a public X profile via the syndication
 * timeline endpoint. Returns IDs newer than `since` (lexicographic on
 * snowflakes = numeric).
 *
 * The endpoint is rate-limited (~30 req/15min); callers should cache and
 * not poll faster than necessary. If this endpoint blocks, fall back to a
 * Playwright timeline scrape (not implemented in v0).
 */

export type DiscoveredTweet = {
  id: string;
  /** Indicates self-authored (not a retweet) when known. */
  selfAuthored?: boolean;
};

const TIMELINE_BASE = "https://syndication.twitter.com/srv/timeline-profile/screen-name";

export function timelineUrl(handle: string): string {
  return `${TIMELINE_BASE}/${encodeURIComponent(handle)}`;
}

/** Pure parser: extract tweet IDs from the timeline-profile HTML. */
export function parseTimeline(html: string): DiscoveredTweet[] {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  let next: unknown;
  try {
    next = JSON.parse(m[1] ?? "");
  } catch {
    return [];
  }
  const entries = walkToTimelineEntries(next);
  const out: DiscoveredTweet[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const id = pickTweetId(e);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const selfAuthored = pickSelfAuthored(e, walkToHandle(next));
    out.push(selfAuthored === undefined ? { id } : { id, selfAuthored });
  }
  return out;
}

function walkToTimelineEntries(root: unknown): unknown[] {
  const props = (root as Record<string, unknown> | null)?.["props"];
  const pageProps = (props as Record<string, unknown> | undefined)?.["pageProps"];
  const timeline = (pageProps as Record<string, unknown> | undefined)?.["timeline"];
  const entries = (timeline as Record<string, unknown> | undefined)?.["entries"];
  return Array.isArray(entries) ? entries : [];
}

function walkToHandle(root: unknown): string | undefined {
  const props = (root as Record<string, unknown> | null)?.["props"];
  const pageProps = (props as Record<string, unknown> | undefined)?.["pageProps"];
  const screenName = (pageProps as Record<string, unknown> | undefined)?.["screenName"];
  return typeof screenName === "string" ? screenName : undefined;
}

function pickTweetId(entry: unknown): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const e = entry as Record<string, unknown>;
  // Common shapes: { content: { tweet: { id_str } } }, or { tweet: { id_str } }
  const content = (e["content"] as Record<string, unknown> | undefined) ?? e;
  const tweet = (content["tweet"] as Record<string, unknown> | undefined) ?? content;
  const id = (tweet["id_str"] as string | undefined) ?? (tweet["id"] as string | undefined);
  if (typeof id === "string" && /^\d+$/.test(id)) return id;
  return undefined;
}

function pickSelfAuthored(entry: unknown, handle: string | undefined): boolean | undefined {
  if (!entry || typeof entry !== "object" || !handle) return undefined;
  const e = entry as Record<string, unknown>;
  const content = (e["content"] as Record<string, unknown> | undefined) ?? e;
  const tweet = (content["tweet"] as Record<string, unknown> | undefined) ?? content;
  const user = tweet["user"] as Record<string, unknown> | undefined;
  const screenName = user?.["screen_name"];
  if (typeof screenName !== "string") return undefined;
  return screenName.toLowerCase() === handle.toLowerCase();
}

/** Filter to IDs strictly greater than `since`. Uses BigInt so it's safe for short test IDs too. */
export function newSince(ids: DiscoveredTweet[], since: string | undefined): DiscoveredTweet[] {
  if (!since) return ids;
  let cutoff: bigint;
  try {
    cutoff = BigInt(since);
  } catch {
    return ids;
  }
  return ids.filter((t) => {
    try {
      return BigInt(t.id) > cutoff;
    } catch {
      return false;
    }
  });
}

/** Live discovery against the syndication timeline endpoint. */
export async function discover(
  handle: string,
  opts: { userAgent?: string } = {},
): Promise<DiscoveredTweet[]> {
  const url = timelineUrl(handle);
  const headers: Record<string, string> = {
    "user-agent": opts.userAgent ?? "Mozilla/5.0 (compatible; in-optimizer/0.0)",
    "accept": "text/html",
  };
  const res = await fetch(url, { headers, redirect: "follow" });
  if (res.status === 429) {
    throw new Error(`discover: rate-limited by syndication endpoint for ${handle}`);
  }
  if (!res.ok) {
    throw new Error(`discover: HTTP ${res.status} for ${handle}`);
  }
  const html = await res.text();
  return parseTimeline(html);
}
