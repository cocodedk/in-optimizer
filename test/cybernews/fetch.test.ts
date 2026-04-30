import { describe, it, expect } from "vitest";
import { computeToken, parseTweet, syndicationUrl } from "../../src/cybernews/fetch.ts";

describe("computeToken", () => {
  it("matches the empirical formula for tweet 20 (jack)", () => {
    expect(computeToken("20")).toBe("6dq1a2xwd93");
  });

  it("produces a non-empty alphanumeric token for any numeric id", () => {
    const t = computeToken("1864123456789012345");
    expect(t).toMatch(/^[a-z0-9]+$/);
  });

  it("survives 19-digit snowflake IDs without Number precision loss", () => {
    // Direct Number(id) rounds 1864123456789012345 → 1864123456789012200
    // and produces a different last char of the token. The BigInt-split path
    // returns the correct token for the actual id value.
    expect(computeToken("1864123456789012345")).toBe("4iobe9alcmp");
  });
});

describe("syndicationUrl", () => {
  it("builds the canonical syndication URL", () => {
    expect(syndicationUrl("20")).toBe(
      "https://cdn.syndication.twimg.com/tweet-result?id=20&token=6dq1a2xwd93&lang=en",
    );
  });
});

describe("parseTweet", () => {
  it("parses text-only tweet (jack's first tweet)", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "20",
        text: "just setting up my twttr",
        created_at: "2006-03-21T20:50:14.000Z",
        user: { screen_name: "jack", name: "jack" },
      }),
    );
    expect(t.id).toBe("20");
    expect(t.text).toBe("just setting up my twttr");
    expect(t.user.screenName).toBe("jack");
    expect(t.media).toEqual([]);
    expect(t.url).toBe("https://x.com/jack/status/20");
  });

  it("parses a single photo with ?name=large suffix", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "photo",
        user: { screen_name: "u", name: "U" },
        mediaDetails: [{ type: "photo", media_url_https: "https://pbs.twimg.com/media/ABC.jpg" }],
      }),
    );
    expect(t.media).toEqual([
      {
        kind: "photo",
        url: "https://pbs.twimg.com/media/ABC.jpg?name=large",
        originalUrl: "https://pbs.twimg.com/media/ABC.jpg",
      },
    ]);
  });

  it("parses multiple photos", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "thread",
        user: { screen_name: "u", name: "U" },
        mediaDetails: [
          { type: "photo", media_url_https: "https://pbs.twimg.com/media/A.jpg" },
          { type: "photo", media_url_https: "https://pbs.twimg.com/media/B.jpg" },
          { type: "photo", media_url_https: "https://pbs.twimg.com/media/C.jpg" },
        ],
      }),
    );
    expect(t.media).toHaveLength(3);
    expect(t.media.every((m) => m.kind === "photo")).toBe(true);
  });

  it("picks the highest-bitrate mp4 for video", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "video",
        user: { screen_name: "u", name: "U" },
        mediaDetails: [
          {
            type: "video",
            media_url_https: "https://pbs.twimg.com/thumb.jpg",
            video_info: {
              variants: [
                { bitrate: "256000", content_type: "video/mp4", url: "https://video.twimg.com/low.mp4" },
                { bitrate: "2176000", content_type: "video/mp4", url: "https://video.twimg.com/high.mp4" },
                { content_type: "application/x-mpegURL", url: "https://video.twimg.com/master.m3u8" },
              ],
            },
          },
        ],
      }),
    );
    expect(t.media).toHaveLength(1);
    expect(t.media[0]).toMatchObject({
      kind: "video",
      url: "https://video.twimg.com/high.mp4",
      thumbnailUrl: "https://pbs.twimg.com/thumb.jpg",
    });
  });

  it("classifies animated_gif separately from video", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "gif",
        user: { screen_name: "u", name: "U" },
        mediaDetails: [
          {
            type: "animated_gif",
            media_url_https: "https://pbs.twimg.com/gifthumb.jpg",
            video_info: {
              variants: [
                { bitrate: "0", content_type: "video/mp4", url: "https://video.twimg.com/gif.mp4" },
              ],
            },
          },
        ],
      }),
    );
    expect(t.media[0]?.kind).toBe("animated_gif");
  });

  it("skips unknown media types", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "mixed",
        user: { screen_name: "u", name: "U" },
        mediaDetails: [
          { type: "photo", media_url_https: "https://pbs.twimg.com/A.jpg" },
          { type: "poll", media_url_https: "https://example.com/poll" },
        ],
      }),
    );
    expect(t.media).toHaveLength(1);
    expect(t.media[0]?.kind).toBe("photo");
  });

  it("returns empty media when mediaDetails is missing or empty", () => {
    expect(parseTweet(JSON.stringify({ id_str: "1", text: "x", user: { screen_name: "u" } })).media).toEqual([]);
    expect(
      parseTweet(JSON.stringify({ id_str: "1", text: "x", user: { screen_name: "u" }, mediaDetails: [] })).media,
    ).toEqual([]);
  });

  it("falls back to /i/status URL when screen_name missing", () => {
    const t = parseTweet(JSON.stringify({ id_str: "999", text: "x", user: {} }));
    expect(t.url).toBe("https://x.com/i/status/999");
  });

  it("trims trailing pic.x.com t.co URL using display_text_range", () => {
    const raw = "Body of the tweet. https://t.co/abc";
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: raw,
        user: { screen_name: "u" },
        display_text_range: [0, 18], // "Body of the tweet."
        entities: {
          urls: [],
          media: [{ url: "https://t.co/abc", indices: [19, 35] }],
        },
      }),
    );
    expect(t.text).toBe("Body of the tweet.");
  });

  it("expands in-body t.co URLs to their expanded_url", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "Read more: https://t.co/xyz now",
        user: { screen_name: "u" },
        display_text_range: [0, 31],
        entities: {
          urls: [
            { url: "https://t.co/xyz", expanded_url: "https://example.com/article" },
          ],
        },
      }),
    );
    expect(t.text).toBe("Read more: https://example.com/article now");
  });

  it("expands and trims together (real-world media-bearing tweet)", () => {
    // "CVE-2026-1234 disclosed. Details: https://t.co/abc" is 0..50;
    // " https://t.co/pic" is the auto-appended media URL beyond it.
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "CVE-2026-1234 disclosed. Details: https://t.co/abc https://t.co/pic",
        user: { screen_name: "u" },
        display_text_range: [0, 50],
        entities: {
          urls: [{ url: "https://t.co/abc", expanded_url: "https://nvd.nist.gov/cve" }],
          media: [{ url: "https://t.co/pic", indices: [51, 67] }],
        },
      }),
    );
    expect(t.text).toBe("CVE-2026-1234 disclosed. Details: https://nvd.nist.gov/cve");
  });

  it("ignores malformed display_text_range", () => {
    const t = parseTweet(
      JSON.stringify({
        id_str: "1",
        text: "hello world",
        user: { screen_name: "u" },
        display_text_range: ["bad", "range"],
      }),
    );
    expect(t.text).toBe("hello world");
  });
});
