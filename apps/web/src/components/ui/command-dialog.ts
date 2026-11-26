import { Dialog as CommandDialogPrimitive } from "@base-ui/react/dialog";

// Apart from command.tsx so the always-mounted palette root does not load the palette UI.
export const CommandDialog = CommandDialogPrimitive.Root;
