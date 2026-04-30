import type { Page } from "playwright";
import { humanClick } from "../humanCursor.ts";
import { jitter, type Rng } from "../pace.ts";
import { LI_SELECTORS } from "./selectors-li.ts";

const SHORT_TIMEOUT = 8000;
// Upper bound on how long we wait for the upload thumbnail to render.
// The legacy selector list (`.share-images__image, .image-detour-container,
// [data-test-id*="media-thumb" i]`) doesn't match the new shadow-DOM
// composer, so we used to burn the full minute before proceeding. Shrink
// to 12s so a missing selector costs ~12s instead of a minute. The new
// composer attaches photos inline in 1-3s in practice.
const MEDIA_TIMEOUT = 12_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function attachMedia(
  page: Page,
  paths: string[],
  rng: Rng,
): Promise<void> {
  if (paths.length === 0) return;
  const addBtn = page.locator(LI_SELECTORS.addMediaButton).first();
  await addBtn.waitFor({ state: "visible", timeout: SHORT_TIMEOUT });

  // The redesigned composer dispatches a native file picker when Add media
  // is clicked. Race the click against the filechooser event; whichever
  // wins, we set files. If no filechooser fires, fall back to setInputFiles
  // on the hidden <input type="file">.
  let chooserSet = false;
  const filechooser = page
    .waitForEvent("filechooser", { timeout: 6000 })
    .then(async (fc) => {
      await fc.setFiles(paths);
      chooserSet = true;
    })
    .catch(() => undefined);
  await humanClick(page, addBtn, rng);
  await filechooser;
  if (!chooserSet) {
    const input = page.locator(LI_SELECTORS.fileInput).first();
    await input.waitFor({ state: "attached", timeout: SHORT_TIMEOUT });
    await input.setInputFiles(paths);
  }

  const thumb = page.locator(LI_SELECTORS.mediaThumbnails).first();
  await thumb.waitFor({ state: "visible", timeout: MEDIA_TIMEOUT }).catch(() => {});
  await sleep(jitter(1500, 0.3, rng));
  const done = page.locator(LI_SELECTORS.mediaDoneButton).first();
  if ((await done.count()) > 0) {
    await humanClick(page, done, rng).catch(() => {});
    await sleep(jitter(600, 0.3, rng));
  }
}
