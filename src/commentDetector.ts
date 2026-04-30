import type { Locator, Page } from "playwright";
import { SELECTORS } from "./selectors.ts";

export type Comment = {
  /** Stable identifier — LinkedIn URN if available, else a hash of the snippet. */
  id: string;
  /** Permalink-ish URL when LinkedIn exposes one in the card. */
  url?: string;
  /** Up to ~140 chars of comment text, for log readability. */
  snippet: string;
};

type DetectorArgs = {
  cardSel: string;
  nestedSel: string;
  bodySel: string;
  permalinkActivitySel: string;
  permalinkUpdateSel: string;
};

/**
 * Body of the function we ship to the page. Plain ES5 so it survives
 * `new Function()` without TS-specific features. Returns one entry per
 * detected comment authored by the logged-in user. All LinkedIn selectors
 * arrive via `args` from `src/selectors.ts` — keep this body free of inline
 * selector strings.
 */
const PAGE_FN_BODY = `
  function pickUrn(el) {
    if (!el) return null;
    var attrs = ['data-urn', 'data-id'];
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute(attrs[i]);
      if (v && /urn:li:(fsd_)?comment/.test(v)) return v;
    }
    var anc = el.closest('[data-urn^="urn:li:comment:"], [data-id^="urn:li:fsd_comment:"]');
    if (anc) {
      for (var j = 0; j < attrs.length; j++) {
        var w = anc.getAttribute(attrs[j]);
        if (w) return w;
      }
    }
    return null;
  }

  function findPermalink(el) {
    var a = el.querySelector(args.permalinkActivitySel);
    if (a) return a.getAttribute('href');
    var b = el.querySelector(args.permalinkUpdateSel);
    if (b) return b.getAttribute('href');
    return null;
  }

  function bodyText(el) {
    var body = el.querySelector(args.bodySel);
    var t = ((body || el).textContent || '').replace(/\\s+/g, ' ').trim();
    return t;
  }

  function isMine(el) {
    // Strip nested reply cards before testing authorship — otherwise a parent
    // card whose nested reply is mine inherits the nested "• You" badge.
    var clone = el.cloneNode(true);
    var nested = clone.querySelectorAll(args.nestedSel);
    for (var i = 0; i < nested.length; i++) {
      if (nested[i].parentNode) nested[i].parentNode.removeChild(nested[i]);
    }
    return /•\\s*You\\b/.test(clone.textContent || '');
  }

  function snippetOf(el) {
    var t = bodyText(el);
    if (t.length > 280) t = t.slice(0, 280) + '…';
    return t;
  }

  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return 'h:' + (h >>> 0).toString(36);
  }

  var seen = {};
  var out = [];
  var nodes = Array.from(document.querySelectorAll(args.cardSel));
  for (var n = 0; n < nodes.length; n++) {
    var card = nodes[n];
    if (!isMine(card)) continue;
    var urn = pickUrn(card);
    var snip = snippetOf(card);
    var id = urn || hash(snip);
    if (seen[id]) continue;
    seen[id] = 1;
    var url = findPermalink(card);
    out.push({ id: id, url: url || undefined, snippet: snip });
  }
  return out;
`;

const pageFn = new Function("args", PAGE_FN_BODY) as (
  args: DetectorArgs,
) => Comment[];

export async function enumerateComments(page: Page): Promise<Comment[]> {
  const args: DetectorArgs = {
    cardSel: SELECTORS.card,
    nestedSel: SELECTORS.nestedCard,
    bodySel: SELECTORS.commentBody,
    permalinkActivitySel: SELECTORS.permalinkActivity,
    permalinkUpdateSel: SELECTORS.permalinkUpdate,
  };
  return await page.evaluate(pageFn, args);
}

export function locateCard(page: Page, c: Comment): Locator {
  if (c.id.startsWith("urn:li:")) {
    return page.locator(`[data-urn="${c.id}"], [data-id="${c.id}"]`).first();
  }
  return page.locator(SELECTORS.card).filter({ hasText: shorten(c.snippet) }).first();
}

function shorten(s: string): string {
  const t = s.replace(/…$/, "").trim();
  return t.length <= 40 ? t : t.slice(0, 40);
}
