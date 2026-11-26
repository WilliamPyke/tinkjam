import { CloudAlertIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ConnectionNote, useOnline } from "../shell/OfflineNote";

let waitingChanges = 0;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
const readWaiting = () => waitingChanges;

/** Counts one board change as not saved yet. The returned function counts it as settled. */
export function holdBoardChange(): () => void {
  waitingChanges += 1;
  notify();
  let settled = false;
  return () => {
    if (settled) return;
    settled = true;
    waitingChanges -= 1;
    notify();
  };
}

const RECONNECTING_NOTE_AFTER_MS = 3_000;

/**
 * Says when this person's changes have not reached the board yet, or when the board's live
 * stream has been down long enough that others' changes may be missing. Offline says it alone.
 */
export function BoardSyncNote({ live }: { readonly live: boolean }) {
  const online = useOnline();
  const waiting = useSyncExternalStore(subscribe, readWaiting, () => 0) > 0;
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
