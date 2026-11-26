// Deploys and desktop server swaps can invalidate lazy chunks; one reload fetches the fresh index.
const CHUNK_RELOADED_AT_KEY = "t3code:chunk-reloaded-at";
// A chunk still missing this soon after a reload is really missing: let the error show.
const RELOAD_GAP_MS = 30_000;

let reloading = false;
let boardsWithUnsentEdits = 0;

/** Whether a failed chunk load already started a reload, so nothing else should show. */
export const reloadingForChunkLoadError = () => reloading;

/** Held while a board has edits the room has not taken: a reload then would lose them. */
export function holdChunkReload(): () => void {
  boardsWithUnsentEdits++;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    boardsWithUnsentEdits--;
  };
}

export function reloadForChunkLoadError(
  getStorage: () => Storage = () => window.sessionStorage,
  reload: () => void = () => window.location.reload(),
  now: number = Date.now(),
): boolean {
  if (boardsWithUnsentEdits > 0) return false;
  try {
    const storage = getStorage();
    const last = Number(storage.getItem(CHUNK_RELOADED_AT_KEY) ?? 0);
    if (now >= last && now - last < RELOAD_GAP_MS) return false;
    storage.setItem(CHUNK_RELOADED_AT_KEY, String(now));
  } catch {
    // Without storage, the reload guard cannot prevent an infinite loop.
    return false;
  }
  reloading = true;
  reload();
  return true;
}
