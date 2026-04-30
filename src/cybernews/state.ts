import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  readFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

export type Outcome = "posted" | "skipped" | "failed" | "dryrun";

export type Severity = "info" | "notable" | "critical" | "zero-day";

export type PostRecord = {
  outcome: Outcome;
  postedAt: string;
  severity?: Severity;
  liUrl?: string;
  reason?: string;
};

export type LogEntry = {
  id: string;
  action: Outcome;
  severity?: Severity;
  liUrl?: string;
  reason?: string;
  url?: string;
};

export type Summary = {
  total: number;
  posted: number;
  skipped: number;
  failed: number;
  dryrun: number;
};

export class CyberNewsState {
  private readonly logPath: string;
  private readonly postedPath: string;
  private readonly tmpPath: string;
  private posted: Map<string, PostRecord>;

  constructor(dir: string) {
    this.logPath = join(dir, "log.jsonl");
    this.postedPath = join(dir, "posted.json");
    this.tmpPath = join(dir, "posted.json.tmp");
    mkdirSync(dir, { recursive: true });
    this.posted = this.load();
  }

  private load(): Map<string, PostRecord> {
    if (!existsSync(this.postedPath)) return new Map();
    try {
      const obj = JSON.parse(readFileSync(this.postedPath, "utf8")) as Record<
        string,
        PostRecord
      >;
      return new Map(Object.entries(obj));
    } catch {
      return new Map();
    }
  }

  appendLog(entry: LogEntry): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(this.logPath, line + "\n", "utf8");
  }

  markPosted(id: string, record: Omit<PostRecord, "postedAt"> & { postedAt?: string }): void {
    this.posted.set(id, { postedAt: new Date().toISOString(), ...record });
  }

  isPosted(id: string): boolean {
    return this.posted.has(id);
  }

  recordFor(id: string): PostRecord | undefined {
    return this.posted.get(id);
  }

  /** Terminal outcomes shouldn't be retried; "failed" can be retried. */
  isTerminal(id: string): boolean {
    const r = this.posted.get(id);
    return r?.outcome === "posted" || r?.outcome === "skipped";
  }

  /** Iterate non-terminal "failed" entries (for retry pre-pass). */
  stuckFailures(): string[] {
    const out: string[] = [];
    for (const [id, record] of this.posted.entries()) {
      if (record.outcome === "failed") out.push(id);
    }
    return out;
  }

  /** Sorted-descending tweet IDs we've already touched (any outcome). */
  knownIds(): string[] {
    return [...this.posted.keys()].sort((a, b) => (a < b ? 1 : -1));
  }

  /** Highest tweet ID we've seen (lexicographic = numeric on snowflakes). */
  highWaterMark(): string | undefined {
    return this.knownIds()[0];
  }

  flush(): void {
    const obj = Object.fromEntries(this.posted);
    writeFileSync(this.tmpPath, JSON.stringify(obj, null, 2), "utf8");
    renameSync(this.tmpPath, this.postedPath);
  }

  summary(): Summary {
    const s: Summary = { total: 0, posted: 0, skipped: 0, failed: 0, dryrun: 0 };
    for (const r of this.posted.values()) {
      s.total++;
      s[r.outcome]++;
    }
    return s;
  }
}
