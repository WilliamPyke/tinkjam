import { CLOUD_BOARD_ACCOUNT_CLAIM_MAX, GUEST_NAME_MAX_LENGTH, ThreadId } from "@t3tools/contracts";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../components/ui/toast", () => ({ toastManager: { add: vi.fn() } }));

import "./cloudBoards";

import {
  accountDisplayName,
  accountNameParts,
  accountNameSeed,
  boardsToClaim,
  browserAfterSignIn,
  emailNameGuess,
  friendlyName,
  resolveBoardName,
  sharedNameIds,
  sharesOfOtherAccounts,
} from "./boardAccount.logic";

const share = (shareId: string, extra: { host?: string; accountId?: string } = {}) => ({
  shareId,
  token: `${shareId}.secret`,
  host: extra.host ?? "boards.example.org",
  ...(extra.accountId === undefined ? {} : { accountId: extra.accountId }),
});
const isCloud = (candidate: { readonly host: string }) => candidate.host === "boards.example.org";

describe("boards a browser adds to the account", () => {
  it("offers its own cloud boards joined signed out, each once", () => {
    const shares = [
      share("made-here"),
      // Joined signed out on a board the account is on already: offered, so the two become one.
      share("account-is-on-it"),
      share("on-a-machine", { host: "tunnel.example.org" }),
      share("opened-by-account", { accountId: "user_ada" }),
      share("refused-before"),
    ];
    expect(
      boardsToClaim({ shares, tried: new Set(["refused-before"]), isCloud }).map(
        (candidate) => candidate.shareId,
      ),
    ).toEqual(["made-here", "account-is-on-it"]);
  });

  it("offers at most one claim's worth at a time", () => {
    const shares = Array.from({ length: CLOUD_BOARD_ACCOUNT_CLAIM_MAX + 3 }, (_, index) =>
      share(`share-${index}`),
    );
    expect(boardsToClaim({ shares, tried: new Set(), isCloud })).toHaveLength(
      CLOUD_BOARD_ACCOUNT_CLAIM_MAX,
    );
  });

  it("forgets only boards opened under an account that is no longer signed in", () => {
    const shares = [
      share("signed-out"),
      share("ada", { accountId: "user_ada" }),
      share("bo", { accountId: "user_bo" }),
    ];
    expect(sharesOfOtherAccounts(shares, "user_ada")).toEqual(["bo"]);
    expect(sharesOfOtherAccounts(shares, null)).toEqual(["ada", "bo"]);
  });
});

describe("the name a person joins a board under", () => {
  it.each([
    ["the full name", { fullName: "  Ada   Lovelace ", firstName: "Ada" }, "Ada Lovelace", true],
    [
      "first and last name over a saved one",
      { fullName: "", firstName: "Ada", lastName: "King", savedName: "Countess" },
      "Ada King",
      true,
    ],
    ["the first name alone", { firstName: "Ada", lastName: null }, "Ada", true],
    [
      "the name it saved over the username",
      { username: "ada_k", savedName: " Ada  K " },
      "Ada K",
      true,
    ],
    ["the username", { firstName: " ", username: "ada_k" }, "ada_k", false],
    // The email is not even read: a sign-up with only an email has no name until they give one.
    ["nothing from an email-only account", {}, null, false],
    [
      "a name cut to fit",
      { fullName: `${"A".repeat(GUEST_NAME_MAX_LENGTH)} B` },
      "A".repeat(GUEST_NAME_MAX_LENGTH),
      true,
    ],
  ] as const)("takes %s", (_case, profile, name, real) => {
    expect(accountDisplayName(profile)).toEqual({ name, real });
  });

  it.each([
    ["first and last parts", "priya.raman@x.com", "Priya Raman"],
    ["nothing after a plus", "sam+clerk_test@example.com", "Sam"],
    ["a part with digits kept", "j_doe99@x.com", "J Doe99"],
    ["a dash for a space", "ada-lovelace@x.com", "Ada Lovelace"],
    ["only digits: no guess", "1234@x.com", ""],
    ["no email: no guess", null, ""],
    [
      "a long one, cut to fit",
      `${"a".repeat(80)}@x.com`,
      `A${"a".repeat(GUEST_NAME_MAX_LENGTH - 1)}`,
    ],
  ] as const)("guesses a name from %s", (_case, email, name) => {
    expect(emailNameGuess(email)).toBe(name);
  });

  // A: an account that signed in here before; B: the one signing in now.
  it.each([
    ["seeds a name typed signed out on a browser nobody signed in on", null, [], "Bo", "Bo"],
    ["seeds it for the account that signed in here before", null, ["user_b"], "Bo", "Bo"],
    ["never seeds after another account signed in here", null, ["user_a"], "Bo", null],
    ["never seeds the last account's name on a switch", "user_a", ["user_a"], "QA One", null],
    ["has nothing to seed when nothing was typed", null, [], null, null],
  ] as const)("%s", (_case, current, accounts, name, seed) => {
    const { identity } = browserAfterSignIn({ name, accounts, current }, "user_b");
    expect(accountNameSeed(identity, "user_b")).toBe(seed);
  });

  // Every name field reads this, so a person is asked at most once and offered one suggestion.
  it.each([
    [
      "signed out with nothing typed: unknown, and the browser's one suggestion",
      { account: null, signedOutName: null },
      { known: null, suggested: "Calm Otter" },
    ],
    [
      "signed out after typing a name: known, never asked again",
      { account: null, signedOutName: " Bo " },
      { known: "Bo", suggested: "Bo" },
    ],
    [
      "signed in with a name: the account's, over whatever this browser kept",
      { account: { name: "Ada Lovelace", seed: "Bo" }, signedOutName: "Bo" },
      { known: "Ada Lovelace", suggested: "Ada Lovelace" },
    ],
    [
      "signed in with only an email: unknown, starting from what they typed signed out",
      { account: { name: null, seed: "Bo" }, signedOutName: "Bo" },
      { known: null, suggested: "Bo" },
    ],
    [
      "signed in with only an email on a browser someone else used: empty, never a made-up name",
      { account: { name: null, seed: null }, signedOutName: "QA One" },
      { known: null, suggested: "" },
    ],
  ] as const)("%s", (_case, input, resolved) => {
    expect(resolveBoardName({ ...input, suggestion: "Calm Otter" })).toEqual(resolved);
  });

  it("clears the last account's things on sign-out or a switch, and only then", () => {
    const signedOut = { name: "Bo", accounts: [], current: null };
    const signedIn = browserAfterSignIn(signedOut, "user_a");
    expect(signedIn).toEqual({
      identity: { name: "Bo", accounts: ["user_a"], current: "user_a" },
      clear: false,
    });
    expect(browserAfterSignIn(signedIn.identity, "user_a")).toEqual({
      identity: signedIn.identity,
      clear: false,
    });
    // Signing out takes the name typed before too: it was this account's from sign-in on.
    expect(browserAfterSignIn(signedIn.identity, null)).toEqual({
      identity: { name: null, accounts: ["user_a"], current: null },
      clear: true,
    });
    expect(browserAfterSignIn(signedIn.identity, "user_b")).toEqual({
      identity: { name: null, accounts: ["user_a", "user_b"], current: "user_b" },
      clear: true,
    });
  });

  it("tells apart only the people who share a name", () => {
    const people = [
      { id: "a", name: "QA One" },
      { id: "b", name: " qa one" },
      { id: "c", name: "Ada" },
    ];
    expect([...sharedNameIds(people)]).toEqual(["a", "b"]);
    expect(sharedNameIds([{ id: "c", name: "Ada" }]).size).toBe(0);
  });

  it("keeps a typed name on the account as first and last name", () => {
    expect(accountNameParts("  Mary  Ann Smith ")).toEqual({
      firstName: "Mary Ann",
      lastName: "Smith",
    });
    expect(accountNameParts("Ada")).toEqual({ firstName: "Ada", lastName: "" });
    expect(accountNameParts("   ")).toEqual({ firstName: "", lastName: "" });
  });

  it("suggests a friendly name that always fits", () => {
    expect(friendlyName(() => 0)).toBe("Bright Badger");
    for (let index = 0; index < 144; index += 1) {
      const name = friendlyName((count) => (index * 7) % count);
      expect(name.length).toBeLessThanOrEqual(GUEST_NAME_MAX_LENGTH);
      expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    }
  });
});

type TestStorage = Storage;

function storageStub(): TestStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

function browserWindow(): Window & typeof globalThis {
  return {
    localStorage: storageStub(),
    sessionStorage: storageStub(),
    location: new URL("https://app.tinkjam.com/"),
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as Window & typeof globalThis;
}

interface PendingResponse {
  readonly promise: Promise<Response>;
  readonly resolve: (response: Response) => void;
}

function pendingFetch() {
  const pending: Array<PendingResponse> = [];
  const fetchMock = vi.fn(() => {
    let resolve!: (response: Response) => void;
    const promise = new Promise<Response>((done) => {
      resolve = done;
    });
    pending.push({ promise, resolve });
    return promise;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, pending };
}

async function flushMicrotasks() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

const ACCOUNT = {
  userId: "user_ada",
  name: "Ada",
  realName: true,
  email: null,
  readToken: () => Promise.resolve("token-a"),
  saveName: () => Promise.resolve(true),
};

async function accountHarness() {
  vi.resetModules();
  vi.stubGlobal("window", browserWindow());
  // Signing in here must not ask the host for boards yet: each test chooses when reads start.
  vi.stubEnv("VITE_CLOUD_BOARDS_URL", "not a url");
  const account = await import("./boardAccount");
  const shares = await import("./guestShares");
  const { appAtomRegistry } = await import("../rpc/atomRegistry");
  account.syncBoardAccount(ACCOUNT);
  return {
    account,
    shares,
    accountBoards: () => appAtomRegistry.get(shares.accountBoardsAtom) ?? [],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("board account requests around sign-out", () => {
  const shareId = "1ecbf7b4-8fc3-46f8-8a5c-8a683e311029";
  const copyId = "0d7b78bb-dc2f-4d47-b34f-d9278cf8d872";

  it("does not keep a board opened for an account that signed out meanwhile", async () => {
    const { account, shares } = await accountHarness();
    vi.stubEnv("VITE_CLOUD_BOARDS_URL", "https://boards.example.test");
    const { fetchMock, pending } = pendingFetch();
    const opening = account.openAccountBoard(shareId);
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledOnce();

    account.syncBoardAccount(null);
    pending[0]!.resolve(
      Response.json({
        token: "opened-token",
        board: {
          shareId,
          threadId: `board-${shareId}`,
          title: "Account board",
          guestId: "guest-1",
          maker: false,
          addedAt: new Date(0).toISOString(),
        },
      }),
    );
    await opening;

    expect(shares.readGuestShares()).toEqual([]);
  });

  it("does not keep a copy made for an account that signed out meanwhile", async () => {
    const { account, shares } = await accountHarness();
    vi.stubEnv("VITE_CLOUD_BOARDS_URL", "https://boards.example.test");
    const { copyCloudBoard } = await import("./cloudBoards");
    const { fetchMock, pending } = pendingFetch();
    const copying = copyCloudBoard(
      {
        host: "boards.example.test",
        shareId,
        threadId: ThreadId.make(`board-${shareId}`),
        token: "source-token",
        title: "Source board",
        joinedAt: new Date(0).toISOString(),
        viewOnly: true,
      },
      "Source board",
    );
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledOnce();

    account.syncBoardAccount(null);
    pending[0]!.resolve(
      Response.json({
        token: "copy-token",
        shareId: copyId,
        threadId: `board-${copyId}`,
        credential: "copy-credential",
      }),
    );
    await copying;

    expect(shares.readGuestShares()).toEqual([]);
  });

  it("does not let an older list of account boards overwrite a newer one", async () => {
    const { account, accountBoards } = await accountHarness();
    vi.stubEnv("VITE_CLOUD_BOARDS_URL", "https://boards.example.test");
    const { fetchMock, pending } = pendingFetch();
    const first = account.refreshAccountBoards();
    const second = account.refreshAccountBoards();
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    pending[1]!.resolve(
      Response.json({
        boards: [
          {
            shareId,
            threadId: `board-${shareId}`,
            title: "Newer board",
            guestId: "guest-1",
            maker: true,
            addedAt: new Date(0).toISOString(),
          },
        ],
      }),
    );
    await second;
    expect(accountBoards().map((board) => board.shareId)).toEqual([shareId]);

    pending[0]!.resolve(Response.json({ boards: [] }));
    await first;
    expect(accountBoards().map((board) => board.shareId)).toEqual([shareId]);
  });

  it("signing out cancels a board that was about to reopen", () => {
    vi.useFakeTimers();
    return accountHarness().then(({ account, shares }) => {
      shares.reopenGuestShare({
        host: "boards.example.test",
        shareId,
        threadId: ThreadId.make(`board-${shareId}`),
        token: "account-token",
        title: "Account board",
        joinedAt: new Date(0).toISOString(),
        accountId: ACCOUNT.userId,
      });

      account.syncBoardAccount(null);
      vi.advanceTimersByTime(300);

      expect(shares.readGuestShares()).toEqual([]);
    });
  });

  it("keeps the newest session when a board is reopened twice", () => {
    vi.useFakeTimers();
    return accountHarness().then(({ shares }) => {
      const share = (token: string) => ({
        host: "boards.example.test",
        shareId,
        threadId: ThreadId.make(`board-${shareId}`),
        token,
        title: "Account board",
        joinedAt: new Date(0).toISOString(),
        accountId: ACCOUNT.userId,
      });
      shares.reopenGuestShare(share("older-token"));
      shares.reopenGuestShare(share("newer-token"));

      vi.advanceTimersByTime(300);

      expect(shares.findGuestShare(shareId)?.token).toBe("newer-token");
    });
  });
});
