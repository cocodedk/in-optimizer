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
});
