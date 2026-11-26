import { describe, expect, it } from "vite-plus/test";

import movePage from "../public/move.html?raw";
import { mergeMovedShares, moveStep, packMove, unpackMove } from "./domainMove.logic";

const NEW = "https://app.tinkjam.com";
const OLD = "https://app.trellium.org";
const SHARES = "t3code:guest-shares:v1";

const share = (shareId: string, extra: Record<string, unknown> = {}) => ({
  host: "boards.trellium.org",
  shareId,
  threadId: `thread-${shareId}`,
  token: `token-${shareId}`,
  title: "Plän ✏️",
  joinedAt: "2026-11-01T00:00:00.000Z",
  ...extra,
});

// Runs public/move.html's script at `href`, and returns where it sends the browser, if anywhere.
function runMovePage(href: string, stored: Record<string, string>, cookie = "", framed = false) {
  const script = movePage.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (script === undefined) throw new Error("move.html has no script");
  const url = new URL(href);
  let went: string | null = null;
  const location = {
    origin: url.origin,
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    search: url.search,
    hash: url.hash,
    replace: (to: string) => void (went = to),
  };
  const fakeWindow: Record<string, unknown> = {
    location,
    localStorage: { getItem: (key: string) => stored[key] ?? null },
  };
  fakeWindow.top = framed ? {} : fakeWindow;
  new Function("window", "document", script)(fakeWindow, { cookie });
  return went;
}

const step = (over: Partial<Parameters<typeof moveStep>[0]>) =>
  moveStep({
    origin: NEW,
    current: NEW,
    origins: [NEW, OLD],
    path: "/guest",
    search: "?host=boards.tinkjam.com",
    hash: "#invite",
    referrer: "",
    moved: false,
    asked: false,
    canStore: true,
    framed: false,
    now: Date.UTC(2026, 10, 20),
    read: () => null,
    cookie: "",
    ...over,
  });

describe("moving between our domains", () => {
  it("hands over signed-out boards and small choices, and the link's own fragment", () => {
    const stored: Record<string, string> = {
      [SHARES]: JSON.stringify([share("a"), share("mine", { accountId: "user_1" })]),
      "t3code:theme": "dark",
      "t3code:composer-drafts:v1": "private",
    };
    const sent = step({
      origin: OLD,
      read: (key) => stored[key] ?? null,
      cookie: "x=1; __clerk_db_jwt_ab12=dev.jwt=",
    });
    if (sent.kind !== "go") throw new Error("expected the older address to leave");
    const url = new URL(sent.href);
    expect(url.origin).toBe(NEW);
    expect(url.pathname).toBe("/guest");
    expect(url.searchParams.get("host")).toBe("boards.tinkjam.com");
    expect(url.searchParams.get("__clerk_db_jwt")).toBe("dev.jwt=");
    const payload = unpackMove(url.hash);
    expect(payload?.hash).toBe("#invite");
    expect(payload?.kept).toEqual({ "t3code:theme": "dark" });
    expect(JSON.parse(payload?.shares ?? "[]")).toEqual([share("a")]);

    // The current address takes it only from our older one, once.
    const arrive = (over: Partial<Parameters<typeof moveStep>[0]>) =>
      step({ search: url.search, hash: url.hash, ...over });
    expect(arrive({ referrer: `${OLD}/` })).toEqual({
      kind: "arrived",
      href: `/guest${url.search}#invite`,
      payload,
      done: true,
    });
    const plain = "/guest?host=boards.tinkjam.com#invite";
    for (const [over, done] of [
      [{ referrer: `${OLD}/`, moved: true }, true],
      [{ referrer: "" }, true],
      [{ referrer: "https://evil.test/" }, false],
      [{ referrer: `${OLD}.evil.test/` }, false],
    ] as const) {
      expect(arrive(over), JSON.stringify(over)).toEqual({
        kind: "arrived",
        href: plain,
        payload: null,
        done,
      });
    }
  });

  it("asks the older address once per browser, and only from the app's own pages", () => {
    expect(step({})).toEqual({
      kind: "go",
      href: `${OLD}/move?to=%2Fguest%3Fhost%3Dboards.tinkjam.com#invite`,
      asking: true,
    });
    for (const over of [
      { moved: true },
      { asked: true },
      { canStore: false },
      { framed: true },
      { now: Date.UTC(2027, 5, 1) },
      { origin: "http://localhost:5733" },
      { origins: [NEW] },
    ]) {
      expect(step(over), JSON.stringify(over)).toEqual({ kind: "stay" });
    }
    expect(unpackMove("#moved=not-json")).toBeNull();
    expect(unpackMove(packMove({ read: () => "{", hash: "" }))?.shares).toBe("[]");
  });

  it("asks through a static page on the older address that hands over as the app there would", () => {
    const stored: Record<string, string> = {
      [SHARES]: JSON.stringify([share("a", { openedAt: "2026-11-02T00:00:00.000Z" }), share("b")]),
      "t3code:board-name:v1": "Ada",
    };
    const cookie = "__clerk_db_jwt_ab12=dev.jwt=";
    const asked = step({});
    if (asked.kind !== "go") throw new Error("expected the current address to ask");
    const went = runMovePage(asked.href, stored, cookie);
    const fromApp = step({ origin: OLD, read: (key) => stored[key] ?? null, cookie });
    if (fromApp.kind !== "go") throw new Error("expected the older address to leave");
    expect(went).toBe(fromApp.href);

    const arrived = new URL(went ?? "");
    expect(step({ search: arrived.search, hash: arrived.hash, referrer: `${OLD}/` })).toMatchObject(
      {
        kind: "arrived",
        href: `/guest${arrived.search}#invite`,
        payload: { kept: { "t3code:board-name:v1": "Ada" } },
        done: true,
      },
    );
    expect(runMovePage(`${OLD}/move?to=%2F`, {})).toMatch(new RegExp(`^${NEW}/#moved=`));
  });

  it("sends the static page's hand-over only to the app's current address", () => {
    for (const to of ["//evil.test/x", "https://evil.test/", "/\t/evil.test", "\\evil.test"]) {
      const went = runMovePage(`${OLD}/move?to=${encodeURIComponent(to)}`, {});
      expect(new URL(went ?? "").origin, to).toBe(NEW);
    }
    expect(runMovePage(`${NEW}/move?to=%2Fguest#invite`, { [SHARES]: "[]" })).toBe(
      `${NEW}/guest#invite`,
    );
    expect(runMovePage(`${OLD}/move?to=%2F`, {}, "", true)).toBeNull();
  });

  it("takes in handed-over boards without replacing its own or following a strange host", () => {
    const own = [{ ...share("a"), host: "boards.tinkjam.com", token: "kept" }];
    const hostOf = (host: string) => (host === "boards.trellium.org" ? "boards.tinkjam.com" : null);
    expect(
      mergeMovedShares(own, [share("a"), share("b"), share("c", { host: "evil.test" })], hostOf),
    ).toEqual([own[0], { ...share("b"), host: "boards.tinkjam.com" }]);
    expect(mergeMovedShares(own, [share("a")], hostOf)).toBe(own);
  });
});
