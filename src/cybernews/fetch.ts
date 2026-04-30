/**
 * Tweet fetcher using the public X syndication API.
 * No auth required for public tweets. Mirrors the BabakCast pattern.
 */

export type TweetMedia =
  | { kind: "photo"; url: string; originalUrl: string }
  | { kind: "video"; url: string; thumbnailUrl?: string }
  | { kind: "animated_gif"; url: string; thumbnailUrl?: string };

export type TweetUser = {
  screenName: string;
  name: string;
};

export type Tweet = {
  id: string;
  text: string;
  createdAt: string;
  user: TweetUser;
  media: TweetMedia[];
  url: string;
};

/**
 * Compute the token the syndication endpoint expects. Empirical formula:
 * `((id / 1e15) * π).toString(36)` with zeros and the decimal point stripped.
 *
 * Direct `Number(id)` loses precision on 19-digit snowflake IDs. We split via
 * BigInt into the high (id / 1e9) and low (id mod 1e9) parts so each piece
 * fits inside a safe integer before being recombined.
 */
export function computeToken(id: string): string {
  const big = BigInt(id);
  const div = 1_000_000_000n; // 1e9
  const highInt = Number(big / div);
  const lowFrac = Number(big % div) / 1e9;
  const id1e15 = (highInt + lowFrac) / 1e6;
  return (id1e15 * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

export function syndicationUrl(id: string, lang = "en"): string {
  const token = computeToken(id);
  return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}&lang=${lang}`;
}

/** Pure parser. Exposed for testability. */
export function parseTweet(json: string): Tweet {
  const obj = JSON.parse(json) as Record<string, unknown>;
  const id = (obj["id_str"] as string) ?? "";
  const text = (obj["text"] as string) ?? "";
  const createdAt = (obj["created_at"] as string) ?? "";
  const userObj = (obj["user"] as Record<string, unknown> | undefined) ?? {};
  const user: TweetUser = {
    screenName: (userObj["screen_name"] as string) ?? "",
    name: (userObj["name"] as string) ?? "",
  };
  const media = parseMedia(obj["mediaDetails"]);
  const url = user.screenName ? `https://x.com/${user.screenName}/status/${id}` : `https://x.com/i/status/${id}`;
  return { id, text, createdAt, user, media, url };
}

function parseMedia(value: unknown): TweetMedia[] {
  if (!Array.isArray(value)) return [];
  const out: TweetMedia[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as Record<string, unknown>;
    const type = m["type"] as string | undefined;
    const mediaUrl = m["media_url_https"] as string | undefined;
    if (type === "photo") {
      if (!mediaUrl) continue;
      out.push({ kind: "photo", url: `${mediaUrl}?name=large`, originalUrl: mediaUrl });
    } else if (type === "video") {
      const url = bestVideoUrl(m);
      if (url) out.push({ kind: "video", url, thumbnailUrl: mediaUrl });
    } else if (type === "animated_gif") {
      const url = bestVideoUrl(m);
      if (url) out.push({ kind: "animated_gif", url, thumbnailUrl: mediaUrl });
    }
  }
  return out;
}

function bestVideoUrl(m: Record<string, unknown>): string | undefined {
  const info = m["video_info"] as Record<string, unknown> | undefined;
  if (!info) return undefined;
  const variants = info["variants"];
  if (!Array.isArray(variants)) return undefined;
  let bestUrl: string | undefined;
  let bestRate = -1;
  for (const v of variants) {
    if (!v || typeof v !== "object") continue;
    const vv = v as Record<string, unknown>;
    if (vv["content_type"] !== "video/mp4") continue;
    const url = vv["url"] as string | undefined;
    if (!url) continue;
    const rate = Number(vv["bitrate"] ?? 0) || 0;
    if (rate > bestRate) {
      bestRate = rate;
      bestUrl = url;
    }
  }
  return bestUrl;
}

/** Fetch + parse one tweet. Throws on HTTP error. */
export async function fetchTweet(id: string, opts: { lang?: string; userAgent?: string } = {}): Promise<Tweet> {
  const url = syndicationUrl(id, opts.lang ?? "en");
  const headers: Record<string, string> = {
    "user-agent": opts.userAgent ?? "Mozilla/5.0 (compatible; in-optimizer/0.0)",
  };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`syndication: HTTP ${res.status} for tweet ${id}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  const body = await res.text();
  if (!ct.includes("application/json")) {
    throw new Error(`syndication: non-JSON response for tweet ${id} (likely missing/private)`);
  }
  return parseTweet(body);
}

/** Download a media URL to a local Uint8Array. */
export async function downloadMedia(mediaUrl: string): Promise<Uint8Array> {
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`download: HTTP ${res.status} for ${mediaUrl}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
