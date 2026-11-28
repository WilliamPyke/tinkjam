import { describe, expect, it } from "vite-plus/test";

import { needsClerkAtStartup } from "./lazyClerk.logic";

const page = { cookie: "", pathname: "/", search: "", signedInHere: false };

describe("needsClerkAtStartup", () => {
  it.each([
    ["a first visit", page, false],
    ["an account noted on this browser", { ...page, signedInHere: true }, true],
    ["a signed-in client cookie", { ...page, cookie: "a=1; __client_uat=1732600000" }, true],
    ["a suffixed client cookie", { ...page, cookie: "__client_uat_Xy1=1732600000" }, true],
    [
      "a signed-out client cookie",
      { ...page, cookie: "__client_uat=0; __client_uat_Xy1=0" },
      false,
    ],
    ["a session cookie", { ...page, cookie: "__session=eyJ" }, true],
    ["only a development browser", { ...page, cookie: "__clerk_db_jwt=dvb_1" }, false],
    ["the sign-in page", { ...page, pathname: "/sign-in/sso-callback" }, true],
    ["a development hand-over", { ...page, search: "?__clerk_db_jwt=dvb_1" }, true],
    ["an invitation", { ...page, pathname: "/b/x", search: "?a=1&__clerk_ticket=t" }, true],
    ["another link", { ...page, search: "?share=abc" }, false],
  ])("%s", (_name, input, expected) => {
    expect(needsClerkAtStartup(input)).toBe(expected);
  });
});
