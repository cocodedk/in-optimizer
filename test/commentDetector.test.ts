import { describe, it, expect, afterAll } from "vitest";
import { closeBrowser, pageFor } from "./helpers/browser.ts";
import { enumerateComments } from "../src/commentDetector.ts";

afterAll(closeBrowser);

describe("enumerateComments", () => {
  it("finds comments via both data-urn and data-id selectors", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const ids = comments.map((c) => c.id);
    expect(ids).toContain(
      "urn:li:comment:(activity:7000000000000000001,7000000000000000010)",
    );
    expect(ids).toContain(
      "urn:li:fsd_comment:(7000000000000000020,urn:li:activity:7000000000000000002)",
    );
    await ctx.close();
  });

  it("falls back to a snippet-hash id when no URN is present", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const minimal = comments.find((c) => c.snippet.startsWith("Short take"));
    expect(minimal).toBeDefined();
    expect(minimal!.id.startsWith("h:")).toBe(true);
    await ctx.close();
  });

  it("de-duplicates comments that share the same URN", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const urn1 = comments.filter(
      (c) => c.id === "urn:li:comment:(activity:7000000000000000001,7000000000000000010)",
    );
    expect(urn1).toHaveLength(1);
    await ctx.close();
  });

  it("attaches the activity permalink when one is in the card", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const c = comments.find(
      (x) => x.id === "urn:li:comment:(activity:7000000000000000001,7000000000000000010)",
    );
    expect(c!.url).toBe("/feed/update/urn:li:activity:7000000000000000001/");
    await ctx.close();
  });

  it("captures a readable snippet for log output", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const c = comments.find(
      (x) => x.id === "urn:li:comment:(activity:7000000000000000001,7000000000000000010)",
    );
    expect(c!.snippet).toContain("Great breakdown of the architecture");
    await ctx.close();
  });

  it("filters out cards authored by other users", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const others = comments.filter((c) => c.snippet.includes("Counterpoint"));
    expect(others).toHaveLength(0);
    const janeId = "urn:li:comment:(activity:7000000000000000001,7000000000000000099)";
    expect(comments.find((c) => c.id === janeId)).toBeUndefined();
    await ctx.close();
  });

  it("does not let a nested reply's '• You' badge leak into the parent card", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const johnId = "urn:li:comment:(activity:7000000000000000003,7000000000000000111)";
    const myReplyId = "urn:li:comment:(activity:7000000000000000003,7000000000000000222)";
    expect(comments.find((c) => c.id === johnId)).toBeUndefined();
    expect(comments.find((c) => c.id === myReplyId)).toBeDefined();
    await ctx.close();
  });

  it("excludes the author header from the snippet", async () => {
    const { page, ctx } = await pageFor("comments.html");
    const comments = await enumerateComments(page);
    const c = comments.find(
      (x) => x.id === "urn:li:comment:(activity:7000000000000000001,7000000000000000010)",
    );
    expect(c!.snippet).not.toMatch(/Babak Bandpey/);
    expect(c!.snippet).not.toMatch(/• You/);
    await ctx.close();
  });
});
