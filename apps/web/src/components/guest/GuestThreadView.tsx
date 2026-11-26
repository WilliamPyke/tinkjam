import { useAtomValue } from "@effect/atom-react";
import { guestEnvironmentId, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { type GuestShareEndpoint, guestShareRequest } from "@t3tools/client-runtime/rpc";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { deriveThreadStructureRuntime } from "@t3tools/client-runtime/state/thread-execution";
import { shouldShowLoadEarlierControl } from "@t3tools/client-runtime/state/threads";
import {
  type EnvironmentId,
  GUEST_BOARD_CODE_ROUTE,
  GUEST_BOARD_CURSOR_ROUTE,
  GUEST_BOARD_PULL_REQUEST_ROUTE,
  GUEST_BOARD_ROUTE,
  GUEST_HANDOFF_ROUTE,
  GUEST_MESSAGE_MAX_LENGTH,
  GuestId,
  GuestMessageId,
  GuestShareId,
  type RoomAgentActivity,
  type RoomBoardChange,
  RoomCodePatch,
  type RoomCodePatchScope,
  type RoomBoardNote,
  type ModelSelection,
  type ScopedThreadRef,
  type ThreadGuest,
} from "@t3tools/contracts";
import { Navigate, useNavigate, useParams } from "@tanstack/react-router";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  endedShareNoticesAtom,
  guestRoomAtom,
  guestRoomBoxesAtom,
  guestRoomCursorsAtom,
  guestRoomViewsAtom,
  guestShareEndpointOf,
  guestShareLocation,
  guestSharesAtom,
  isCloudShare,
  type JoinedGuestShare,
  markGuestShareOpened,
  reopeningSharesAtom,
} from "~/guest/guestShares";
import { CLOUD_BOARD_PATH } from "~/guest/boardAddress";
import { boardLinksOf } from "~/guest/boardLinks.logic";
import { boardAccountsEnabled, useBoardAccount } from "~/guest/boardAccount";
import { cloudBoardsHost } from "~/guest/cloudBoardsHost";
import { copyCloudBoard, renameCloudBoard } from "~/guest/cloudBoards";
import { useThreadActions } from "~/hooks/useThreadActions";
import { randomUUID } from "~/lib/utils";
import { endBoardLanding, isLandingOnBoard } from "~/guestPage";
import { deriveThreadAgentWorking } from "~/session-logic";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useEnvironment, useEnvironmentProviders } from "~/state/environments";
import { serverEnvironment } from "~/state/server";
import { useQuietThreadShells } from "~/state/entities";
import { environmentThreadDetails, threadEnvironment, useEnvironmentThread } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";
import {
  boardContextCards,
  boardTurnSelection,
  guestBoardPromptText,
  ownerWritingArtifactId,
} from "../chat/roomBoardPrompt";
import type { MessagesTimelineHistoryControls } from "../chat/MessagesTimeline";
import { TinkjamLoading } from "../TinkjamLoading";
import { GoToTinkjam, GuestNotice } from "./GuestNotice";
import { composerDraftPick } from "../room/BoardModelPicker";
import { boardAgentEndOf } from "../room/boardAgents.logic";
import {
  type BoardLocalModelPick,
  boardBoxModelPick,
  boardLocalModelPick,
  boardNewBoxModel,
} from "../room/boardBoxModel.logic";
import { markBoardGuideStep } from "../room/boardGuideState";
import { BoardChatPanel, BoardChatPanelNote } from "../room/BoardChatPanel";
import { BoardMentionsProvider } from "../room/BoardMentions";
import { BoardSplit } from "../room/BoardSplit";
import { BoardThreadPicker } from "../room/BoardThreadPicker";
import { RoomBoard, RoomCursors } from "../room/RoomBoard";
import { BoxApproval } from "../room/RoomBoardThreadBox";
import {
  ROOM_CODE_PATCH_UNREADABLE,
  type ReadRoomCodePatch,
  type RoomCodePatchRead,
  roomCodePatchRead,
} from "../room/RoomBoardCode";
import { revealRoomReply } from "../room/RoomReplyComments";
import { useAccountBoardOpen } from "./useAccountBoardOpen";
import {
  BOARD_THREAD_MESSAGES,
  type BoardPresence,
  appendNoteToDraft,
  type BoardPoint,
  type BoardPrompt,
  boardMessages,
  boardNoteMessage,
  boardThreadBoxTitle,
} from "../room/roomBoard.logic";
import { RoomLiveContext, type RoomLiveStore, createRoomLiveStore } from "../room/roomBoardLive";
import { useT3ConnectAuthPrompt } from "../clerk/useT3ConnectAuthPrompt";
import { Button } from "../ui/button";
import { SidebarInset } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import { BoardTitle } from "../boards/BoardTitle";
import { InboxBell } from "../boards/InboxBell";
import { BringAgentDialog } from "./BringAgentDialog";
import { CloudBoardSharing } from "./CloudBoardSharing";
import { ViewOnlyBar } from "./ViewOnlyBar";
import {
  boardChangeFailureIsTemporary,
  boardChangeRetryDelayMs,
  guestShareIdOfEnvironment,
  nextAwaitingRowIds,
} from "./guestStream.logic";
import { BoardSyncNote, holdBoardChange } from "./BoardSyncNote";
import { ownAgentFailureMessage } from "./bringAgent.logic";
import { decodeHandoff, openOnMyMachine, postGuestAction, postGuestMessage } from "./guestRequests";
import { useJoinBoardOnComputer } from "./joinBoardOnComputer";
import { announceRoomMachineJoined } from "~/guest/roomMachineJoins";
import {
  type OwnRoomMachine,
  OwnBoxComputerPicker,
  OwnBoxModelPicker,
  useOwnRoomMachine,
} from "./ownRoomMachine";

// A cloud board never shows the conversation, so it, its timeline and its markdown load when it opens.
const GuestThread = lazy(() =>
  import("./GuestThread").then((module) => ({ default: module.GuestThread })),
);

// A reload keeps the tab's session, so it keeps which messages still wait for a row too.
const AWAITING_ROWS_KEY = "t3:guest-awaiting-rows";
const AWAITING_ROWS_LIMIT = 50;

function readAwaitingRowIds(): ReadonlySet<GuestMessageId> {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(AWAITING_ROWS_KEY) ?? "[]");
    return new Set(
      Array.isArray(stored)
        ? stored.filter((id) => typeof id === "string").map((id) => GuestMessageId.make(id))
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeAwaitingRowIds(ids: ReadonlySet<GuestMessageId>) {
  try {
    sessionStorage.setItem(AWAITING_ROWS_KEY, JSON.stringify([...ids].slice(-AWAITING_ROWS_LIMIT)));
  } catch {}
}

const messageOfFailure = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Try again.";

/** The host's answer to one board change, or null when nothing answered. */
async function sendBoardChange(
  endpoint: GuestShareEndpoint,
  change: RoomBoardChange,
): Promise<number | null> {
  try {
    const response = await guestShareRequest(endpoint, GUEST_BOARD_ROUTE, {
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      },
    });
    return response.status;
  } catch {
    return null;
  }
}

const boardChangeRetry = (tries: number) =>
  new Promise<void>((resolve) => {
    if (!navigator.onLine) {
      window.addEventListener("online", () => resolve(), { once: true });
      return;
    }
    setTimeout(resolve, boardChangeRetryDelayMs(tries));
  });

/**
 * Sends one change to the room's board. Resolves to whether the owner's server took it. A host
 * that is down or busy gets the same change again until it answers, so the board's queue keeps
 * later changes to the same card behind it; a refusal resolves false at once.
 */
export async function postBoardChange(
  endpoint: GuestShareEndpoint,
  change: RoomBoardChange,
): Promise<boolean> {
  let settle: (() => void) | null = null;
  try {
    for (let tries = 0; ; tries += 1) {
      const status = await sendBoardChange(endpoint, change);
      if (status !== null && status >= 200 && status < 300) return true;
      if (!boardChangeFailureIsTemporary(status)) return false;
      // A toggle sent twice would undo itself, and a failed answer does not say it did not land.
      if (change.type === "note.react" || change.type === "artifact.restore") {
        toastManager.add({ type: "error", title: "That change was not saved. Try again." });
        return false;
      }
      if (settle === null) settle = holdBoardChange();
      await boardChangeRetry(tries);
    }
  } finally {
    settle?.();
  }
}

const decodeCodePatch = Schema.decodeUnknownOption(RoomCodePatch);

/** One file of a code window, read by the owner's server, which has the box's thread. */
async function readRoomCodePatch(
  endpoint: GuestShareEndpoint,
  noteId: string,
  path: string,
  scope: RoomCodePatchScope,
): Promise<RoomCodePatchRead> {
  try {
    const response = await guestShareRequest(endpoint, GUEST_BOARD_CODE_ROUTE, {
      params: { note: noteId, path, scope },
    });
    if (response.status === 429) {
      return { error: "Too many files opened in a minute. Wait a moment." };
    }
    const read = response.ok
      ? decodeCodePatch(await response.json().catch(() => null))
      : Option.none();
    return Option.isSome(read) ? roomCodePatchRead(read.value) : ROOM_CODE_PATCH_UNREADABLE;
  } catch {
    return ROOM_CODE_PATCH_UNREADABLE;
  }
}

/** Asks the owner's server to read a pull request window again; the board shows the read. */
function refreshRoomPullRequest(endpoint: GuestShareEndpoint, noteId: string) {
  void guestShareRequest(endpoint, GUEST_BOARD_PULL_REQUEST_ROUTE, {
    params: { note: noteId },
    init: { method: "POST" },
  }).catch(() => {});
}

/** Shows the room where this guest's pointer is and what their board shows. A lost one is replaced soon. */
function postBoardCursor(endpoint: GuestShareEndpoint, presence: BoardPresence) {
  void guestShareRequest(endpoint, GUEST_BOARD_CURSOR_ROUTE, {
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(presence),
      // The pointer leaving, or the board closing, is sent even as the page goes away.
      keepalive: presence.at === null,
    },
  }).catch(() => {});
}

/** A board's own address with no session here: a member who signs in opens it as themselves. */
function SignedOutBoardNotice() {
  const { openAuthPrompt } = useT3ConnectAuthPrompt();
  return (
    <GuestNotice
      title="Sign in to open this board"
      detail="If you were given a link to it instead, open that link, or ask whoever shared it for a new one."
    >
      <Button type="button" onClick={openAuthPrompt}>
        Sign in
      </Button>
    </GuestNotice>
  );
}

/**
 * A thread someone shared with this browser, in the app's main pane. The guest reads the
 * owner's timeline and proposes messages; nothing here can act on the owner's machine.
 */
export function GuestThreadRoute({ threadRef }: { readonly threadRef: ScopedThreadRef }) {
  const share =
    useAtomValue(guestSharesAtom).find(
      (candidate) => guestEnvironmentId(candidate.shareId) === threadRef.environmentId,
    ) ?? null;
  const reopening = [...useAtomValue(reopeningSharesAtom)].some(
    (shareId) => guestEnvironmentId(shareId) === threadRef.environmentId,
  );
  // A bookmark or a pasted link on a new device: the account may open it as its own.
  const [accountAttempt, setAccountAttempt] = useState(0);
  const step = useAccountBoardOpen({
    shareId: guestShareIdOfEnvironment(threadRef.environmentId),
    hasSession: share !== null,
    reopening,
    cloud: share === null && cloudBoardsHost() !== null,
    attempt: accountAttempt,
  });
  const signedOut = useBoardAccount().status === "signed-out" && boardAccountsEnabled();
  const endedNotice =
    useAtomValue(endedShareNoticesAtom).get(
      guestShareIdOfEnvironment(threadRef.environmentId) ?? "",
    ) ?? null;
  // A cloud board opened at its long address (a bookmark, an old link) moves to its own.
  const atLongAddress = useParams({
    strict: false,
    select: (params) =>
      params.shareId === undefined && params.environmentId === threadRef.environmentId,
  });
  const location =
    share === null || share.threadId !== threadRef.threadId ? null : guestShareLocation(share);
  return (
    <SidebarInset className="flex h-svh min-h-0 flex-col overflow-hidden overscroll-y-none md:h-dvh">
      {atLongAddress && location?.to === CLOUD_BOARD_PATH ? (
        <Navigate {...location} search hash replace />
      ) : null}
      {share === null && step === "opening" ? (
        <TinkjamLoading cover={isLandingOnBoard()} label="Opening the board" />
      ) : share === null && step === "unreachable" ? (
        <GuestNotice
          title="This board could not be opened"
          detail="Could not reach Tinkjam. Check your connection and try again."
        >
          <Button type="button" onClick={() => setAccountAttempt((attempt) => attempt + 1)}>
            Try again
          </Button>
        </GuestNotice>
      ) : share === null && endedNotice !== null ? (
        <GuestNotice title={endedNotice.title} detail={endedNotice.detail}>
          <GoToTinkjam />
        </GuestNotice>
      ) : share === null && signedOut && cloudBoardsHost() !== null ? (
        <SignedOutBoardNotice />
      ) : share === null || share.threadId !== threadRef.threadId ? (
        <GuestNotice
          title="This board has ended, or the link is not valid"
          detail="Ask whoever shared it with you for a new link."
        >
          <GoToTinkjam />
        </GuestNotice>
      ) : (
        // A new session (asked-for edit access) opens the board anew.
        <GuestThreadSession
          key={`${share.shareId}:${share.token}`}
          share={share}
          threadRef={threadRef}
        />
      )}
    </SidebarInset>
  );
}

/**
 * Ends the way in from a link once a board is on screen; from there a wait leaves the sidebar
 * where it is. On commit, because a render React sets aside has put no board on screen.
 */
function BoardLanded() {
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- notes in guestPage's module state that this page load has drawn a board
  useEffect(endBoardLanding, []);
  return null;
}

function GuestThreadSession({
  share,
  threadRef,
}: {
  readonly share: JoinedGuestShare;
  readonly threadRef: ScopedThreadRef;
}) {
  // Stable for the share: the timeline's file and item sources hang off it.
  const [endpoint] = useState(() => guestShareEndpointOf(share));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- notes in this browser's storage when it last opened the board
  useEffect(() => markGuestShareOpened(share.shareId), [share.shareId]);
  const { view, online, viewing, running, ownerCode } = useAtomValue(guestRoomAtom(share.shareId));
  // Mounting the thread opens the share's stream, which also says who is in the room.
  const thread = useEnvironmentThread(threadRef.environmentId, threadRef.threadId);
  const retrying = useEnvironment(threadRef.environmentId)?.connection.phase === "reconnecting";
  const [struggling, setStruggling] = useState(false);
  const projection = Option.getOrNull(thread.data);
  const pendingRequests = useAtomValue(environmentThreadDetails.pendingRequestsAtom(threadRef));
  const loadEarlier = useAtomCommand(threadEnvironment.loadEarlierHistory, {
    label: "load earlier thread history",
    reportFailure: false,
  });
  // The room thread's conversation beside the board; closing it hides it without unmounting it.
  const [panelOpen, setPanelOpen] = useState(true);
  // One of this person's own thread boxes, whose conversation shows beside the board instead.
  const [sideBox, setSideBox] = useState<string | null>(null);
  const [live] = useState(createRoomLiveStore);
  // Here, not in the composer, so a note from the board can land in it.
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  // The guest's own machine in this room, whose agent runs their thread boxes.
  const { machine, machines, computers, boxOn, choose, startOver, away, forget, setBoxThread } =
    useOwnRoomMachine(share);
  // The thread behind one of this person's boxes, on whichever of their computers has it.
  const boxThread = (boxId: string) => {
    const own = boxOn(boxId).machine;
    const threadId = own?.boxes[boxId];
    return own == null || threadId === undefined
      ? undefined
      : scopeThreadRef(own.environmentId, threadId);
  };
  const joinBoardOnComputer = useJoinBoardOnComputer();
  // Their agent joined from this page; this page learns which machine it is a moment later.
  const agentJoined = useRef(false);
  // The person's agent joins from one of their computers, without leaving this page.
  const bringAgentFrom = async (
    environmentId: EnvironmentId,
    project: EnvironmentProject | null,
  ): Promise<string | null> => {
    const handoff = await postGuestAction(
      endpoint,
      GUEST_HANDOFF_ROUTE,
      decodeHandoff,
      "Could not reach this board. Try again.",
    );
    if (typeof handoff === "string") return handoff;
    const failed = await joinBoardOnComputer({
      environmentId,
      project,
      source: { host: share.host, token: handoff.token },
    });
    if (failed === null) {
      agentJoined.current = true;
      // The computer just brought is the one they mean to use here.
      choose(environmentId);
      announceRoomMachineJoined(share.shareId);
    }
    return failed;
  };
  const leaveBoard = useAtomCommand(serverEnvironment.leaveSharedRoom, { reportFailure: false });
  // The way back out of Bring my agent: their computer leaves the board, their boxes stay.
  const takeAgentAway = async (own: OwnRoomMachine) => {
    const result = await leaveBoard({
      environmentId: own.environmentId,
      input: { threadId: own.threadId },
    });
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return;
      toastManager.add({
        type: "error",
        title: "Could not take your agent off this board",
        description: ownAgentFailureMessage(squashAtomCommandFailure(result), "Try again."),
      });
      return;
    }
    agentJoined.current = false;
    forget(own.environmentId);
    toastManager.add({
      type: "info",
      title: "Your agent is off this board",
      description: "Press Bring my agent to bring it back.",
    });
  };
  const ownProviders = useEnvironmentProviders();
  const promptOwnBox = useAtomCommand(serverEnvironment.promptSharedRoomBox, {
    reportFailure: false,
  });
  const linkOwnBox = useAtomCommand(serverEnvironment.linkSharedRoomBox, {
    reportFailure: false,
  });
  const readOwnBoxPatch = useAtomCommand(serverEnvironment.readSharedRoomBoxPatch, {
    reportFailure: false,
  });
  const interruptOwnBox = useAtomCommand(threadEnvironment.interruptTurn, "stop your agent");
  // Only a box this guest's own machine runs can be stopped from here.
  const stopBox = (boxId: string) => {
    const ref = boxThread(boxId);
    if (ref === undefined) return undefined;
    return () =>
      interruptOwnBox({
        environmentId: ref.environmentId,
        input: { threadId: ref.threadId },
      });
  };
  const { deleteThread } = useThreadActions();
  // A box's chat is on this person's own machine: theirs to delete with the box.
  const boxChatDeleter = (boxId: string) => {
    const ref = boxThread(boxId);
    return ref === undefined ? undefined : () => void deleteThread(ref);
  };
  // Where the box goes once the guest picks which of their threads it is.
  const [addingAt, setAddingAt] = useState<BoardPoint | null>(null);
  // Says how to bring their agent to a cloud board, which has none of its own.
  const [bringingAgent, setBringingAgent] = useState(false);
  // Set by the board: puts this person's agent box on it, ready for their first prompt.
  const ownBox = useRef<(() => string | null) | null>(null);
  // The board keeps each of this guest's boxes' pick; this one until the board shows it.
  const [boxPicks, setBoxPicks] = useState<Readonly<Record<string, BoardLocalModelPick>>>({});
  // The guest's own machine's threads, whose records say how their boxes' runs ended.
  const ownShells = useQuietThreadShells();
  const [awaitingRowIds, setAwaitingRowIds] = useState(readAwaitingRowIds);
  const awaiting = nextAwaitingRowIds(awaitingRowIds, view, projection?.visibleTurnItems ?? []);
  if (awaiting !== awaitingRowIds) setAwaitingRowIds(awaiting);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- persists the awaiting row ids to sessionStorage so a reload keeps them
  useEffect(() => writeAwaitingRowIds(awaitingRowIds), [awaitingRowIds]);

  // This guest's unnamed boxes whose thread on their machine has a title now, as the board names them.
  const boxTitles = (view?.board?.notes ?? []).flatMap((note) => {
    const ref = boxThread(note.id);
    if (ref === undefined || note.text.trim() !== "") return [];
    if (note.kind !== "thread" || note.guestId === undefined || note.guestId !== view?.guestId) {
      return [];
    }
    const title = ownShells
      .find((shell) => shell.environmentId === ref.environmentId && shell.id === ref.threadId)
      ?.title.trim();
    return title === undefined || title === "" ? [] : [{ note, text: boardThreadBoxTitle(title) }];
  });
  const titledBoxes = useRef(new Set<string>());
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- tells the board host the title the box's thread got on this guest's machine, once per box
  useEffect(() => {
    if (view?.viewOnly === true) return;
    for (const { note, text } of boxTitles) {
      if (titledBoxes.current.has(note.id)) continue;
      titledBoxes.current.add(note.id);
      void postBoardChange(endpoint, {
        type: "note.put",
        noteId: note.id,
        text,
        x: note.x,
        y: note.y,
        kind: "thread",
      });
    }
  });
  // Once the board has had to retry, the wait keeps saying so until it opens.
  if (retrying && !struggling) setStruggling(true);
  if (view === null || projection === null) {
    // The plain wait is the mark alone; only trouble gets words.
    if (!struggling && Option.isNone(thread.error)) {
      return <TinkjamLoading cover={isLandingOnBoard()} label="Opening the board" />;
    }
    return (
      <GuestNotice
        title={
          struggling
            ? "Retrying..."
            : Option.isSome(thread.error)
              ? "Could not load this thread"
              : "Connecting..."
        }
        {...(struggling
          ? {
              detail: isCloudShare(share)
                ? "The board service has not answered yet. Trying again."
                : "The owner's computer has not answered yet. Trying again.",
            }
          : Option.isSome(thread.error)
            ? { detail: thread.error.value }
            : {})}
      >
        {struggling ? (
          <Button type="button" onClick={() => window.location.reload()}>
            Try again
          </Button>
        ) : null}
      </GuestNotice>
    );
  }
  const historyControls: MessagesTimelineHistoryControls | undefined = shouldShowLoadEarlierControl(
    thread.history,
  )
    ? {
        hasMoreHistory: thread.history.hasMoreHistory,
        loading: thread.history.loading,
        error: thread.history.error,
        onLoadEarlier: () =>
          void loadEarlier({
            environmentId: threadRef.environmentId,
            input: { threadId: threadRef.threadId },
          }),
      }
    : undefined;
  const guestId = view.guestId;
  const reportOpenFailure = (error: string | null) => {
    if (error !== null) {
      toastManager.add({ type: "error", title: "Could not open your Tinkjam", description: error });
    }
  };
  // This guest's own box's changes are on their machine; anyone else's the owner's server reads.
  const readCodePatch: ReadRoomCodePatch = async ({ note, changes, path, scope }) => {
    if (changes.guestId === undefined) return readRoomCodePatch(endpoint, note.id, path, scope);
    const own = boxOn(changes.boxId).machine;
    if (own === null) {
      return { error: "Open this on your machine, where your thread box's changes are." };
    }
    const result = await readOwnBoxPatch({
      environmentId: own.environmentId,
      input: {
        host: share.host,
        shareId: GuestShareId.make(share.shareId),
        boxId: changes.boxId,
        turnCount: changes.turnCount,
        path,
        scope,
      },
    });
    return result._tag === "Success" ? roomCodePatchRead(result.value) : ROOM_CODE_PATCH_UNREADABLE;
  };
  // The task becomes this guest's, and a draft in their own Tinkjam; neither sends anything.
  const takeTask = (task: RoomBoardNote) => {
    const opened = openOnMyMachine(endpoint, share.host, {
      task: { shareId: share.shareId, taskId: task.id, text: task.text },
    });
    if (guestId !== undefined && task.assignee?.guestId !== guestId) {
      void postBoardChange(endpoint, {
        type: "note.put",
        noteId: task.id,
        text: task.text,
        x: task.x,
        y: task.y,
        assignee: { guestId },
      });
    }
    void opened.then(reportOpenFailure);
  };
  const ownBoxNote = (boxId: string) =>
    guestId === undefined
      ? undefined
      : view.board?.notes.find(
          (note) => note.id === boxId && note.kind === "thread" && note.guestId === guestId,
        );
  // A box this guest adds starts on the model they last picked for one of theirs here.
  const newBoxSelection = guestId === undefined ? undefined : boardNewBoxModel(view.board, guestId);
  /**
   * The model one of this guest's boxes runs on, on their machine: none leaves the box's own
   * thread on its model, or a box without one on the joined thread's.
   */
  const ownBoxSelection = (own: OwnRoomMachine, boxId: string): ModelSelection | undefined => {
    const chosen = ownBoxNote(boxId)?.boxModel;
    const boxThreadId = own.boxes[boxId];
    if (boxThreadId === undefined) {
      return boardLocalModelPick(boxPicks[boxId], chosen) ?? chosen?.selection ?? newBoxSelection;
    }
    const ref = scopeThreadRef(own.environmentId, boxThreadId);
    const run = ownShells.find(
      (candidate) => candidate.environmentId === ref.environmentId && candidate.id === ref.threadId,
    )?.latestRun;
    return boardBoxModelPick({
      picked: composerDraftPick(useComposerDraftStore.getState().getComposerDraft(ref)),
      chosen,
      lastRunAt: run === undefined ? undefined : (run?.requestedAt ?? null),
    });
  };
  // This guest's pick for one of their boxes: theirs on the board, and here until it shows there.
  const pickOwnBoxModel = (boxId: string, selection: ModelSelection, name: string) => {
    const box = ownBoxNote(boxId);
    setBoxPicks((current) => ({
      ...current,
      [boxId]: { selection, name, over: box?.boxModel?.at },
    }));
    if (box !== undefined) {
      void postBoardChange(endpoint, {
        type: "box.model",
        noteId: boxId,
        modelSelection: selection,
        name,
      });
    }
  };
  // How a run of one of this guest's boxes ended, from their own machine's record.
  const ownBoxRunEnd = (boxId: string) => {
    const own = boxOn(boxId).machine;
    const threadId = own?.boxes[boxId];
    if (own === null || ownBoxNote(boxId) === undefined) return undefined;
    if (threadId === undefined) return null;
    const found = ownShells.find(
      (candidate) => candidate.environmentId === own.environmentId && candidate.id === threadId,
    );
    return found === undefined
      ? undefined
      : (boardAgentEndOf(found.latestRun, found.source.latestRunStopRequested === true) ?? null);
  };
  /**
   * Runs a prompt to this guest's own thread box on their own agent, on their machine in this
   * room, with the model picked for the box. Resolves to whether it ran.
   */
  const promptBoxHere = async (own: OwnRoomMachine, boxId: string, prompt: BoardPrompt) => {
    const selection = ownBoxSelection(own, prompt.modelOf ?? boxId);
    const turn =
      selection === undefined
        ? { modelSelection: undefined, text: prompt.text.trim() }
        : boardTurnSelection({
            selection,
            providers: ownProviders.get(own.environmentId) ?? [],
            text: prompt.text.trim(),
          });
    const result = await promptOwnBox({
      environmentId: own.environmentId,
      input: {
        host: share.host,
        shareId: GuestShareId.make(share.shareId),
        boxId,
        title: view.board?.notes.find((note) => note.id === boxId)?.text ?? "",
        text: turn.text,
        cards: boardContextCards(view.board, view.guests, prompt.cards, view.ownerName),
        ...(prompt.artifactId === null ? {} : { artifactId: prompt.artifactId }),
        ...(prompt.commentId === undefined ? {} : { commentId: prompt.commentId }),
        ...(turn.modelSelection === undefined ? {} : { modelSelection: turn.modelSelection }),
      },
    });
    if (result._tag === "Success" && result.value.threadId !== null) {
      setBoxThread(own.environmentId, boxId, result.value.threadId);
      // A box made by asking took its pick before it was on the board; the board keeps it now.
      const local = boxPicks[boxId];
      if (local !== undefined && local.over === undefined) {
        void postBoardChange(endpoint, {
          type: "box.model",
          noteId: boxId,
          modelSelection: local.selection,
          name: local.name,
        });
      }
      return true;
    }
    if (result._tag === "Failure" && isAtomCommandInterrupted(result)) return false;
    // The computer answered that it is not on this board: the way to bring it comes back.
    if (result._tag === "Success") forget(own.environmentId);
    toastManager.add({
      type: "error",
      title: "Could not run it on your agent",
      description:
        result._tag === "Failure"
          ? ownAgentFailureMessage(
              squashAtomCommandFailure(result),
              "Your computer did not answer. Check that Tinkjam Sync is running on it, then try again.",
            )
          : isCloudShare(share) || view.cloud === true
            ? "Your agent is no longer on this board. Press Bring my agent to bring it back."
            : "Your computer is no longer on this board. Choose Continue on my machine again.",
    });
    return false;
  };
  /**
   * Puts one of the guest's threads on their machine in this room on the board as their own box:
   * the box goes on the room's board first, and comes off again when their machine cannot take it.
   */
  const addOwnThread = async (
    own: OwnRoomMachine,
    thread: EnvironmentThreadShell,
    at: BoardPoint,
  ) => {
    const boxId = randomUUID();
    const added = await postBoardChange(endpoint, {
      type: "note.put",
      noteId: boxId,
      text: boardThreadBoxTitle(thread.title),
      ...at,
      kind: "thread",
    });
    const result = added
      ? await linkOwnBox({
          environmentId: own.environmentId,
          input: {
            host: share.host,
            shareId: GuestShareId.make(share.shareId),
            boxId,
            threadId: thread.id,
          },
        })
      : null;
    if (result?._tag === "Success") {
      setBoxThread(own.environmentId, boxId, thread.id);
      return true;
    }
    if (added) void postBoardChange(endpoint, { type: "note.remove", noteId: boxId });
    if (result !== null && isAtomCommandInterrupted(result)) return false;
    toastManager.add({
      type: "error",
      title: "Could not add the thread to the board",
      description:
        result === null
          ? "The board did not take it. It may be full."
          : messageOfFailure(squashAtomCommandFailure(result)),
    });
    return false;
  };
  // On nobody's machine: no thread, owner or code of its own. Agents come from people's own
  // machines, where the host lets them.
  const cloud = isCloudShare(share) || view.cloud === true;
  const roomCloud = cloud ? { agents: view.machines === true } : undefined;
  const agents = roomCloud?.agents !== false;
  // A prompt from this guest's own thread box. Their own agent runs it when a machine of theirs
  // joined this room. Otherwise it is a request that waits for the owner like any message, with
  // the cards written into it, so the owner reads exactly what would reach their agent.
  const promptBox = async (boxId: string, prompt: BoardPrompt) => {
    const on = boxOn(boxId);
    // Its chat is on a computer that is not connected: never quietly run it on another one.
    if (on.machine === null && on.stranded !== null && machines.length > 0) {
      toastManager.add({
        type: "error",
        title: `${on.stranded} is not connected`,
        description: `This agent's chat is on ${on.stranded}. Wake it, or add a new agent to use another computer.`,
      });
      return false;
    }
    if (on.machine !== null) {
      if (prompt.text.trim() === "" || prompt.text.length > GUEST_MESSAGE_MAX_LENGTH) {
        toastManager.add({
          type: "error",
          title: "Could not send the prompt",
          description:
            prompt.text.trim() === "" ? "Write a prompt first." : "This prompt is too long.",
        });
        return false;
      }
      return promptBoxHere(on.machine, boxId, prompt);
    }
    // A cloud board has no owner to send a request to: only their own agent can run it.
    if (cloud) {
      if (agentJoined.current && !away) {
        toastManager.add({
          type: "info",
          title: "Your agent is still joining",
          description: "Send it again in a moment.",
        });
      } else {
        setBringingAgent(true);
      }
      return false;
    }
    const text = guestBoardPromptText(
      prompt.text,
      boardContextCards(view.board, view.guests, prompt.cards, view.ownerName),
    );
    const failure =
      text === ""
        ? "Write a prompt first."
        : text.length > GUEST_MESSAGE_MAX_LENGTH
          ? "This prompt and its cards are too long. Remove a card or shorten the prompt."
          : await postGuestMessage(endpoint, text, [], {
              boxId,
              cardRefs: prompt.cards.map((card) => card.ref),
              ...(prompt.artifactId === null ? {} : { artifactId: prompt.artifactId }),
            });
    if (failure !== null) {
      toastManager.add({
        type: "error",
        title: "Could not send the prompt",
        description: failure,
      });
    }
    return failure === null;
  };
  // The same draft a task makes. The room answers only a task card, so a note answers nothing.
  const giveNote = (note: RoomBoardNote) =>
    void openOnMyMachine(endpoint, share.host, {
      task: { shareId: share.shareId, taskId: note.id, text: boardNoteMessage(note) },
    }).then(reportOpenFailure);
  const conversation = (
    <Suspense
      fallback={
        <p role="status" className="chat-content-lane px-4 py-4 text-sm text-muted-foreground">
          Opening the conversation…
        </p>
      }
    >
      <GuestThread
        endpoint={endpoint}
        host={share.host}
        view={view}
        projection={projection}
        online={online}
        awaitingRowIds={awaitingRowIds}
        historyControls={historyControls}
        onClose={guestId === undefined ? undefined : () => setPanelOpen(false)}
        onBoardChange={
          guestId === undefined ? undefined : (change) => postBoardChange(endpoint, change)
        }
        draft={draft}
        onDraftChange={setDraft}
        composerRef={composerRef}
      />
    </Suspense>
  );
  // Can only look at a cloud board: no tools, no agent, no pointer, and the host refuses changes.
  const viewOnly = cloud && view.viewOnly === true;
  // The one guest of a link made before several could join cannot sign a note, so has no board.
  // Someone looking on from a view link is nobody on the board, so it names nobody as them.
  const boardViewer = guestId ?? (viewOnly ? LINK_VIEWER : undefined);
  if (boardViewer === undefined) return conversation;
  const sharing =
    guestId === undefined ? undefined : (
      <CloudBoardSharing
        share={share}
        title={view.title}
        guests={view.guests}
        viewer={guestId}
        maker={view.maker}
        online={online}
        links={boardLinksOf(view, share.credential)}
        manage={view.manage === true}
        viewers={view.viewers ?? NO_VIEWERS}
        viewing={viewing ?? 0}
        copies={view.copies === true}
        sharing={view.sharing}
      />
    );
  const viewOnlyBar =
    cloud && viewOnly ? (
      <ViewOnlyBar
        viewing={viewing ?? 0}
        shareId={share.shareId}
        viewCredential={share.viewOnly === true ? share.token : undefined}
        granted={view.granted}
        copy={
          view.copies === true
            ? async () => {
                const made = await copyCloudBoard(share, view.title);
                if (typeof made === "string") {
                  toastManager.add({
                    type: "error",
                    title: "Could not make a copy",
                    description: made,
                  });
                  return;
                }
                void navigate(guestShareLocation(made));
              }
            : undefined
        }
      />
    ) : null;
  const sideRef = sideBox === null ? undefined : boxThread(sideBox);
  const sideTitle =
    view.board?.notes.find((note) => note.id === sideBox)?.text.trim() || "Thread box";
  const closeSide = () => {
    setSideBox(null);
    setPanelOpen(false);
  };
  // Their computers answer a moment after the board opens: until then the panel waits.
  const stranded = sideBox === null ? null : boxOn(sideBox).stranded;
  const sidePanel =
    sideBox === null || (sideRef === undefined && machine === undefined) ? null : sideRef ===
      undefined ? (
      <BoardChatPanelNote title={sideTitle} onClose={closeSide}>
        {stranded === null
          ? "This agent has no conversation yet. Ask it something from its box to start one."
          : `This conversation is on ${stranded}, which is not connected. Open Tinkjam Sync there to see it.`}
      </BoardChatPanelNote>
    ) : (
      <BoardChatPanel
        environmentId={sideRef.environmentId}
        threadId={sideRef.threadId}
        title={sideTitle}
        onClose={closeSide}
        onPopOut={() => void navigate({ to: "/$environmentId/$threadId", params: sideRef })}
      />
    );
  const showRoomConversation = () => {
    setSideBox(null);
    setPanelOpen(true);
  };
  return (
    <RoomLiveContext value={live}>
      <BoardLanded />
      <BoardSyncNote live={thread.status === "live"} />
      <GuestBoardLive shareId={share.shareId} running={running} live={live} />
      <BoardSplit
        open={sidePanel !== null || (!cloud && panelOpen)}
        panel={
          sidePanel ??
          (cloud ? null : <div className="flex h-full min-h-0 flex-col">{conversation}</div>)
        }
        board={
          <BoardMentionsProvider
            shareId={share.shareId}
            guests={view.guests}
            viewer={guestId ?? null}
          >
            <RoomBoard
              title={view.title}
              room={view}
              shareId={share.shareId}
              viewKey={`guest:${share.shareId}`}
              online={online}
              messages={boardMessages(
                projection.visibleTurnItems.map((row) => row.item),
                BOARD_THREAD_MESSAGES,
                "Owner",
              )}
              agentWorking={deriveThreadAgentWorking(projection)}
              ownerCode={ownerCode}
              onTakeTask={agents ? takeTask : undefined}
              onGiveNote={agents ? giveNote : undefined}
              cloud={roomCloud}
              ownAgentAway={away}
              takeAgentAway={
                roomCloud?.agents === true && machine != null
                  ? () => takeAgentAway(machine)
                  : undefined
              }
              bringAgent={
                roomCloud?.agents === true && machine == null
                  ? () => setBringingAgent(true)
                  : undefined
              }
              ownBoxHandle={ownBox}
              ownerAssignable={!cloud}
              onToggleChat={
                cloud
                  ? undefined
                  : () => {
                      setPanelOpen((open) => sideBox === null && !open);
                      setSideBox(null);
                    }
              }
              {...(cloud
                ? {
                    onBack: () => void navigate({ to: "/" }),
                    backLabel: "Boards",
                    titleEditor: viewOnly ? undefined : (
                      <BoardTitle
                        threadRef={threadRef}
                        title={view.title}
                        rename={(title) => renameCloudBoard(share, title)}
                      />
                    ),
                    sharing: (
                      <>
                        <InboxBell nudge={view.inboxAt} />
                        {sharing}
                      </>
                    ),
                    sharingBanner: viewOnlyBar,
                    sharingFolds: true,
                  }
                : {})}
              viewOnly={viewOnly}
              marksStart={cloud ? guestId !== undefined && view.maker === guestId : false}
              viewer={boardViewer}
              ownerName={view.ownerName}
              cursorLayer={
                <GuestBoardCursors
                  shareId={share.shareId}
                  guests={view.guests}
                  ownerName={view.ownerName}
                />
              }
              onOpenThread={showRoomConversation}
              onOpenReply={(messageId) => {
                revealRoomReply(messageId);
                showRoomConversation();
              }}
              onChange={viewOnly ? undefined : (change) => postBoardChange(endpoint, change)}
              onCursor={viewOnly ? undefined : (presence) => postBoardCursor(endpoint, presence)}
              onPromptBox={agents ? promptBox : undefined}
              stopBox={agents ? stopBox : undefined}
              boxChatDeleter={boxChatDeleter}
              askInComments={agents && machine != null}
              readCodePatch={readCodePatch}
              onRefreshPullRequest={
                cloud ? undefined : (noteId) => refreshRoomPullRequest(endpoint, noteId)
              }
              onAddThread={!agents || machine == null ? undefined : setAddingAt}
              renderBoxModel={(boxId) => {
                if (viewOnly) return null;
                const on = boxOn(boxId);
                // Names the computer for someone with several; nothing for someone with one.
                const computer = (
                  <OwnBoxComputerPicker
                    computers={computers}
                    on={on}
                    onChoose={choose}
                    onBring={roomCloud?.agents === true ? () => setBringingAgent(true) : undefined}
                    onStartOver={machines.length > 0 ? () => startOver(boxId) : undefined}
                  />
                );
                if (on.machine === null) {
                  return on.stranded !== null && machines.length > 0 ? (
                    computer
                  ) : (
                    <span className="truncate text-2xs text-muted-foreground">
                      {machine === null
                        ? !cloud
                          ? "Goes to the owner"
                          : away
                            ? "Your computer is not connected"
                            : "Your agent is not here"
                        : ""}
                    </span>
                  );
                }
                return (
                  <div className="flex min-w-0 items-center gap-0.5">
                    {computer}
                    <OwnBoxModelPicker
                      machine={on.machine}
                      boxId={boxId}
                      pick={ownBoxSelection(on.machine, boxId)}
                      chosen={ownBoxNote(boxId)?.boxModel}
                      onPick={(selection, name) => pickOwnBoxModel(boxId, selection, name)}
                    />
                  </div>
                );
              }}
              boxRunEnd={ownBoxRunEnd}
              roomModel={view.model.name}
              guestBoxPlaceholder={
                machine === undefined
                  ? "Ask an agent"
                  : machine === null && !cloud
                    ? "Ask the owner's agent"
                    : "Ask your agent"
              }
              conversationBoxIds={machines.flatMap((own) => Object.keys(own.boxes))}
              onOpenConversation={setSideBox}
              ownerWritingArtifactId={ownerWritingArtifactId(
                projection.visibleTurnItems.map((row) => row.item),
                deriveThreadStructureRuntime(projection)?.activeRunId,
                view.shareId,
              )}
              needsApproval={(pendingRequests?.approvals.length ?? 0) > 0}
              renderBoxApproval={(boxId) => {
                const ref = boxThread(boxId);
                return ref === undefined ? null : <BoxApproval threadRef={ref} />;
              }}
              onUseNote={
                cloud
                  ? undefined
                  : (text) => {
                      // Only a draft in the message box: the guest sends it, and the owner still approves it.
                      flushSync(() => {
                        setDraft((current) =>
                          appendNoteToDraft(current, text).slice(0, GUEST_MESSAGE_MAX_LENGTH),
                        );
                        setPanelOpen(true);
                      });
                      composerRef.current?.focus();
                    }
              }
            />
          </BoardMentionsProvider>
        }
      />
      <BringAgentDialog
        open={bringingAgent}
        onOpenChange={setBringingAgent}
        onBring={bringAgentFrom}
        onBrought={() => {
          markBoardGuideStep("agent");
          if (ownBox.current?.() == null) return;
          toastManager.add({
            type: "info",
            title: "This is your agent. Only you can send it work.",
          });
        }}
      />
      {machine == null || addingAt === null ? null : (
        <BoardThreadPicker
          environmentId={machine.environmentId}
          excluded={new Set([machine.threadId, ...Object.values(machine.boxes)])}
          onPick={(picked) => addOwnThread(machine, picked, addingAt)}
          onClose={() => setAddingAt(null)}
        />
      )}
    </RoomLiveContext>
  );
}

/** The thread boxes' runs, read here and kept in the board's live store. */
function GuestBoardLive({
  shareId,
  running,
  live,
}: {
  readonly shareId: string;
  readonly running: ReadonlyArray<RoomAgentActivity>;
  readonly live: RoomLiveStore;
}) {
  const boxes = useAtomValue(guestRoomBoxesAtom(shareId));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- hands the room's live runs to the board's store, which lives outside React
  useEffect(() => {
    live.setRunning(running);
    live.setBoxes(boxes);
  }, [live, running, boxes]);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- stops the store's clock once the board closes
  useEffect(
    () => () => {
      live.setRunning([]);
      live.setBoxes(undefined);
    },
    [live],
  );
  return null;
}

/** Everyone else's pointers and views, read here so a pointer moving renders only this. */
function GuestBoardCursors({
  shareId,
  guests,
  ownerName,
}: {
  readonly shareId: string;
  readonly guests: ReadonlyArray<ThreadGuest>;
  readonly ownerName: string | undefined;
}) {
  const cursors = useAtomValue(guestRoomCursorsAtom(shareId));
  const views = useAtomValue(guestRoomViewsAtom(shareId));
  return <RoomCursors cursors={cursors} views={views} guests={guests} ownerName={ownerName} />;
}

// No guest has this id: the board's own rules then treat whoever looks as nobody on it.
const LINK_VIEWER = GuestId.make("viewer");
const NO_VIEWERS: ReadonlyArray<GuestId> = [];
