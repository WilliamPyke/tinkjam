import type {
  useAuth as clerkUseAuth,
  useClerk as clerkUseClerk,
  useUser as clerkUseUser,
} from "@clerk/react";
import { createContext, useContext } from "react";

interface ClerkHooks {
  readonly useAuth: typeof clerkUseAuth;
  readonly useUser: typeof clerkUseUser;
  readonly useClerk: typeof clerkUseClerk;
}

/** Clerk's own hooks, which the sign-in shell gives everything inside it. */
export const ClerkHooksContext = createContext<ClerkHooks | null>(null);

type SignedOutAuth = Extract<
  ReturnType<typeof clerkUseAuth>,
  { readonly isLoaded: true; readonly isSignedIn: false }
>;

const SIGNED_OUT_AUTH: SignedOutAuth = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  sessionClaims: null,
  actor: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  has: () => false,
  signOut: () => Promise.resolve(),
  getToken: () => Promise.resolve(null),
};

const SIGNED_OUT_USER = { isLoaded: true, isSignedIn: false, user: null } as const;

// Clerk loads only for someone signed in or signing in (see lazyClerk.tsx); until then nobody is.
// Loading it remounts everything inside the shell, so a mounted component never switches hooks.
const signedOut = {
  useAuth: (): SignedOutAuth => SIGNED_OUT_AUTH,
  useUser: () => SIGNED_OUT_USER,
  useClerk: () => null,
};

export function useAuth(
  options?: Parameters<typeof clerkUseAuth>[0],
): ReturnType<typeof clerkUseAuth> {
  return (useContext(ClerkHooksContext) ?? signedOut).useAuth(options);
}

export function useUser(): ReturnType<typeof clerkUseUser> {
  return (useContext(ClerkHooksContext) ?? signedOut).useUser();
}

/** Clerk itself, or null while it has not loaded because nobody here is signed in. */
export function useClerk(): ReturnType<typeof clerkUseClerk> | null {
  return (useContext(ClerkHooksContext) ?? signedOut).useClerk();
}

/** Whether Clerk's components can render here. */
export const useClerkMounted = () => useContext(ClerkHooksContext) !== null;
