import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  readFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

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

export class State {
  private readonly logPath: string;
  private readonly processedPath: string;
  private readonly tmpPath: string;
  private processed: Map<string, Outcome>;

  constructor(dir: string) {
    this.logPath = join(dir, "log.jsonl");
    this.processedPath = join(dir, "processed.json");
    this.tmpPath = join(dir, "processed.json.tmp");
    mkdirSync(dir, { recursive: true });
    this.processed = this.load();
  }

  private load(): Map<string, Outcome> {
    if (!existsSync(this.processedPath)) return new Map();
    try {
      const obj = JSON.parse(readFileSync(this.processedPath, "utf8")) as Record<string, Outcome>;
      return new Map(Object.entries(obj));
    } catch {
      return new Map();
    }
  }

  appendLog(entry: LogEntry): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(this.logPath, line + "\n", "utf8");
  }

  markProcessed(id: string, outcome: Outcome): void {
    this.processed.set(id, outcome);
  }

  isProcessed(id: string): boolean {
    return this.processed.has(id);
  }

  outcomeFor(id: string): Outcome | undefined {
    return this.processed.get(id);
  }

  /** Terminal outcomes shouldn't be retried; "error" can be retried. */
  isTerminal(id: string): boolean {
    const o = this.processed.get(id);
    return o === "deleted" || o === "not-found" || o === "skipped";
  }

  /** Iterate non-terminal "error" entries (for retry pre-pass). */
  stuckErrors(): string[] {
    const out: string[] = [];
    for (const [id, outcome] of this.processed.entries()) {
      if (outcome === "error") out.push(id);
    }
    return out;
  }

  flushProcessed(): void {
    const obj = Object.fromEntries(this.processed);
    writeFileSync(this.tmpPath, JSON.stringify(obj, null, 2), "utf8");
    renameSync(this.tmpPath, this.processedPath);
  }

  summary(): Summary {
    const s: Summary = { total: 0, deleted: 0, "not-found": 0, error: 0, skipped: 0 };
    for (const outcome of this.processed.values()) {
      s.total++;
      s[outcome]++;
    }
    return s;
  }
}
