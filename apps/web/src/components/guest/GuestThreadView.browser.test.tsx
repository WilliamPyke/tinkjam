import { guestEnvironmentId } from "@t3tools/client-runtime/environment";
import {
  GUEST_COMMAND_OUTPUT_ROUTE,
  GuestId,
  GuestShareId,
  MessageId,
  type OrchestrationV2ThreadProjection,
  ProviderInstanceId,
  RunId,
  ThreadId,
  TurnItemId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import { describe, expect, it, vi } from "vite-plus/test";

import "~/index.css";

import { fakeTimers, render } from "../../../test/render";
import { stopBoardChangeRetries } from "~/guest/boardChangeRetries";
import { forgetGuestShare, guestRoomAtom, rememberGuestShare } from "../../guest/guestShares";
import { AppAtomRegistryProvider, appAtomRegistry } from "../../rpc/atomRegistry";
import { makeThreadProjectionFixture } from "../../test-fixtures";
import { SidebarProvider } from "../ui/sidebar";
import { GuestThreadRoute, postBoardChange, sendBoardChangesAsPageCloses } from "./GuestThreadView";

const thread = vi.hoisted(() => ({ state: null as unknown }));
vi.mock(import("~/state/threads"), async (original) => ({
  ...(await original()),
  useEnvironmentThread: (() => thread.state) as never,
}));
const environment = vi.hoisted(() => ({ phase: null as string | null }));
vi.mock(import("~/state/environments"), async (original) => {
  const real = await original();
  return {
    ...real,
    useEnvironment: ((environmentId: never) =>
      environment.phase === null
        ? real.useEnvironment(environmentId)
        : { connection: { phase: environment.phase } }) as never,
  };
});

const SHARE_ID = "share-1";
const THREAD_ID = ThreadId.make("thread-test");
const RUN_ID = RunId.make("run-1");
const STARTED_AT = DateTime.makeUnsafe("2026-09-20T12:00:00Z");
const PROVIDER = ProviderInstanceId.make("shared");

/** One settled turn: a prompt, an edit, a command, a search, and the answer. */
function settledTurn(): OrchestrationV2ThreadProjection {
  const base = (id: string, ordinal: number) => ({
    id: TurnItemId.make(id),
    threadId: THREAD_ID,
    runId: RUN_ID,
    nodeId: null,
    providerThreadId: null,
    providerTurnId: null,
    nativeItemRef: null,
    parentItemId: null,
    ordinal,
    status: "completed" as const,
    title: null,
    startedAt: STARTED_AT,
    completedAt: STARTED_AT,
    updatedAt: STARTED_AT,
  });
  const items: OrchestrationV2ThreadProjection["turnItems"] = [
    {
      ...base("user", 0),
      type: "user_message",
      messageId: MessageId.make("user"),
      createdBy: "user",
      creationSource: "web",
      inputIntent: "turn_start",
      text: "Build it",
      attachments: [],
    },
    { ...base("edit", 1), type: "file_change", fileName: "proj/src/a.ts", additions: 1 },
    { ...base("command", 2), type: "command_execution", input: "ls src", outputOmitted: true },
    { ...base("search", 3), type: "file_search", pattern: "needle" },
    {
      ...base("answer", 4),
      type: "assistant_message",
      messageId: MessageId.make("answer"),
      text: "Done",
      streaming: false,
    },
  ];
  return {
    ...makeThreadProjectionFixture(),
    turnItems: items,
    visibleTurnItems: items.map((item, position) => ({
      position,
      visibility: "local",
      sourceThreadId: THREAD_ID,
      sourceItemId: item.id,
      item,
    })),
    runs: [
      {
        id: RUN_ID,
        threadId: THREAD_ID,
        ordinal: 1,
        providerInstanceId: PROVIDER,
        modelSelection: { instanceId: PROVIDER, model: "gpt-5.4" },
        providerThreadId: null,
        userMessageId: MessageId.make("user"),
        rootNodeId: null,
        activeAttemptId: null,
        status: "completed",
        requestedAt: STARTED_AT,
        startedAt: STARTED_AT,
        completedAt: DateTime.makeUnsafe("2026-09-20T12:00:19Z"),
        checkpointId: null,
        contextHandoffId: null,
      },
    ],
  };
}

function setup(): Disposable {
  environment.phase = null;
  thread.state = {
    data: Option.some(settledTurn()),
    status: "live",
    error: Option.none(),
    history: { hasMoreHistory: false, loading: false, error: null },
    sequence: 1,
  };
  rememberGuestShare({
    host: "sam.t3.codes",
    shareId: SHARE_ID,
    threadId: THREAD_ID,
    token: "guest-token",
    title: "Thread",
    joinedAt: "2026-09-20T12:00:00.000Z",
  });
  const guestId = GuestId.make("guest-1");
  appAtomRegistry.set(guestRoomAtom(SHARE_ID), {
    online: [guestId],
    running: [],
    view: {
      shareId: GuestShareId.make(SHARE_ID),
      title: "Thread",
      guestName: "Sam",
      guestId,
      guests: [],
      direct: false,
      expiresAt: "2026-09-21T12:00:00.000Z",
      messages: [],
      model: { driver: null, name: "gpt-5.4" },
    },
  });
  return {
    [Symbol.dispose]: () => {
      forgetGuestShare(SHARE_ID);
      appAtomRegistry.set(guestRoomAtom(SHARE_ID), { online: [], view: null, running: [] });
    },
  };
}

describe("GuestThreadRoute", () => {
  it("opens a work group to its rows, and reads a row's detail through the guest routes", async () => {
    using _share = setup();
    using fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(null, { status: 404 }));
    await using screen = await render(
      <AppAtomRegistryProvider>
        <SidebarProvider>
          <GuestThreadRoute
            threadRef={{ environmentId: guestEnvironmentId(SHARE_ID), threadId: THREAD_ID }}
          />
        </SidebarProvider>
      </AppAtomRegistryProvider>,
    );

    await screen.getByRole("button", { name: /^Worked for/ }).click();
    await screen.getByRole("button", { name: /^Changed 1 file, ran 1 command/ }).click();
    const rows = screen.getByRole("region", { name: "Tool calls" });
    await expect.element(rows.getByRole("button", { name: "proj/src/a.ts" })).toBeVisible();
    await expect.element(rows.getByRole("button", { name: "Searched needle" })).toBeVisible();

    await rows.getByRole("button", { name: "ls src" }).click();
    await vi.waitFor(() =>
      expect(fetchSpy.mock.calls.map(([url]) => String(url))).toContainEqual(
        expect.stringMatching(
          new RegExp(`^https://sam\\.t3\\.codes${GUEST_COMMAND_OUTPUT_ROUTE}\\?.*item=command`),
        ),
      ),
    );
  });

  it("keeps offering Try again once the board had to retry, while it still has not opened", async () => {
    using _share = setup();
    thread.state = { ...(thread.state as object), data: Option.none(), status: "pending" };
    appAtomRegistry.set(guestRoomAtom(SHARE_ID), { online: [], view: null, running: [] });
    environment.phase = "reconnecting";
    const route = () => (
      <AppAtomRegistryProvider>
        <SidebarProvider>
          <GuestThreadRoute
            threadRef={{ environmentId: guestEnvironmentId(SHARE_ID), threadId: THREAD_ID }}
          />
        </SidebarProvider>
      </AppAtomRegistryProvider>
    );
    await using screen = await render(route());
    await expect.element(screen.getByRole("button", { name: "Try again" })).toBeVisible();

    // Connected again, and the board's stream is still silent.
    environment.phase = "connected";
    await screen.rerender(route());
    await expect.element(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

describe("postBoardChange", () => {
  const endpoint = { httpBaseUrl: "https://boards.example", shareId: SHARE_ID, token: "t" };
  const toBoard = (input: unknown) => String(input).startsWith(endpoint.httpBaseUrl);

  /**
   * Answers the board host's requests in turn, repeating the last answer. Other requests go out
   * as usual: earlier renders leave the app's own environment poll running.
   */
  function boardHost(...answers: ReadonlyArray<Response | Error>) {
    const realFetch = globalThis.fetch;
    let next = 0;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (!toBoard(input)) return realFetch(input, init);
      const answer = answers[Math.min(next++, answers.length - 1)];
      return answer instanceof Response ? Promise.resolve(answer) : Promise.reject(answer);
    });
    return Object.assign(spy, {
      sends: () => spy.mock.calls.filter(([input]) => toBoard(input)),
    });
  }

  it("keeps a change made offline and sends it once the connection is back", async () => {
    using online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    using host = boardHost(new TypeError("Failed to fetch"), new Response(null, { status: 200 }));
    const sent = postBoardChange(endpoint, { type: "card.move", cardId: "c", x: 1, y: 2 });
    // The change waits for the connection only once its failed send is counted as unsaved.
    await vi.waitFor(() => {
      const unload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
    });
    expect(host.sends()).toHaveLength(1);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await expect(sent).resolves.toBe(true);
    expect(host.sends()).toHaveLength(2);
  });

  it("sends a change again while the host fails, until it lands", async () => {
    using _timers = fakeTimers();
    using host = boardHost(
      new Response(null, { status: 500 }),
      new TypeError("Failed to fetch"),
      new Response(null, { status: 200 }),
    );
    const sent = postBoardChange(endpoint, { type: "card.move", cardId: "c", x: 1, y: 2 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(host.sends()).toHaveLength(2);
    const waitingUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(waitingUnload);
    expect(waitingUnload.defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(sent).resolves.toBe(true);
    const settledUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(settledUnload);
    expect(settledUnload.defaultPrevented).toBe(false);
    expect(host.sends()).toHaveLength(3);
    expect(new Set(host.sends().map(([, init]) => init?.body)).size).toBe(1);
    // Each try is the same change in its page's order, so the host never takes it twice.
    const tries = new Set(host.sends().map(([input]) => String(input)));
    expect([...tries]).toEqual([expect.stringMatching(/[?&]client=[^&]+&seq=\d+/)]);
  });

  it("stops a waiting change when its board's retries stop", async () => {
    using _timers = fakeTimers();
    using host = boardHost(
      new Response(null, { status: 500 }),
      new Response(null, { status: 200 }),
    );
    const sent = postBoardChange(endpoint, { type: "card.move", cardId: "c", x: 1, y: 2 });
    await vi.advanceTimersByTimeAsync(0);
    const waitingUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(waitingUnload);
    expect(waitingUnload.defaultPrevented).toBe(true);

    stopBoardChangeRetries(SHARE_ID);

    await expect(sent).resolves.toBe(false);
    const settledUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(settledUnload);
    expect(settledUnload.defaultPrevented).toBe(false);
    expect(host.sends()).toHaveLength(1);
  });

  it("does not send a refused change again", async () => {
    using host = boardHost(new Response(null, { status: 403 }));
    await expect(
      postBoardChange(endpoint, { type: "card.move", cardId: "c", x: 1, y: 2 }),
    ).resolves.toBe(false);
    expect(host.sends()).toHaveLength(1);
  });

  it("sends what the page still holds as it closes in one request, after changes not yet answered", async () => {
    const realFetch = globalThis.fetch;
    const sends: Array<{ url: string; body: string }> = [];
    using _host = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (!toBoard(input)) return realFetch(input, init);
      sends.push({ url: String(input), body: String(init?.body) });
      if (String(input).includes("/board/changes")) {
        return Promise.resolve(
          Response.json({ results: [{ status: 204 }, { status: 204 }, { status: 409 }] }),
        );
      }
      // The host has not answered, as when the request has not left the browser yet.
      return new Promise<Response>(() => {});
    });
    const moved = { type: "card.move", cardId: "c", x: 1, y: 2 } as const;
    const reacted = { type: "note.react", noteId: "n", emoji: "👍" } as const;
    void postBoardChange(endpoint, moved);
    void postBoardChange(endpoint, reacted);
    await vi.waitFor(() => expect(sends).toHaveLength(2));
    const movedSeq = Number(new URL(sends[0]!.url).searchParams.get("seq"));
    const put = { type: "note.put", noteId: "n", text: "Typed", x: 0, y: 0 } as const;
    const remove = { type: "note.remove", noteId: "m" } as const;

    await expect(sendBoardChangesAsPageCloses(endpoint, [put, remove], true)).resolves.toEqual([
      true,
      false,
    ]);
    // The move goes again under its own place in the page's order, so whichever copy arrives
    // second changes nothing. A reaction sent twice would undo itself, so it does not.
    const request = JSON.parse(sends[2]!.body);
    expect(request.changes.map((sent: { change: unknown }) => sent.change)).toEqual([
      moved,
      put,
      remove,
    ]);
    expect(request.changes[0].seq).toBe(movedSeq);
    expect(request.changes[1].seq).toBeGreaterThan(movedSeq);
    expect(request.changes[2].seq).toBeGreaterThan(request.changes[1].seq);
    // Sent once: hiding the page and then closing it does not send the move a third time.
    await expect(sendBoardChangesAsPageCloses(endpoint, [], true)).resolves.toEqual([]);
    expect(sends).toHaveLength(3);
    stopBoardChangeRetries(SHARE_ID);
  });

  it("does not send a toggle again, which could land twice", async () => {
    using _online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    using host = boardHost(new TypeError("Failed to fetch"), new Response(null, { status: 500 }));
    await expect(
      postBoardChange(endpoint, { type: "note.react", noteId: "n", emoji: "👍" }),
    ).resolves.toBe(false);
    await expect(
      postBoardChange(endpoint, { type: "artifact.restore", noteId: "n" }),
    ).resolves.toBe(false);
    expect(host.sends()).toHaveLength(2);
  });
});
