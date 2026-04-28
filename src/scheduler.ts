import { jitter, longBreakMs, shouldLongBreak, type Rng } from "./pace.ts";
import type { Decision } from "./errors.ts";

export type SchedulerCfg = {
  baseDelayMs: number;
  jitterFraction: number;
  longBreakEvery: number;
  longBreakMinMs: number;
  longBreakMaxMs: number;
  hourlyCap: number;
  dailyCap: number;
  rng: Rng;
};

export type StepResult =
  | { kind: "go"; ms: number }
  | { kind: "stop"; reason: string };

const BACKOFF_MIN_MS = 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;

export class Scheduler {
  private actions = 0;
  private hourlyActions = 0;
  private hourlyResetAt = Date.now() + 60 * 60_000;
  private aborted: string | null = null;
  private pendingBackoff: number | null = null;

  constructor(private readonly cfg: SchedulerCfg) {}

  async nextDelay(): Promise<StepResult> {
    if (this.aborted) return { kind: "stop", reason: this.aborted };
    if (this.actions >= this.cfg.dailyCap) {
      return { kind: "stop", reason: "daily-cap" };
    }
    this.rolloverHourlyIfDue();
    if (this.hourlyActions >= this.cfg.hourlyCap) {
      return { kind: "stop", reason: "hourly-cap" };
    }

    let ms = 0;
    if (this.pendingBackoff !== null) {
      ms = this.pendingBackoff;
      this.pendingBackoff = null;
    } else if (this.actions === 0) {
      ms = 0;
    } else if (shouldLongBreak(this.actions, this.cfg.longBreakEvery)) {
      ms = longBreakMs(this.cfg.longBreakMinMs, this.cfg.longBreakMaxMs, this.cfg.rng);
    } else {
      ms = jitter(this.cfg.baseDelayMs, this.cfg.jitterFraction, this.cfg.rng);
    }

    this.actions++;
    this.hourlyActions++;
    return { kind: "go", ms };
  }

  applyDecision(d: Decision): void {
    if (d.action === "abort") {
      this.aborted = d.reason;
      return;
    }
    if (d.action === "backoff") {
      const span = BACKOFF_MAX_MS - BACKOFF_MIN_MS;
      this.pendingBackoff = Math.round(BACKOFF_MIN_MS + this.cfg.rng() * span);
    }
  }

  private rolloverHourlyIfDue(): void {
    if (Date.now() >= this.hourlyResetAt) {
      this.hourlyResetAt = Date.now() + 60 * 60_000;
      this.hourlyActions = 0;
    }
  }
}
