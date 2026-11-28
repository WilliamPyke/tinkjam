import { Link } from "@tanstack/react-router";

import { TinkjamMark } from "./TinkjamLogo";
import { Button } from "./ui/button";
import { SidebarInset } from "./ui/sidebar";

function NotFoundContent() {
  return (
    <div className="flex max-w-sm flex-col items-center gap-4 text-center" data-not-found>
      <TinkjamMark aria-hidden className="size-10" />
      <h1 className="font-heading text-2xl leading-tight font-semibold tracking-brand text-foreground">
        This page does not exist.
      </h1>
      <p className="text-sm text-muted-foreground">
        The link may be cut short, or what it led to was deleted.
      </p>
      <Button render={<Link to="/" replace />}>Go to your boards</Button>
    </div>
  );
}

/** An address that leads nowhere, on its own. */
export function NotFoundPage() {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-6">
      <NotFoundContent />
    </main>
  );
}

/** An address that leads nowhere, beside the sidebar. */
export function ShellNotFoundPage() {
  return (
    <SidebarInset className="h-dvh min-h-0">
      <div className="flex flex-1 items-center justify-center p-6">
        <NotFoundContent />
      </div>
    </SidebarInset>
  );
}
