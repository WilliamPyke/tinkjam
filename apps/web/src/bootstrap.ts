import { leavingForOurOtherDomain } from "./domainMove";
import { showBootError } from "./lib/bootError";
import { reloadForChunkLoadError, reloadingForChunkLoadError } from "./lib/chunkReloadGuard";

// Before any chunk loads, the app's own included: a deploy removes the files an open page asks for.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForChunkLoadError()) event.preventDefault();
});

// Shared dev chunks need the React refresh preamble first. Catch failures before React mounts.
// The move between our domains comes before the app's chunks, which read storage as they load.
if (!leavingForOurOtherDomain) {
  void import("./main")
    .then(({ startup }) => startup)
    .catch((error: unknown) => {
      if (!reloadingForChunkLoadError()) showBootError(error);
    });
}
