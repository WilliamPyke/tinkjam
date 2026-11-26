import type { GuestSignInFailure } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "../ui/button";

export function GuestNotice({
  title,
  detail,
  children,
}: {
  readonly title: string;
  readonly detail?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="m-auto flex w-full max-w-sm flex-col items-center gap-2 rounded-dialog border bg-raised px-6 py-7 text-center text-card-foreground shadow-board">
      <h1 className="font-heading text-xl leading-tight font-semibold tracking-brand text-balance">
        {title}
      </h1>
      {detail ? <p className="text-sm text-pretty text-muted-foreground">{detail}</p> : null}
      {children ? <div className="mt-3 flex justify-center">{children}</div> : null}
    </div>
  );
}

/** The way out a full-page notice gives someone whose link opened nothing: the app's home. */
export function GoToTinkjam() {
  return <Button render={<Link to="/" replace />}>Go to Tinkjam</Button>;
}

// Why the GitHub sign-in a share's guest just came back from did not finish. Shown once.
const signInFailures = new Map<string, GuestSignInFailure>();
export function noteGuestSignInFailure(shareId: string, failure: GuestSignInFailure) {
  signInFailures.set(shareId, failure);
}

export function takeGuestSignInFailure(shareId: string): GuestSignInFailure | undefined {
  const failure = signInFailures.get(shareId);
  signInFailures.delete(shareId);
  return failure;
}
