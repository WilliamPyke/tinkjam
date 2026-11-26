import { useAuth, useClerk, useUser } from "@clerk/react";
import type { ReactNode } from "react";

import { ClerkHooksContext } from "./clerkHooks";

const CLERK_HOOKS = { useAuth, useUser, useClerk };

/** Inside a ClerkProvider: hands Clerk's hooks to the app's own (see clerkHooks.ts). */
export function ClerkHooksProvider({ children }: { readonly children: ReactNode }) {
  return <ClerkHooksContext.Provider value={CLERK_HOOKS}>{children}</ClerkHooksContext.Provider>;
}
