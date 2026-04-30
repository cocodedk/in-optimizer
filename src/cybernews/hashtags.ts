/**
 * Pure rule-based hashtag picker for Danish LinkedIn posts about
 * cybersecurity tweets.
 *
 * Always includes #cybersikkerhed. Adds 2-4 topical tags chosen from
 * matched signals + content keywords. Caps at 5 total.
 */

import type { Severity } from "./state.ts";
import type { Signal } from "./severity.ts";

export type HashtagInput = {
  text: string;
  severity: Severity;
  signals: Signal[];
};

const ALWAYS = "#cybersikkerhed";

const SIGNAL_TAGS: Record<Signal, string> = {
  "zero-day": "#zeroday",
  "in-the-wild": "#exploited",
  cve: "#cve",
  rce: "#rce",
  wormable: "#wormable",
  preauth: "#preauth",
  ransomware: "#ransomware",
  breach: "#databreach",
  leak: "#dataleak",
  "supply-chain": "#supplychain",
  scale: "#globaltrussel",
};

const KEYWORD_TAGS: Array<{ re: RegExp; tag: string }> = [
  { re: /\b(microsoft|windows|azure|exchange|outlook|office)\b/i, tag: "#microsoft" },
  { re: /\b(linux|kernel|ubuntu|debian|red ?hat|rhel)\b/i, tag: "#linux" },
  { re: /\b(android|google play|chrome ?os)\b/i, tag: "#android" },
  { re: /\b(ios|iphone|macos|apple|safari)\b/i, tag: "#apple" },
  { re: /\b(aws|amazon web services|s3|ec2|gcp|google cloud|azure)\b/i, tag: "#cloud" },
  { re: /\b(npm|pypi|composer|gem|crates\.io|maven|github action)\b/i, tag: "#opensource" },
  { re: /\b(hospital|healthcare|patient|medical)\b/i, tag: "#sundhed" },
  { re: /\b(bank|financial|fintech|payment|swift)\b/i, tag: "#finans" },
  { re: /\b(government|municipality|kommune|ministry|ministerium)\b/i, tag: "#offentligsektor" },
  { re: /\b(school|university|education|udannelse)\b/i, tag: "#uddannelse" },
  { re: /\b(phishing|smishing|vishing|social engineering)\b/i, tag: "#phishing" },
  { re: /\b(malware|trojan|backdoor|stealer|infostealer)\b/i, tag: "#malware" },
  { re: /\b(apt|nation[- ]?state|state[- ]?sponsored)\b/i, tag: "#apt" },
  { re: /\b(critical infrastructure|ot security|ics|scada)\b/i, tag: "#kritiskinfrastruktur" },
];

const SEVERITY_TAGS: Record<Severity, string | undefined> = {
  "zero-day": "#zeroday",
  critical: "#kritisk",
  notable: undefined,
  info: undefined,
};

const MAX_TAGS = 5;

export function pickHashtags(input: HashtagInput): string[] {
  const out: string[] = [ALWAYS];
  const seen = new Set<string>([ALWAYS]);

  const push = (tag: string | undefined): void => {
    if (!tag) return;
    if (seen.has(tag)) return;
    if (out.length >= MAX_TAGS) return;
    out.push(tag);
    seen.add(tag);
  };

  push(SEVERITY_TAGS[input.severity]);
  for (const s of input.signals) push(SIGNAL_TAGS[s]);
  for (const k of KEYWORD_TAGS) {
    if (k.re.test(input.text)) push(k.tag);
  }
  return out;
}
