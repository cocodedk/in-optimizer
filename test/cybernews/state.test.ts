import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CyberNewsState } from "../../src/cybernews/state.ts";

const newDir = () => mkdtempSync(join(tmpdir(), "cybernews-state-"));

describe("CyberNewsState.appendLog", () => {
  it("creates the directory and writes one JSON line per call", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    s.appendLog({ id: "1", action: "posted", severity: "critical" });
    s.appendLog({ id: "2", action: "skipped" });
    const lines = readFileSync(join(dir, "log.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ id: "1", action: "posted", severity: "critical" });
  });

  it("stamps each entry with an ISO timestamp", () => {
    const dir = newDir();
    new CyberNewsState(dir).appendLog({ id: "1", action: "posted" });
    const entry = JSON.parse(readFileSync(join(dir, "log.jsonl"), "utf8").trim());
    expect(typeof entry.ts).toBe("string");
    expect(new Date(entry.ts).toString()).not.toBe("Invalid Date");
  });
});

describe("CyberNewsState.markPosted / isPosted", () => {
  it("persists across instances", () => {
    const dir = newDir();
    const a = new CyberNewsState(dir);
    a.markPosted("1864123", { outcome: "posted", severity: "critical" });
    a.flush();
    const b = new CyberNewsState(dir);
    expect(b.isPosted("1864123")).toBe(true);
    expect(b.isPosted("9999")).toBe(false);
    expect(b.recordFor("1864123")?.severity).toBe("critical");
  });

  it("ignores corrupt posted.json and starts empty", () => {
    const dir = newDir();
    writeFileSync(join(dir, "posted.json"), "{nope", "utf8");
    const s = new CyberNewsState(dir);
    expect(s.isPosted("anything")).toBe(false);
    s.markPosted("ok", { outcome: "posted" });
    s.flush();
    const reread = new CyberNewsState(dir);
    expect(reread.isPosted("ok")).toBe(true);
  });

  it("writes posted.json atomically (no .tmp left behind)", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    s.markPosted("x", { outcome: "posted" });
    s.flush();
    expect(existsSync(join(dir, "posted.json"))).toBe(true);
    expect(existsSync(join(dir, "posted.json.tmp"))).toBe(false);
  });

  it("isTerminal treats posted/skipped as terminal but not failed/dryrun", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    s.markPosted("a", { outcome: "posted" });
    s.markPosted("b", { outcome: "skipped" });
    s.markPosted("c", { outcome: "failed" });
    s.markPosted("d", { outcome: "dryrun" });
    expect(s.isTerminal("a")).toBe(true);
    expect(s.isTerminal("b")).toBe(true);
    expect(s.isTerminal("c")).toBe(false);
    expect(s.isTerminal("d")).toBe(false);
  });

  it("stuckFailures returns ids with outcome=failed", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    s.markPosted("a", { outcome: "posted" });
    s.markPosted("b", { outcome: "failed" });
    s.markPosted("c", { outcome: "failed" });
    expect(s.stuckFailures().sort()).toEqual(["b", "c"]);
  });
});

describe("CyberNewsState.highWaterMark", () => {
  it("returns the lexicographically highest id", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    s.markPosted("1864123456789", { outcome: "posted" });
    s.markPosted("1864123456999", { outcome: "skipped" });
    s.markPosted("1864123456000", { outcome: "failed" });
    expect(s.highWaterMark()).toBe("1864123456999");
  });

  it("returns undefined when nothing recorded", () => {
    expect(new CyberNewsState(newDir()).highWaterMark()).toBeUndefined();
  });
});

describe("CyberNewsState.postedToday", () => {
  it("returns 0 when state is empty", () => {
    expect(new CyberNewsState(newDir()).postedToday(new Date("2026-04-30T10:00:00Z"))).toBe(0);
  });

  it("counts only `posted` outcomes from the same local date", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    // local date = 2026-04-30 in any TZ that contains UTC noon on that day
    const noon = "2026-04-30T12:00:00Z";
    const earlier = "2026-04-30T07:00:00Z";
    const yesterday = "2026-04-29T12:00:00Z";
    s["posted"].set("a", { outcome: "posted", postedAt: noon });
    s["posted"].set("b", { outcome: "posted", postedAt: earlier });
    s["posted"].set("c", { outcome: "posted", postedAt: yesterday });
    s["posted"].set("d", { outcome: "skipped", postedAt: noon });
    s["posted"].set("e", { outcome: "failed", postedAt: noon });
    s["posted"].set("f", { outcome: "dryrun", postedAt: noon });
    expect(s.postedToday(new Date(noon))).toBe(2);
  });

  it("ignores invalid postedAt timestamps", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    s["posted"].set("a", { outcome: "posted", postedAt: "not-a-date" });
    s["posted"].set("b", { outcome: "posted", postedAt: "2026-04-30T12:00:00Z" });
    expect(s.postedToday(new Date("2026-04-30T12:00:00Z"))).toBe(1);
  });

  it("rolls over at local midnight", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    const justBefore = "2026-04-30T22:30:00Z";
    s["posted"].set("a", { outcome: "posted", postedAt: justBefore });
    expect(s.postedToday(new Date("2026-04-30T22:30:00Z"))).toBe(1);
    expect(s.postedToday(new Date("2026-05-01T22:30:00Z"))).toBe(0);
  });
});

describe("CyberNewsState.summary", () => {
  it("counts outcomes from in-memory state", () => {
    const dir = newDir();
    const s = new CyberNewsState(dir);
    s.markPosted("a", { outcome: "posted" });
    s.markPosted("b", { outcome: "posted" });
    s.markPosted("c", { outcome: "skipped" });
    s.markPosted("d", { outcome: "failed" });
    s.markPosted("e", { outcome: "dryrun" });
    expect(s.summary()).toEqual({ total: 5, posted: 2, skipped: 1, failed: 1, dryrun: 1 });
  });
});
