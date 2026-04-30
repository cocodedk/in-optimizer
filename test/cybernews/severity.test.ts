import { describe, it, expect } from "vitest";
import { classify } from "../../src/cybernews/severity.ts";

describe("classify — zero-day", () => {
  it("flags 'zero-day' phrasing", () => {
    expect(classify("Critical zero-day in widget").severity).toBe("zero-day");
  });

  it("flags '0day'", () => {
    expect(classify("0day disclosed by researcher").severity).toBe("zero-day");
  });

  it("flags 'actively exploited in the wild' even without 'zero-day'", () => {
    expect(classify("CVE-2026-1234 actively exploited in the wild").severity).toBe("zero-day");
  });
});

describe("classify — critical", () => {
  it("CVE + RCE = critical", () => {
    const r = classify("CVE-2026-9999 unauthenticated RCE in WidgetX");
    expect(r.severity).toBe("critical");
    expect(r.signals).toContain("rce");
    expect(r.signals).toContain("preauth");
    expect(r.matchedCves).toEqual(["CVE-2026-9999"]);
  });

  it("CVE + wormable = critical", () => {
    expect(classify("CVE-2026-1234 wormable bug in SMB").severity).toBe("critical");
  });
});

describe("classify — notable", () => {
  it("CVE alone (no RCE/wormable) = notable", () => {
    expect(classify("CVE-2026-1234 patched in OSS lib").severity).toBe("notable");
  });

  it("ransomware = notable", () => {
    expect(classify("Major ransomware attack on hospital").severity).toBe("notable");
  });

  it("breach = notable", () => {
    expect(classify("Vendor confirms breach of customer data").severity).toBe("notable");
  });

  it("supply-chain compromise = notable even without CVE", () => {
    expect(classify("Supply-chain attack via malicious npm package").severity).toBe("notable");
  });

  it("RCE without CVE still surfaces as notable", () => {
    expect(classify("Remote code execution in popular plugin").severity).toBe("notable");
  });
});

describe("classify — info", () => {
  it("plain industry news = info", () => {
    expect(classify("New report on phishing trends in Q1").severity).toBe("info");
  });
});

describe("classify — signals & CVEs", () => {
  it("collects multiple CVEs, dedupes case-insensitively", () => {
    const r = classify("Patch CVE-2026-1234 and cve-2026-1234 plus CVE-2025-99999");
    expect(r.matchedCves.sort()).toEqual(["CVE-2025-99999", "CVE-2026-1234"]);
  });

  it("ignores malformed CVE-like strings", () => {
    expect(classify("CVE-99-1 not a real CVE").matchedCves).toEqual([]);
  });

  it("returns empty signals for benign text", () => {
    expect(classify("Happy Monday everyone").signals).toEqual([]);
  });

  it("flags scale signals", () => {
    expect(classify("Millions of devices affected globally").signals).toContain("scale");
  });
});

describe("classify — precedence", () => {
  it("zero-day beats critical when both fire", () => {
    expect(classify("CVE-2026-1234 zero-day RCE").severity).toBe("zero-day");
  });
  it("critical beats notable when both fire", () => {
    expect(classify("CVE-2026-1234 RCE plus ransomware").severity).toBe("critical");
  });
});
