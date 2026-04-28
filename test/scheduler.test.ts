import { describe, it, expect } from "vitest";
import { Scheduler, type SchedulerCfg } from "../src/scheduler.ts";
import { makeRng } from "../src/pace.ts";

const cfg = (over: Partial<SchedulerCfg> = {}): SchedulerCfg => ({
  baseDelayMs: 1000,
  jitterFraction: 0.4,
  longBreakEvery: 3,
  longBreakMinMs: 2000,
  longBreakMaxMs: 4000,
  hourlyCap: 1000,
  dailyCap: 1000,
  rng: makeRng(1),
  ...over,
});

const collect = async (s: Scheduler, n: number) => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = await s.nextDelay();
    if (r.kind === "stop") break;
    out.push(r.ms);
  }
  return out;
};

describe("Scheduler.nextDelay", () => {
  it("returns 0 for the very first action", async () => {
    const s = new Scheduler(cfg());
    const r = await s.nextDelay();
    expect(r).toEqual({ kind: "go", ms: 0 });
  });

  it("returns a jittered base delay between subsequent actions", async () => {
    const s = new Scheduler(cfg());
    await s.nextDelay();
    const r = await s.nextDelay();
    expect(r.kind).toBe("go");
    if (r.kind === "go") {
      expect(r.ms).toBeGreaterThanOrEqual(600);
      expect(r.ms).toBeLessThanOrEqual(1400);
    }
  });

  it("inserts a long break every N actions", async () => {
    const s = new Scheduler(cfg({ longBreakEvery: 3 }));
    const delays = await collect(s, 6);
    expect(delays.length).toBe(6);
    expect(delays[3]).toBeGreaterThanOrEqual(2000);
  });

  it("stops after hourlyCap actions", async () => {
    const s = new Scheduler(cfg({ hourlyCap: 4, longBreakEvery: 0 }));
    const delays = await collect(s, 10);
    expect(delays.length).toBe(4);
    const stop = await s.nextDelay();
    expect(stop.kind).toBe("stop");
    if (stop.kind === "stop") expect(stop.reason).toBe("hourly-cap");
  });

  it("stops after dailyCap regardless of hourly", async () => {
    const s = new Scheduler(cfg({ hourlyCap: 100, dailyCap: 2, longBreakEvery: 0 }));
    const delays = await collect(s, 10);
    expect(delays.length).toBe(2);
    const stop = await s.nextDelay();
    expect(stop.kind).toBe("stop");
    if (stop.kind === "stop") expect(stop.reason).toBe("daily-cap");
  });
});

describe("Scheduler.applyDecision", () => {
  it("backoff schedules a long pause then continues", async () => {
    const s = new Scheduler(cfg());
    s.applyDecision({ action: "backoff", reason: "rate-limit" });
    const r = await s.nextDelay();
    expect(r.kind).toBe("go");
    if (r.kind === "go") expect(r.ms).toBeGreaterThanOrEqual(60_000);
  });

  it("abort flips the scheduler to stop forever", async () => {
    const s = new Scheduler(cfg());
    s.applyDecision({ action: "abort", reason: "login-required" });
    const r = await s.nextDelay();
    expect(r.kind).toBe("stop");
    if (r.kind === "stop") expect(r.reason).toBe("login-required");
  });
});
