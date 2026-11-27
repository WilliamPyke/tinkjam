import { ClerkProvider } from "@clerk/react";
import type { ComponentProps } from "react";

import { ManagedRelayAuthProvider } from "../../cloud/managedAuth";
import { expectBoardAccountChange } from "../../guest/boardAccount";
import { staysInApp } from "./authRedirect";
import { clearSignInPageRequestOnLeave } from "./signInPageRequest";
import { BoardAccountBridge } from "./BoardAccountBridge";
import { ClerkHooksProvider } from "./ClerkHooksProvider";
import { clerkAppearance, clerkLocalization } from "./clerkAppearance";
import type { ManagedAuthShellProps } from "./lazyClerk";

type ClerkRouterFn = NonNullable<ComponentProps<typeof ClerkProvider>["routerPush"]>;

// ClerkProvider passes its options through to Clerk's script loader, whose public option this is;
// the React prop type has not caught up with it.
const clerkScriptOptions = { scriptLoadTimeout: 45_000 } as const;

/** Lazy-load Clerk so cloudless local mode, and anyone who never signed in, never downloads it. */
export default function BrowserManagedAuthShell({
  publishableKey,
  navigate,
  children,
}: ManagedAuthShellProps) {
  // Without these Clerk loads the page again after every sign-in and sign-out, which blanks the
  // screen and empties whatever form the person was in.
  const move =
    (replace: boolean): ClerkRouterFn =>
    (to, metadata) => {
      const leavesSignIn = clearSignInPageRequestOnLeave(
        window.location.pathname,
        to,
        window.location.origin,
      );
      if (!staysInApp(to, window.location.origin)) {
        return (metadata?.windowNavigate ?? window.location.assign.bind(window.location))(to);
      }
      // Clerk leaves the sign-in page before it says who signed in.
      if (leavesSignIn) expectBoardAccountChange();
      return navigate(to, replace);
    };
  return (
    <ClerkProvider
      {...clerkScriptOptions}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      routerPush={move(false)}
      routerReplace={move(true)}
    >
      <ManagedRelayAuthProvider>
        <ClerkHooksProvider>{children}</ClerkHooksProvider>
      </ManagedRelayAuthProvider>
      <BoardAccountBridge />
    </ClerkProvider>
  );
}
