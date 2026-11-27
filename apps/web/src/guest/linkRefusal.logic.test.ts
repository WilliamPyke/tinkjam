import { describe, expect, it } from "vite-plus/test";

import {
  ENDED_NOTICE,
  knownRefusalNotice,
  linkRefusalMessage,
  linkRefusalNotice,
  refusalDetailOf,
  refusalSentence,
} from "./linkRefusal.logic";

describe("linkRefusalNotice", () => {
  it("names each refusal the board host can tell apart", () => {
    expect(linkRefusalNotice("sharing_off")).toEqual({
      title: "Link sharing is off for this board",
      detail: "Ask whoever shared it to turn it on or add you.",
    });
    expect(linkRefusalNotice("view_only")).toEqual({
      title: "This board's link now only lets people look at it",
      detail: "Ask whoever shared it for the view link.",
    });
    expect(linkRefusalNotice("replaced")).toEqual({
      title: "This link does not open a board",
      detail: "Ask whoever shared it for a new one.",
    });
    // Losing access is not the board ending: it is still there for everyone else.
    expect(linkRefusalNotice("removed")).toEqual({
      title: "You no longer have access to this board",
      detail: "Ask someone on it to share it with you again.",
    });
    expect(linkRefusalNotice("removed_from_workspace")).toEqual({
      title: "You no longer have access to this board",
      detail: "You were removed from its workspace. Ask someone in it to add you back.",
    });
  });

  it("falls back to the notice that covers every refusal, named or not", () => {
    expect(linkRefusalNotice("ended")).toBe(ENDED_NOTICE);
    expect(linkRefusalNotice("from-a-newer-host")).toBe(ENDED_NOTICE);
    expect(linkRefusalNotice(undefined)).toBe(ENDED_NOTICE);
  });
});

describe("knownRefusalNotice", () => {
  it("names only the refusals this client has words for", () => {
    expect(knownRefusalNotice("removed_from_workspace")?.title).toBe(
      "You no longer have access to this board",
    );
    expect(knownRefusalNotice("ended")).toBe(ENDED_NOTICE);
    expect(knownRefusalNotice("from-a-newer-host")).toBeUndefined();
    expect(knownRefusalNotice(undefined)).toBeUndefined();
  });
});

describe("linkRefusalMessage", () => {
  it("prefers this client's words for a detail it knows", () => {
    expect(linkRefusalMessage({ detail: "sharing_off", message: "Whatever the host wrote." })).toBe(
      "Link sharing is off for this board. Ask whoever shared it to turn it on or add you.",
    );
    expect(linkRefusalMessage({ detail: "view_only" })).toBe(
      "This board's link now only lets people look at it. Ask whoever shared it for the view link.",
    );
    expect(linkRefusalMessage({ detail: "replaced" })).toBe(
      "This link does not open a board. Ask whoever shared it for a new one.",
    );
  });

  it("keeps a host's own message when it named no detail this client knows", () => {
    expect(linkRefusalMessage({ message: "This thread is shared with a team." })).toBe(
      "This thread is shared with a team.",
    );
    expect(linkRefusalMessage({ detail: "from-a-newer-host", message: "Said by the host." })).toBe(
      "Said by the host.",
    );
  });

  it("covers a refusal nobody said anything about", () => {
    expect(linkRefusalMessage(null)).toBe(refusalSentence(ENDED_NOTICE));
    expect(linkRefusalMessage({})).toBe(refusalSentence(ENDED_NOTICE));
  });
});

describe("refusalDetailOf", () => {
  it("reads the detail a host sent, and nothing else", () => {
    expect(refusalDetailOf({ reason: "invalid", message: "No.", detail: "view_only" })).toBe(
      "view_only",
    );
    expect(refusalDetailOf({ message: "No detail here." })).toBeUndefined();
    expect(refusalDetailOf(null)).toBeUndefined();
    expect(refusalDetailOf("<html>ended</html>")).toBeUndefined();
  });
});
