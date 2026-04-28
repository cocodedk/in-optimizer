export type Signal =
  | { kind: "redirect"; url: string }
  | { kind: "http"; status: number }
  | { kind: "toast"; text: string }
  | { kind: "selector-missing"; selector: string };

export type Action = "continue" | "retry" | "backoff" | "abort";

export type Decision = { action: Action; reason: string };

export function classifySignal(sig: Signal): Decision {
  switch (sig.kind) {
    case "redirect":
      // checkpoint must be checked first — those URLs also contain "/login".
      if (sig.url.includes("/checkpoint/")) {
        return { action: "abort", reason: "account-checkpoint" };
      }
      if (sig.url.includes("/login") || sig.url.includes("/uas/login")) {
        return { action: "abort", reason: "login-required" };
      }
      return { action: "continue", reason: "unknown-redirect" };
    case "http":
      if (sig.status === 429) return { action: "backoff", reason: "rate-limit" };
      if (sig.status === 404) return { action: "continue", reason: "not-found" };
      if (sig.status >= 500) return { action: "retry", reason: "server-error" };
      return { action: "continue", reason: `http-${sig.status}` };
    case "toast": {
      const t = sig.text.toLowerCase();
      if (
        t.includes("rate limit") ||
        t.includes("try again later") ||
        t.includes("too many")
      ) {
        return { action: "backoff", reason: "rate-limit" };
      }
      if (t.includes("something went wrong")) {
        return { action: "retry", reason: "transient" };
      }
      return { action: "continue", reason: "unknown-toast" };
    }
    case "selector-missing":
      return { action: "continue", reason: "selector-missing" };
    default:
      return { action: "continue", reason: "unknown-signal" };
  }
}

export type BudgetConfig = { pauseAt: number; abortAt: number };

export class ErrorBudget {
  private consecutive = 0;
  constructor(private readonly cfg: BudgetConfig) {
    if (cfg.pauseAt <= 0 || cfg.abortAt <= 0) {
      throw new Error("ErrorBudget: thresholds must be positive");
    }
    if (cfg.abortAt < cfg.pauseAt) {
      throw new Error("ErrorBudget: abortAt must be >= pauseAt");
    }
  }
  recordError(): void {
    this.consecutive++;
  }
  recordSuccess(): void {
    this.consecutive = 0;
  }
  shouldPause(): boolean {
    return this.consecutive >= this.cfg.pauseAt && this.consecutive < this.cfg.abortAt;
  }
  shouldAbort(): boolean {
    return this.consecutive >= this.cfg.abortAt;
  }
}
