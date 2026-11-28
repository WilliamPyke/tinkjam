import { passkeys } from "@clerk/electron/passkeys";
import { ClerkProvider } from "@clerk/electron/react";
import type { ReactNode } from "react";

import { ManagedRelayAuthProvider } from "../../cloud/managedAuth";
import { clerkAppearance, clerkLocalization } from "./clerkAppearance";
import { ClerkHooksProvider } from "./ClerkHooksProvider";

/** Load only lazily inside desktop; clerk-js is statically bundled and would otherwise enter every
 * client's startup graph. */
export default function ElectronManagedAuthShell({
  publishableKey,
  children,
}: {
  readonly publishableKey: string;
  readonly children: ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      localization={clerkLocalization}
      publishableKey={publishableKey}
      passkeys={passkeys}
    >
      <ManagedRelayAuthProvider>
        <ClerkHooksProvider>{children}</ClerkHooksProvider>
      </ManagedRelayAuthProvider>
    </ClerkProvider>
  );
}
