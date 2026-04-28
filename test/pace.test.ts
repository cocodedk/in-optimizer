import { describe, it, expect } from "vitest";
import { jitter, makeRng, shouldLongBreak, longBreakMs } from "../src/pace.ts";

describe("jitter", () => {
  it("stays within base ± fraction", () => {
    const rng = makeRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = jitter(1000, 0.4, rng);
      expect(v).toBeGreaterThanOrEqual(600);
      expect(v).toBeLessThanOrEqual(1400);
    }
  });

  it("is deterministic given the same seed", () => {
    const a = makeRng(7);
    const b = makeRng(7);
    const seqA = Array.from({ length: 5 }, () => jitter(1000, 0.4, a));
    const seqB = Array.from({ length: 5 }, () => jitter(1000, 0.4, b));
    expect(seqA).toEqual(seqB);
  });

  it("rounds to integer milliseconds", () => {
    const rng = makeRng(1);
    for (let i = 0; i < 100; i++) {
      expect(Number.isInteger(jitter(1000, 0.4, rng))).toBe(true);
    }
  });

  it("rejects fraction outside [0, 1)", () => {
    const rng = makeRng(0);
    expect(() => jitter(1000, -0.1, rng)).toThrow();
    expect(() => jitter(1000, 1, rng)).toThrow();
  });

  it("rejects non-positive base", () => {
    const rng = makeRng(0);
    expect(() => jitter(0, 0.2, rng)).toThrow();
    expect(() => jitter(-5, 0.2, rng)).toThrow();
  });
});

describe("shouldLongBreak", () => {
  it("triggers exactly at the configured cadence", () => {
    expect(shouldLongBreak(0, 30)).toBe(false);
    expect(shouldLongBreak(29, 30)).toBe(false);
    expect(shouldLongBreak(30, 30)).toBe(true);
    expect(shouldLongBreak(60, 30)).toBe(true);
    expect(shouldLongBreak(61, 30)).toBe(false);
  });

  it("never triggers when cadence is zero", () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldLongBreak(i, 0)).toBe(false);
    }
  });
});

describe("longBreakMs", () => {
  it("falls within configured min/max", () => {
    const rng = makeRng(99);
    for (let i = 0; i < 500; i++) {
      const v = longBreakMs(60_000, 180_000, rng);
      expect(v).toBeGreaterThanOrEqual(60_000);
      expect(v).toBeLessThanOrEqual(180_000);
    }
  });

  it("rejects min >= max", () => {
    const rng = makeRng(0);
    expect(() => longBreakMs(100, 100, rng)).toThrow();
    expect(() => longBreakMs(200, 100, rng)).toThrow();
  });
});
