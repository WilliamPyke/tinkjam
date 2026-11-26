import { useAtomValue } from "@effect/atom-react";
import { lazy, Suspense } from "react";

import { appAtomRegistry } from "~/rpc/atomRegistry";
import { guestShareDialogThreadAtom } from "./guestShareDialogState";

const GuestShareDialog = lazy(() =>
  import("./GuestShareControls").then((module) => ({ default: module.GuestShareDialog })),
);

export function GuestShareDialogHost() {
  const threadRef = useAtomValue(guestShareDialogThreadAtom);
  if (threadRef === null) return null;
  return (
    <Suspense fallback={null}>
      <GuestShareDialog
        key={`${threadRef.environmentId}:${threadRef.threadId}`}
        threadRef={threadRef}
        onClose={() => appAtomRegistry.set(guestShareDialogThreadAtom, null)}
      />
    </Suspense>
  );
}
