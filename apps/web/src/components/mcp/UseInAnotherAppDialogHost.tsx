import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { lazy, Suspense } from "react";

import { appAtomRegistry } from "~/rpc/atomRegistry";

const requestAtom = Atom.make<{ readonly environmentId: EnvironmentId | null } | null>(null).pipe(
  Atom.keepAlive,
  Atom.withLabel("mcp:use-in-another-app"),
);

const UseInAnotherAppDialog = lazy(() =>
  import("./UseInAnotherAppDialog").then((module) => ({ default: module.UseInAnotherAppDialog })),
);

/** Opens the wizard for `environmentId`, or for the one Sharing & access picks when null. */
export function openUseInAnotherApp(environmentId: EnvironmentId | null): void {
  appAtomRegistry.set(requestAtom, { environmentId });
}

export const closeUseInAnotherApp = () => appAtomRegistry.set(requestAtom, null);

/** Hosted once at the root, so Cmd-K and Settings can open it from anywhere. */
export function UseInAnotherAppDialogHost() {
  const request = useAtomValue(requestAtom);
  return request === null ? null : (
    <Suspense fallback={null}>
      <UseInAnotherAppDialog requested={request.environmentId} />
    </Suspense>
  );
}
