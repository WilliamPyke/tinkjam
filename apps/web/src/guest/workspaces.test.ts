import { CLOUD_WORKSPACE_OPEN_ROUTE, CLOUD_WORKSPACES_ROUTE } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";

import { forgetGuestShare } from "./guestShares";
import { openBoardAsAccount, syncWorkspaces } from "./workspaces";

const host = vi.hoisted(() => ({
  workspaces: [] as ReadonlyArray<unknown>,
  requests: [] as Array<string>,
}));

vi.mock("./cloudBoardsHost", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cloudBoardsHost")>()),
  cloudBoardsHost: () => "https://boards.example",
}));

vi.mock("./boardAccount", () => ({
  SIGN_IN_UNCONFIRMED: "unconfirmed",
  boardAccountsEnabled: () => true,
  readBoardAccountProfile: () => ({ userId: "user_member", name: "Member" }),
  refreshAccountBoards: async () => {},
  openAccountBoard: async () => "This board was deleted, or you are no longer on it.",
  accountRequest: async (path: string) => {
    host.requests.push(path);
    if (path === CLOUD_WORKSPACES_ROUTE) return Response.json({ workspaces: host.workspaces });
    if (path.startsWith(CLOUD_WORKSPACE_OPEN_ROUTE)) {
      return Response.json({
        token: "session-token",
        board: {
          shareId: "share-w",
          threadId: "board-share-w",
          title: "Plan",
          addedAt: "2026-11-26T00:00:00.000Z",
          guestId: "guest-member",
          maker: false,
        },
      });
    }
    return new Response(null, { status: 404 });
  },
}));

const workspace = (boards: ReadonlyArray<string>) => ({
  id: "ws-1",
  name: "Team",
  color: "blue",
  role: "member",
  members: [],
  boards: boards.map((shareId) => ({
    shareId,
    threadId: `board-${shareId}`,
    title: "Plan",
    addedAt: "2026-11-26T00:00:00.000Z",
  })),
  createdAt: "2026-11-26T00:00:00.000Z",
});

const setup = (boards: ReadonlyArray<string>) => {
  // Node has no page: these stand in for its focus and visibility events.
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
  host.workspaces = [workspace(boards)];
  host.requests.length = 0;
  syncWorkspaces(null);
  syncWorkspaces("user_member");
};

describe("openBoardAsAccount", () => {
  it("opens a workspace board the account has no seat on yet, as its tile does", async () => {
    setup(["share-w"]);
    const opened = await openBoardAsAccount("share-w");
    expect(opened).toMatchObject({ shareId: "share-w", token: "session-token" });
    expect(host.requests.some((path) => path.startsWith(CLOUD_WORKSPACE_OPEN_ROUTE))).toBe(true);
  });

  it("is refused when no workspace of the account lists the board", async () => {
    setup([]);
    expect(typeof (await openBoardAsAccount("share-w"))).toBe("string");
    expect(host.requests.some((path) => path.startsWith(CLOUD_WORKSPACE_OPEN_ROUTE))).toBe(false);
  });
});

describe("a page that comes back", () => {
  it("reads the account's workspaces again, and stops once signed out", async () => {
    setup(["share-w"]);
    await vi.waitFor(() => expect(host.requests).toContain(CLOUD_WORKSPACES_ROUTE));
    host.requests.length = 0;
    window.dispatchEvent(new Event("focus"));
    expect(host.requests).toContain(CLOUD_WORKSPACES_ROUTE);
    syncWorkspaces(null);
    host.requests.length = 0;
    window.dispatchEvent(new Event("focus"));
    expect(host.requests).toEqual([]);
  });
});

describe("a board that ends", () => {
  it("reads the account's workspaces again", async () => {
    setup(["share-w"]);
    await vi.waitFor(() => expect(host.requests).toContain(CLOUD_WORKSPACES_ROUTE));
    host.requests.length = 0;
    forgetGuestShare("share-w", "ended");
    expect(host.requests).toContain(CLOUD_WORKSPACES_ROUTE);
  });
});
