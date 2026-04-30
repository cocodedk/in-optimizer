import { JsonlStore } from "./state-base.ts";

export type Outcome = "deleted" | "not-found" | "error" | "skipped";

export type LogEntry = {
  id: string;
  action: Outcome;
  reason?: string;
  url?: string;
  snippet?: string;
};

export type Summary = {
  total: number;
  deleted: number;
  "not-found": number;
  error: number;
  skipped: number;
};

export class State extends JsonlStore<Outcome> {
  constructor(dir: string) {
    super(dir, "processed.json");
  }

  appendLog(entry: LogEntry): void {
    this.appendLogLine(entry);
  }

  markProcessed(id: string, outcome: Outcome): void {
    if (this.isTerminal(id)) return;
    this.records.set(id, outcome);
  }

  isProcessed(id: string): boolean {
    return this.records.has(id);
  }

  outcomeFor(id: string): Outcome | undefined {
    return this.records.get(id);
  }

  /** Terminal outcomes shouldn't be retried; "error" can be retried. */
  isTerminal(id: string): boolean {
    const o = this.records.get(id);
    return o === "deleted" || o === "not-found" || o === "skipped";
  }

  /** Iterate non-terminal "error" entries (for retry pre-pass). */
  stuckErrors(): string[] {
    const out: string[] = [];
    for (const [id, outcome] of this.records.entries()) {
      if (outcome === "error") out.push(id);
    }
    return out;
  }

  /** Backwards-compat alias for `flush()`; the runner calls this. */
  flushProcessed(): void {
    this.flush();
  }

  summary(): Summary {
    const s: Summary = { total: 0, deleted: 0, "not-found": 0, error: 0, skipped: 0 };
    for (const outcome of this.records.values()) {
      s.total++;
      s[outcome]++;
    }
    return s;
  }
}
