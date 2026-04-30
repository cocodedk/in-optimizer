import {
  mkdirSync,
  appendFileSync,
  writeFileSync,
  readFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Append-only JSONL log + atomic-flush JSON map. Subclasses pick the map
 * filename and the value type; this base handles directory creation,
 * lossy load (corrupt file → empty map), append-only logging with an ISO
 * timestamp prefix, and atomic flush via temp-file + rename.
 *
 * Both the comment-cleaner state (`State`) and the cybernews poster state
 * (`CyberNewsState`) share these invariants — keep the duplication out of
 * the subclasses so a fix here lands in both.
 */
export abstract class JsonlStore<TValue> {
  protected readonly logPath: string;
  protected readonly mapPath: string;
  private readonly tmpPath: string;
  protected readonly records: Map<string, TValue>;

  constructor(dir: string, mapFilename: string) {
    this.logPath = join(dir, "log.jsonl");
    this.mapPath = join(dir, mapFilename);
    this.tmpPath = join(dir, mapFilename + ".tmp");
    mkdirSync(dir, { recursive: true });
    this.records = this.load();
  }

  private load(): Map<string, TValue> {
    if (!existsSync(this.mapPath)) return new Map();
    try {
      const obj = JSON.parse(readFileSync(this.mapPath, "utf8")) as Record<string, TValue>;
      return new Map(Object.entries(obj));
    } catch {
      return new Map();
    }
  }

  protected appendLogLine(entry: object): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(this.logPath, line + "\n", "utf8");
  }

  flush(): void {
    const obj = Object.fromEntries(this.records);
    writeFileSync(this.tmpPath, JSON.stringify(obj, null, 2), "utf8");
    renameSync(this.tmpPath, this.mapPath);
  }
}
