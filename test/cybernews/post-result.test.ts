import { describe, it, expect } from "vitest";
import { activityUrlFromHref } from "../../src/cybernews/post-result.ts";

const CANON = "https://www.linkedin.com/feed/update/urn:li:activity:7467847135405686784/";

describe("activityUrlFromHref", () => {
  it("normalizes a post-analytics href to the canonical feed permalink", () => {
    // This is the href shape LinkedIn actually renders on /recent-activity/.
    expect(
      activityUrlFromHref("/analytics/post-summary/urn:li:activity:7467847135405686784/"),
    ).toBe(CANON);
  });

  it("normalizes a relative /feed/update/ permalink", () => {
    expect(
      activityUrlFromHref("/feed/update/urn:li:activity:7467847135405686784/"),
    ).toBe(CANON);
  });

  it("extracts the urn from an absolute, query-tailed href", () => {
    expect(
      activityUrlFromHref(
        "https://www.linkedin.com/feed/update/urn:li:activity:7467847135405686784?utm=x",
      ),
    ).toBe(CANON);
  });

  it("returns undefined when no activity urn is present", () => {
    expect(activityUrlFromHref("/feed/update/urn:li:share:123/")).toBeUndefined();
    expect(activityUrlFromHref("/messaging/thread/abc/")).toBeUndefined();
  });

  it("returns undefined for null/empty input", () => {
    expect(activityUrlFromHref(null)).toBeUndefined();
    expect(activityUrlFromHref(undefined)).toBeUndefined();
    expect(activityUrlFromHref("")).toBeUndefined();
  });
});
