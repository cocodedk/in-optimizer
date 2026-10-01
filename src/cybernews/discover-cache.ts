/**
 * Cache for `discover()` results, keyed by handle. Atomic flush via temp +
 * rename. The CLI uses this to avoid hitting the timeline-profile endpoint
 * on every cron tick, and to fall back to stale data when the endpoint
 * 429s. Per-tweet `fetch()` does not need this; only `discover()` does.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import type { DiscoveredTweet } from "./discover.ts";

export type CacheEntry = {
  fetchedAt: string;
  tweets: DiscoveredTweet[];
};

export type CacheFile = Record<string, CacheEntry>;

export class DiscoverCache {
  private readonly path: string;
  private readonly tmp: string;
  private readonly data: CacheFile;

  constructor(dir: string, filename = "discover-cache.json") {
    this.path = join(dir, filename);
    this.tmp = `${this.path}.tmp`;
    mkdirSync(dir, { recursive: true });
    this.data = this.load();
  }

  private load(): CacheFile {
    if (!existsSync(this.path)) return {};
    try {
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      return raw as CacheFile;
    } catch {
      return {};
    }
  }

  private key(handle: string): string {
    return handle.toLowerCase();
  }

  get(handle: string): CacheEntry | undefined {
    return this.data[this.key(handle)];
  }

  /** Age in seconds. `Infinity` if no entry or unparseable timestamp. */
  ageSeconds(handle: string, now: Date = new Date()): number {
    const e = this.get(handle);
    if (!e) return Infinity;
    const t = new Date(e.fetchedAt).getTime();
    if (!Number.isFinite(t)) return Infinity;
    return Math.max(0, (now.getTime() - t) / 1000);
  }

  isFresh(handle: string, ttlSeconds: number, now: Date = new Date()): boolean {
    return this.ageSeconds(handle, now) <= ttlSeconds;
  }

  set(handle: string, tweets: DiscoveredTweet[], now: Date = new Date()): void {
    this.data[this.key(handle)] = { fetchedAt: now.toISOString(), tweets };
  }

  flush(): void {
    writeFileSync(this.tmp, JSON.stringify(this.data, null, 2), "utf8");
    renameSync(this.tmp, this.path);
  }
}

const RATE_LIMIT_RE = /rate-limited by syndication endpoint/;

/** True if the error message matches `discover()`'s 429 throw. */
export function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && RATE_LIMIT_RE.test(err.message);
}
