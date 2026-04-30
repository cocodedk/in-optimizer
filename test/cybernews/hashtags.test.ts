import { describe, it, expect } from "vitest";
import { pickHashtags } from "../../src/cybernews/hashtags.ts";

describe("pickHashtags", () => {
  it("always includes #cybersikkerhed first", () => {
    const tags = pickHashtags({ text: "anything", severity: "info", signals: [] });
    expect(tags[0]).toBe("#cybersikkerhed");
  });

  it("adds zero-day signal + severity tag", () => {
    const tags = pickHashtags({
      text: "zero-day in widget",
      severity: "zero-day",
      signals: ["zero-day"],
    });
    expect(tags).toContain("#zeroday");
    // dedupe — appears once even though severity and signal both map to it
    expect(tags.filter((t) => t === "#zeroday")).toHaveLength(1);
  });

  it("adds #kritisk for critical severity", () => {
    const tags = pickHashtags({
      text: "CVE-2026-1234 RCE in widget",
      severity: "critical",
      signals: ["rce", "cve"],
    });
    expect(tags).toContain("#kritisk");
  });

  it("picks vendor keyword tags", () => {
    const tags = pickHashtags({
      text: "Microsoft Exchange flaw patched today",
      severity: "notable",
      signals: [],
    });
    expect(tags).toContain("#microsoft");
  });

  it("picks sector keyword tags (Danish names)", () => {
    const tags = pickHashtags({
      text: "Hospital ransomware shutdown",
      severity: "notable",
      signals: ["ransomware"],
    });
    expect(tags).toContain("#sundhed");
    expect(tags).toContain("#ransomware");
  });

  it("caps at 5 total tags", () => {
    const tags = pickHashtags({
      text:
        "Microsoft Exchange Linux iOS Android AWS npm hospital bank phishing malware nation-state critical infrastructure",
      severity: "zero-day",
      signals: ["zero-day", "in-the-wild", "cve", "rce", "preauth", "scale"],
    });
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(tags[0]).toBe("#cybersikkerhed");
  });

  it("info severity with no signals = just the always-tag", () => {
    const tags = pickHashtags({ text: "industry trends report", severity: "info", signals: [] });
    expect(tags).toEqual(["#cybersikkerhed"]);
  });

  it("supply-chain signal maps to #supplychain", () => {
    const tags = pickHashtags({
      text: "malicious package",
      severity: "notable",
      signals: ["supply-chain"],
    });
    expect(tags).toContain("#supplychain");
  });

  it("dedupes when keyword and signal pick the same tag", () => {
    const tags = pickHashtags({
      text: "Major data breach at vendor",
      severity: "notable",
      signals: ["breach"],
    });
    expect(tags.filter((t) => t === "#databreach")).toHaveLength(1);
  });
});
