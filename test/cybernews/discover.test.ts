import { describe, it, expect } from "vitest";
import { newSince, parseTimeline, timelineUrl } from "../../src/cybernews/discover.ts";

const buildHtml = (data: unknown): string =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;

describe("timelineUrl", () => {
  it("URL-encodes the handle", () => {
    expect(timelineUrl("IntCyberDigest")).toBe(
      "https://syndication.twitter.com/srv/timeline-profile/screen-name/IntCyberDigest",
    );
  });
});

describe("parseTimeline", () => {
  it("extracts tweet IDs from the entries array", () => {
    const html = buildHtml({
      props: {
        pageProps: {
          screenName: "IntCyberDigest",
          timeline: {
            entries: [
              { content: { tweet: { id_str: "1864000000000000003", user: { screen_name: "IntCyberDigest" } } } },
              { content: { tweet: { id_str: "1864000000000000002", user: { screen_name: "IntCyberDigest" } } } },
              { content: { tweet: { id_str: "1864000000000000001", user: { screen_name: "OtherAcct" } } } },
            ],
          },
        },
      },
    });
    const out = parseTimeline(html);
    expect(out.map((t) => t.id)).toEqual([
      "1864000000000000003",
      "1864000000000000002",
      "1864000000000000001",
    ]);
    expect(out[0]?.selfAuthored).toBe(true);
    expect(out[2]?.selfAuthored).toBe(false);
  });

  it("dedupes repeated IDs", () => {
    const html = buildHtml({
      props: {
        pageProps: {
          screenName: "x",
          timeline: {
            entries: [
              { content: { tweet: { id_str: "1" } } },
              { content: { tweet: { id_str: "1" } } },
              { content: { tweet: { id_str: "2" } } },
            ],
          },
        },
      },
    });
    expect(parseTimeline(html).map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("returns [] when the script tag is absent", () => {
    expect(parseTimeline("<html><body>nope</body></html>")).toEqual([]);
  });

  it("returns [] when JSON parse fails", () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{not json</script>';
    expect(parseTimeline(html)).toEqual([]);
  });

  it("returns [] when entries are absent or non-array", () => {
    expect(parseTimeline(buildHtml({ props: { pageProps: { timeline: { entries: null } } } }))).toEqual([]);
    expect(parseTimeline(buildHtml({ props: { pageProps: {} } }))).toEqual([]);
  });

  it("handles a flat tweet shape (no content wrapper)", () => {
    const html = buildHtml({
      props: {
        pageProps: {
          timeline: {
            entries: [{ tweet: { id_str: "42" } }, { id_str: "43" }],
          },
        },
      },
    });
    expect(parseTimeline(html).map((t) => t.id)).toEqual(["42", "43"]);
  });

  it("ignores non-numeric IDs", () => {
    const html = buildHtml({
      props: {
        pageProps: {
          timeline: {
            entries: [{ content: { tweet: { id_str: "abc" } } }, { content: { tweet: { id_str: "99" } } }],
          },
        },
      },
    });
    expect(parseTimeline(html).map((t) => t.id)).toEqual(["99"]);
  });
});

describe("newSince", () => {
  it("filters to IDs strictly greater than the high-water mark", () => {
    const ids = [
      { id: "100" },
      { id: "200" },
      { id: "150" },
      { id: "50" },
    ];
    expect(newSince(ids, "150").map((t) => t.id)).toEqual(["200"]);
  });

  it("returns all when since is undefined", () => {
    const ids = [{ id: "1" }, { id: "2" }];
    expect(newSince(ids, undefined)).toEqual(ids);
  });

  it("compares lexicographically (works for snowflake numeric IDs of equal length)", () => {
    const ids = [{ id: "1864000000000000001" }, { id: "1864000000000000010" }];
    expect(newSince(ids, "1864000000000000005").map((t) => t.id)).toEqual([
      "1864000000000000010",
    ]);
  });
});
