import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DiscoverCache, isRateLimitError } from "../../src/cybernews/discover-cache.ts";

const newDir = () => mkdtempSync(join(tmpdir(), "discover-cache-"));

describe("DiscoverCache", () => {
  it("returns Infinity age and not fresh when no entry exists", () => {
    const c = new DiscoverCache(newDir());
    expect(c.ageSeconds("anyone")).toBe(Infinity);
    expect(c.isFresh("anyone", 9999)).toBe(false);
    expect(c.get("anyone")).toBeUndefined();
  });

  it("set/get round-trips and is case-insensitive on handle", () => {
    const c = new DiscoverCache(newDir());
    c.set("IntCyberDigest", [{ id: "1" }, { id: "2", selfAuthored: true }]);
    expect(c.get("intcyberdigest")?.tweets).toHaveLength(2);
    expect(c.get("INTCYBERDIGEST")?.tweets[0]?.id).toBe("1");
  });

  it("isFresh respects ttl using injected now", () => {
    const c = new DiscoverCache(newDir());
    const t0 = new Date("2026-05-01T10:00:00Z");
    c.set("h", [{ id: "1" }], t0);
    const t1 = new Date("2026-05-01T10:30:00Z"); // +30 min
    expect(c.isFresh("h", 60 * 60, t1)).toBe(true); // 1h ttl
    expect(c.isFresh("h", 15 * 60, t1)).toBe(false); // 15min ttl
    expect(c.ageSeconds("h", t1)).toBe(1800);
  });

  it("flush + reload via fresh instance reads back the same data", () => {
    const dir = newDir();
    const a = new DiscoverCache(dir);
    a.set("h", [{ id: "42" }]);
    a.flush();
    const b = new DiscoverCache(dir);
    expect(b.get("h")?.tweets[0]?.id).toBe("42");
    // file is on-disk JSON
    const parsed = JSON.parse(readFileSync(join(dir, "discover-cache.json"), "utf8"));
    expect(parsed).toMatchObject({ h: { tweets: [{ id: "42" }] } });
  });

  it("ignores corrupt cache file and starts empty", () => {
    const dir = newDir();
    writeFileSync(join(dir, "discover-cache.json"), "{not-json", "utf8");
    const c = new DiscoverCache(dir);
    expect(c.get("h")).toBeUndefined();
    c.set("h", [{ id: "1" }]);
    c.flush();
    expect(new DiscoverCache(dir).get("h")?.tweets[0]?.id).toBe("1");
  });

  it("ignores non-object cache content", () => {
    const dir = newDir();
    writeFileSync(join(dir, "discover-cache.json"), "[1,2,3]", "utf8");
    const c = new DiscoverCache(dir);
    expect(c.get("h")).toBeUndefined();
  });
});

describe("isRateLimitError", () => {
  it("matches the exact message thrown by discover()", () => {
    const e = new Error("discover: rate-limited by syndication endpoint for IntCyberDigest");
    expect(isRateLimitError(e)).toBe(true);
  });

  it("rejects unrelated errors and non-Error values", () => {
    expect(isRateLimitError(new Error("HTTP 500"))).toBe(false);
    expect(isRateLimitError("rate-limited by syndication endpoint")).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
