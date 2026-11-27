import { ClerkFailed, ClerkLoading, SignIn } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cloudBoardsOrigin } from "~/guest/cloudBoardsHost";
import { PRIVACY_POLICY_URL } from "~/legalLinks";

import { BrandArtPanel } from "../brand/BrandArtPanel";
import { SignInArtCards } from "../brand/SignInArtCards";
import { Copyright, SplitScreen, splitLinkClassName } from "../brand/SplitScreen";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { signInScreenAppearance } from "./clerkAppearance";
import { signInFromBoard, type SignInPageRequest } from "./authRedirect";
import { useClerkMounted } from "./clerkHooks";
import { requestClerk, retryClerk, useClerkLoadFailed } from "./lazyClerk";
import { clearSignInPageRequestOnLeave, readSignInPageRequest } from "./signInPageRequest";

/**
 * Signing in and making an account, every step of it (codes, a forgotten password, the return
 * from Google or Apple) on one page: the form in the person's theme, the cobalt art beside it.
 * Clerk shows whichever ways in its dashboard turns on. It goes back to where it was opened.
 */
export function SignInPage() {
  const [request] = useState(readSignInPageRequest);
  const clerkMounted = useClerkMounted();
  const navigate = useNavigate();
  const leave = (href: string) => {
    clearSignInPageRequestOnLeave(window.location.pathname, href, window.location.origin);
    void navigate({ href, replace: true });
  };
  return (
    <SplitScreen
      corner={
        <Button variant="ghost" size="icon" aria-label="Close" onClick={() => leave(request.from)}>
          <XIcon />
        </Button>
      }
      footer={
        <>
          <Copyright />
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noreferrer"
            className="pointer-coarse:-my-3 pointer-coarse:py-3 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            Privacy and terms
          </a>
        </>
      }
      art={
        <BrandArtPanel headline={{ kind: "build" }}>
          <SignInArtCards />
        </BrandArtPanel>
      }
    >
      {clerkMounted ? <SignInForm request={request} /> : <SignInStarting />}
      {cloudBoardsOrigin() === null ? null : signInFromBoard(request.from) ? (
        <p className="mt-10 border-t border-border pt-5.5 text-ui-md text-muted-foreground">
          Your boards and what you added to them come with you.{" "}
          <button type="button" className={splitLinkClassName} onClick={() => leave(request.from)}>
            Back to the board
          </button>
        </p>
      ) : (
        <p className="mt-10 border-t border-border pt-5.5 text-ui-md text-muted-foreground">
          Just want to try it?{" "}
          <button type="button" className={splitLinkClassName} onClick={() => leave("/")}>
            Start a board without an account
          </button>
        </p>
      )}
    </SplitScreen>
  );
}

const signInLoading = (
  <div role="status" aria-label="Loading sign-in" className="flex flex-col gap-4">
    <Skeleton className="h-11 w-40" />
    <Skeleton shape="pill" className="h-13 w-full" />
    <Skeleton shape="pill" className="h-13 w-full" />
    <Skeleton shape="card" className="h-12 w-full" />
  </div>
);

function SignInFailed() {
  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <p className="text-base text-foreground">
        Sign-in could not load. Check your internet connection, then try again.
      </p>
      <Button type="button" variant="outline" onClick={retryClerk}>
        Try again
      </Button>
    </div>
  );
}

function SignInForm({ request }: { readonly request: SignInPageRequest }) {
  return (
    <>
      <ClerkLoading>{signInLoading}</ClerkLoading>
      <ClerkFailed>
        <SignInFailed />
      </ClerkFailed>
      <SignInWidget request={request} />
    </>
  );
}

function SignInWidget({ request }: { readonly request: SignInPageRequest }) {
  const widget = useRef<HTMLDivElement>(null);
  const [verifying, setVerifying] = useState(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- watches Clerk's widget DOM, which React does not own, for its verification state
  useEffect(() => {
    const root = widget.current;
    if (root === null) return;
    const update = () =>
      setVerifying(root.textContent?.includes("Verifying your request") ?? false);
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div data-sign-in-form ref={widget}>
        <SignIn
          routing="path"
          path="/sign-in"
          appearance={signInScreenAppearance}
          withSignUp={request.withSignUp}
          {...(request.forceRedirectUrl ? { forceRedirectUrl: request.forceRedirectUrl } : {})}
          {...(request.signUpForceRedirectUrl
            ? { signUpForceRedirectUrl: request.signUpForceRedirectUrl }
            : {})}
        />
      </div>
      <div aria-live="polite">
        {verifying ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Checking your connection. This can take up to a minute.
          </p>
        ) : null}
      </div>
    </>
  );
}

/** Before Clerk is here: it loads, and the page mounts again inside it. */
function SignInStarting() {
  const failed = useClerkLoadFailed();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- starts loading Clerk, which lives outside React, for a page opened without it
  useEffect(() => void requestClerk(), []);
  return failed ? <SignInFailed /> : signInLoading;
}
