import { createMemoryHistory } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { ThreadId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
// The route loads ChatView lazily, and its first transform (React Compiler over ~4k lines)
// takes 6-11s; importing it here keeps that out of the test's timeout.
import "~/components/ChatView";
import { DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { getRouter } from "~/router";
import {
  ENVIRONMENT_ID,
  PROJECT_ID,
  installFakeEnvironment,
  type FakeDriver,
} from "../../test/fakeEnvironment";
import { render } from "../../test/render";

// The socket is the only fake layer; see test/appScenarios.renders.tsx.
vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (importOriginal) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});

vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

const hostedStatic = vi.hoisted(() => ({ value: false }));
vi.mock(import("~/hostedPairing"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    isHostedStaticApp: (url?: URL) => hostedStatic.value || actual.isHostedStaticApp(url),
  };
});

function setup() {
  hostedStatic.value = false;
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  });
  return installFakeEnvironment([]);
}

async function mountApp(path: string) {
  const router = getRouter(createMemoryHistory({ initialEntries: [path] }));
  await router.load();
  return render(<AppRoot router={router} />, {
    // AppRoot brings its own router.
    router: false,
  });
}

it("a new draft does not load its reserved thread before the server lists it", async () => {
  using _setup = setup();
  using fetchSpy = vi.spyOn(globalThis, "fetch");
  const draftId = DraftId.make("draft-27443");
  const threadId = ThreadId.make("thread-27443");
  useComposerDraftStore
    .getState()
    .setProjectDraftThreadId(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID), draftId, { threadId });

  await using _app = await mountApp(`/draft/${draftId}`);
  await expect.element(page.getByTestId("composer-editor")).toBeVisible();
  // The shell snapshot has arrived once the sidebar lists the project, so the connection is up.
  await expect.element(page.getByText("render", { exact: true }).first()).toBeVisible();

  const threadRequests = fetchSpy.mock.calls
    .map(([input]) => String(input instanceof Request ? input.url : input))
    .filter((url) => url.includes(`/api/orchestration/threads/${threadId}/`));
  // A 404 here marks the thread deleted, and the view never loads it once the send creates it.
  expect(threadRequests).toEqual([]);
});

it("unknown shell addresses say they do not exist", async () => {
  using _setup = setup();
  await page.viewport(1400, 900);

  for (const hosted of [false, true]) {
    hostedStatic.value = hosted;
    for (const path of ["/nowhere", "/some/unknown/path"]) {
      await using _app = await mountApp(path);
      await expect.element(page.getByText("This page does not exist.")).toBeVisible();
    }
  }
});

it("a board address keeps its own message", async () => {
  using _setup = setup();
  await page.viewport(1400, 900);
  await using _app = await mountApp("/b/share-1");

  await expect
    .element(page.getByText("This board has ended, or the link is not valid"))
    .toBeVisible();
});
