import { CloudAlertIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { holdChunkReload } from "~/lib/chunkReloadGuard";

import { ConnectionNote, useOnline } from "../shell/OfflineNote";

let waitingChanges = 0;
let sendingChanges = 0;
const waitingByShare = new Map<string, number>();
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (event) => {
    if (waitingChanges === 0 && sendingChanges === 0) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const readWaiting = (shareId: string) => waitingByShare.get(shareId) ?? 0;

/** Counts one board change as not saved yet. The returned function counts it as settled. */
export function holdBoardChange(shareId: string): () => void {
  waitingChanges += 1;
  waitingByShare.set(shareId, (waitingByShare.get(shareId) ?? 0) + 1);
  const releaseChunkReload = holdChunkReload();
  notify();
  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    waitingChanges -= 1;
    const waiting = (waitingByShare.get(shareId) ?? 1) - 1;
    if (waiting === 0) waitingByShare.delete(shareId);
    else waitingByShare.set(shareId, waiting);
    releaseChunkReload();
    notify();
  };
}

/**
 * Counts one board change as on its way, queued or sent but not answered yet, so leaving or
 * reloading the page asks first. Not shown on the board: nearly every change arrives at once.
 */
export function holdSendingBoardChange(): () => void {
  sendingChanges += 1;
  const releaseChunkReload = holdChunkReload();
  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    sendingChanges -= 1;
    releaseChunkReload();
  };
}

const RECONNECTING_NOTE_AFTER_MS = 3_000;

/**
 * Says when this person's changes have not reached the board yet, or when the board's live
 * stream has been down long enough that others' changes may be missing. Offline says it alone.
 */
export function BoardSyncNote({
  live,
  shareId,
}: {
  readonly live: boolean;
  readonly shareId: string;
}) {
  const online = useOnline();
  const waiting =
    useSyncExternalStore(
      subscribe,
      () => readWaiting(shareId),
      () => 0,
    ) > 0;
  const [wasLive, setWasLive] = useState(live);
  const [down, setDown] = useState(false);
  if (live && !wasLive) setWasLive(true);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- a short drop is normal; the note waits before it says anything
  useEffect(() => {
    if (live) return;
    const timer = setTimeout(() => setDown(true), RECONNECTING_NOTE_AFTER_MS);
    return () => {
      clearTimeout(timer);
      setDown(false);
    };
  }, [live]);
  if (!online) return null;
  if (waiting) {
    return (
      <ConnectionNote icon={CloudAlertIcon}>
        Some changes are not saved yet. Tinkjam keeps trying.
      </ConnectionNote>
    );
  }
  if (live || !wasLive || !down) return null;
  return (
    <ConnectionNote icon={RefreshCwIcon}>
      Reconnecting. Changes from others may be missing.
    </ConnectionNote>
  );
}
