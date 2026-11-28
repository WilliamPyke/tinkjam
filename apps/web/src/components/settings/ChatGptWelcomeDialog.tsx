import { OpenAI } from "../Icons";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ChatGptUsageButton } from "./ChatGptUsageButton";

export function ChatGptWelcomeDialog({
  next,
  dismiss,
}: {
  readonly next: { readonly providerName: string; readonly environmentLabel: string } | undefined;
  readonly dismiss: () => void;
}) {
  return (
    <Dialog
      open={next !== undefined}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <OpenAI className="mb-2 size-8" aria-hidden="true" />
          <DialogTitle>Your ChatGPT plan is connected</DialogTitle>
          <DialogDescription>
            Eligible usage in Tinkjam uses your ChatGPT plan. Manage your shared usage and any
            credit settings in ChatGPT.
          </DialogDescription>
          <p className="text-xs text-muted-foreground">
            {next?.providerName} on {next?.environmentLabel}
          </p>
        </DialogHeader>
        <DialogFooter>
          <ChatGptUsageButton />
          <Button onClick={dismiss}>Continue</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
