import { type ComponentProps, lazy, Suspense, useState } from "react";

import { cn } from "~/lib/utils";

type ChatMarkdownComponent = typeof import("./ChatMarkdown").default;

let loadedChatMarkdown: ChatMarkdownComponent | null = null;
const loadChatMarkdown = import("./ChatMarkdown").then((module) => {
  loadedChatMarkdown = module.default;
  return module;
});
// Rejected loads surface where the markdown renders, through the lazy component.
loadChatMarkdown.catch(() => {});
const ChatMarkdown = lazy(() => loadChatMarkdown);

/**
 * Markdown for views that open without the chat. Loading starts with this module, so the views
 * render at once and their text shows as written only until it arrives.
 */
export function LazyChatMarkdown(props: ComponentProps<ChatMarkdownComponent>) {
  // Kept per instance: switching to the loaded component mid-life would remount it.
  const [Loaded] = useState(() => loadedChatMarkdown);
  if (Loaded !== null) return <Loaded {...props} />;
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            "chat-markdown w-full min-w-0 text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]",
            props.className,
          )}
        >
          {props.text}
        </div>
      }
    >
      <ChatMarkdown {...props} />
    </Suspense>
  );
}
