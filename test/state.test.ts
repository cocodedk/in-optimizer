import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { State } from "../src/state.ts";

const newDir = () => mkdtempSync(join(tmpdir(), "in-optimizer-state-"));

describe("State.appendLog", () => {
  it("creates the directory and writes one JSON line per call", () => {
    const dir = newDir();
    const state = new State(dir);
    state.appendLog({ id: "a", action: "deleted" });
    state.appendLog({ id: "b", action: "not-found" });
    const lines = readFileSync(join(dir, "log.jsonl"), "utf8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({ id: "a", action: "deleted" });
    expect(JSON.parse(lines[1]!)).toMatchObject({ id: "b" });
  });

  it("stamps each entry with an ISO timestamp", () => {
    const dir = newDir();
    new State(dir).appendLog({ id: "a", action: "deleted" });
    const line = readFileSync(join(dir, "log.jsonl"), "utf8").trim();
    const entry = JSON.parse(line);
    expect(typeof entry.ts).toBe("string");
    expect(new Date(entry.ts).toString()).not.toBe("Invalid Date");
  });
});

describe("State.markProcessed / isProcessed", () => {
  it("persists across instances", () => {
    const dir = newDir();
    const a = new State(dir);
    a.markProcessed("urn:li:comment:1", "deleted");
    a.flushProcessed();
    const b = new State(dir);
    expect(b.isProcessed("urn:li:comment:1")).toBe(true);
    expect(b.isProcessed("urn:li:comment:999")).toBe(false);
  });

  it("ignores corrupt processed.json and starts empty", () => {
    const dir = newDir();
    writeFileSync(join(dir, "processed.json"), "{not json", "utf8");
    const s = new State(dir);
    expect(s.isProcessed("anything")).toBe(false);
    s.markProcessed("ok", "deleted");
    s.flushProcessed();
    const reread = new State(dir);
    expect(reread.isProcessed("ok")).toBe(true);
  });

  it("writes processed.json atomically (no .tmp left behind)", () => {
    const dir = newDir();
    const s = new State(dir);
    s.markProcessed("x", "deleted");
    s.flushProcessed();
    expect(existsSync(join(dir, "processed.json"))).toBe(true);
    expect(existsSync(join(dir, "processed.json.tmp"))).toBe(false);
  });

  it("isTerminal treats deleted/not-found/skipped as terminal but not error", () => {
    const dir = newDir();
    const s = new State(dir);
    s.markProcessed("a", "deleted");
    s.markProcessed("b", "not-found");
    s.markProcessed("c", "skipped");
    s.markProcessed("d", "error");
    expect(s.isTerminal("a")).toBe(true);
    expect(s.isTerminal("b")).toBe(true);
    expect(s.isTerminal("c")).toBe(true);
    expect(s.isTerminal("d")).toBe(false);
  });

  it("stuckErrors returns ids with outcome=error", () => {
    const dir = newDir();
    const s = new State(dir);
    s.markProcessed("a", "deleted");
    s.markProcessed("b", "error");
    s.markProcessed("c", "error");
    expect(s.stuckErrors().sort()).toEqual(["b", "c"]);
  });
});

describe("State.summary", () => {
  it("counts outcomes from in-memory state", () => {
    const dir = newDir();
    const s = new State(dir);
    s.markProcessed("a", "deleted");
    s.markProcessed("b", "deleted");
    s.markProcessed("c", "not-found");
    s.markProcessed("d", "error");
    expect(s.summary()).toEqual({
      total: 4,
      deleted: 2,
      "not-found": 1,
      error: 1,
      skipped: 0,
    });
  });
});
