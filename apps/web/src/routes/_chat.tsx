import { isGuestEnvironment, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { Outlet, createFileRoute, redirect, useMatches } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";

import { BoardsHome } from "../components/boards/BoardsHome";
import { ShellNotFoundPage } from "../components/NotFoundPage";
import { TinkjamLoading } from "../components/TinkjamLoading";
import { appModalOpenedOverHome, isAppModalPage } from "../components/sidebar/mainAppLocation";
import { SidebarInset } from "../components/ui/sidebar";
import { resolveThreadRouteTarget, type ThreadRouteTarget } from "../threadRoutes";
import { retainThreadFindForRoute } from "../components/chat/threadFindStore";
import { ThreadLinkPrompt } from "../components/promptLinks/ThreadLinkPrompt";
import { useThreadRouteTarget } from "../hooks/useThreadRouteTarget";
import { isLandingOnBoard } from "../guestPage";

// The boards home is the usual first page; the chat and guest views load when a thread opens.
const ThreadRouteView = lazy(() =>
  import("../components/ThreadRouteView").then((module) => ({ default: module.ThreadRouteView })),
);
const GuestThreadRoute = lazy(() =>
  import("../components/guest/GuestThreadView").then((module) => ({
    default: module.GuestThreadRoute,
  })),
);

function threadRouteTargetKey(target: ThreadRouteTarget | null) {
  if (!target) return null;
  return target.kind === "server" ? scopedThreadKey(target.threadRef) : target.draftId;
}

function ChatRouteLayout() {
  // Render both routes here so draft promotion keeps the same ChatView mounted.
  const threadTarget = useThreadRouteTarget();
  // Read matches, not location, so this agrees with the params useThreadRouteTarget reads.
  const modalOpen = useMatches({
    select: (matches) => matches.some((match) => isAppModalPage(match.pathname)),
  });
  // Settings and Usage render over the thread that opened them, so ChatView never remounts.
  const [backgroundTarget, setBackgroundTarget] = useState(threadTarget);
  if (!modalOpen && threadRouteTargetKey(backgroundTarget) !== threadRouteTargetKey(threadTarget)) {
    setBackgroundTarget(threadTarget);
  }
  const shownTarget = modalOpen ? backgroundTarget : threadTarget;
  // A thread someone shared is not this client's to operate: it gets the guest's pane, which
  // has none of ChatView's controls, and no link prompt can start a turn in it.
  const guestThreadRef =
    shownTarget?.kind === "server" && isGuestEnvironment(shownTarget.threadRef.environmentId)
      ? shownTarget.threadRef
      : null;
  return (
    <>
      {shownTarget?.kind === "server" && !modalOpen && guestThreadRef === null ? (
        <ThreadLinkPrompt threadRef={shownTarget.threadRef} />
      ) : null}
      {guestThreadRef !== null ? (
        <Suspense
          fallback={<TinkjamLoading cover={isLandingOnBoard()} label="Opening the board" />}
        >
          <GuestThreadRoute threadRef={guestThreadRef} />
        </Suspense>
      ) : shownTarget ? (
        <Suspense fallback={<TinkjamLoading label="Opening the chat" />}>
          <ThreadRouteView target={shownTarget} background={modalOpen} />
        </Suspense>
      ) : modalOpen ? (
        // A modal opened over the boards home keeps the home in sight behind it.
        appModalOpenedOverHome() ? (
          <BoardsHome />
        ) : (
          <SidebarInset className="h-dvh" />
        )
      ) : (
        <Outlet />
      )}
      {modalOpen ? <Outlet /> : null}
    </>
  );
}

export const Route = createFileRoute("/_chat")({
  beforeLoad: async ({ context, location }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static" &&
      context.authGateState.status !== "guest"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
    return { appModalPage: isAppModalPage(location.pathname) };
  },
  component: ChatRouteLayout,
  // Unmatched addresses land here, the deepest layout with an outlet, not on the root.
  notFoundComponent: ShellNotFoundPage,
  // Every match carries the whole location's params, so this layout sees the thread route's too.
  onEnter: ({ context, params }) => retainThreadFindForRouteMatch(context.appModalPage, params),
  onStay: ({ context, params }) => retainThreadFindForRouteMatch(context.appModalPage, params),
  onLeave: () => retainThreadFindForRoute({ modalPage: false, threadRef: null }),
});

function retainThreadFindForRouteMatch(
  modalPage: boolean,
  params: Partial<Record<"environmentId" | "threadId", string>>,
) {
  const target = resolveThreadRouteTarget(params);
  retainThreadFindForRoute({
    modalPage,
    threadRef: target?.kind === "server" ? target.threadRef : null,
  });
}
