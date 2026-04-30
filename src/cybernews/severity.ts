/**
 * Pure-logic severity classifier for cybersecurity tweets.
 *
 * Rubric (highest match wins):
 *   zero-day → mention of "zero-day" / "0day" / "in-the-wild" exploitation
 *   critical → CVE + exploited / RCE / wormable / unauth / pre-auth
 *   notable  → CVE present, or "ransomware" / "breach" / "leak" terms
 *   info     → default
 *
 * Keep this file pure — no I/O, no model calls. The skill layers Claude's
 * judgment on top, but this rubric anchors the default and lets us write
 * unit tests.
 */

import type { Severity } from "./state.ts";

export type Signal =
  | "zero-day"
  | "in-the-wild"
  | "cve"
  | "rce"
  | "wormable"
  | "preauth"
  | "ransomware"
  | "breach"
  | "leak"
  | "supply-chain"
  | "scale";

export type Classification = {
  severity: Severity;
  signals: Signal[];
  matchedCves: string[];
};

const PATTERNS: Array<{ signal: Signal; re: RegExp }> = [
  { signal: "zero-day", re: /\b(0[ -]?day|zero[ -]?day)\b/i },
  { signal: "in-the-wild", re: /\b(in[- ]the[- ]wild|actively exploited|exploited in the wild|itw)\b/i },
  { signal: "rce", re: /\b(rce|remote code execution|arbitrary code execution)\b/i },
  { signal: "wormable", re: /\bwormable\b/i },
  { signal: "preauth", re: /\b(pre[- ]?auth|unauthenticated|no auth)\b/i },
  { signal: "ransomware", re: /\b(ransomware|ransom group|cryptolocker)\b/i },
  { signal: "breach", re: /\b(breach|breached|compromised|compromise)\b/i },
  { signal: "leak", re: /\b(leak|leaked|data dump|exposed database)\b/i },
  { signal: "supply-chain", re: /\b(supply[- ]chain|sbom|dependency confusion|typosquat)\b/i },
  { signal: "scale", re: /\b(million|millions|global|worldwide|hundreds of thousands)\b/i },
];

const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/gi;

export function classify(text: string): Classification {
  const signals = collectSignals(text);
  const matchedCves = collectCves(text);
  const has = (s: Signal): boolean => signals.includes(s);

  let severity: Severity = "info";
  if (has("zero-day") || has("in-the-wild")) {
    severity = "zero-day";
  } else if (matchedCves.length > 0 && (has("rce") || has("wormable") || has("preauth"))) {
    severity = "critical";
  } else if (matchedCves.length > 0 || has("ransomware") || has("breach") || has("leak")) {
    severity = "notable";
  } else if (has("rce") || has("supply-chain")) {
    severity = "notable";
  }

  return { severity, signals, matchedCves };
}

function collectSignals(text: string): Signal[] {
  const out: Signal[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) out.push(p.signal);
  }
  return out;
}

function collectCves(text: string): string[] {
  const matches = text.match(CVE_RE);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.toUpperCase()))];
}
