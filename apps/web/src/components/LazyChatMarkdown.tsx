import { type ComponentProps, lazy, Suspense, useState } from "react";

import { cn } from "~/lib/utils";

type ChatMarkdownComponent = typeof import("./ChatMarkdown").default;

let loadedChatMarkdown: ChatMarkdownComponent | null = null;
const ChatMarkdown = lazy(() =>
  import("./ChatMarkdown").then((module) => {
    loadedChatMarkdown = module.default;
    return module;
  }),
);

/**
 * Markdown for views that open without the chat. Loading starts when the first one renders, so a
 * board's own data comes first; until it arrives the text shows as written.
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
