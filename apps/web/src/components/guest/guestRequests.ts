import { type GuestShareEndpoint, guestShareRequest } from "@t3tools/client-runtime/rpc";
import { GUEST_HANDOFF_ROUTE, GUEST_ROUTE_PREFIX, GuestHandoff } from "@t3tools/contracts";
import { buildJoinLink } from "@t3tools/shared/promptLinks";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { configuredHostedAppUrl } from "~/hostedPairing";

const decodeErrorBody = Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }));
export const decodeHandoff = Schema.decodeUnknownOption(GuestHandoff);
const UNREACHABLE = "Could not reach this board. Try again.";

/** The message a failed guest request carries, or `fallback`. */
async function failureOf(response: Response, fallback: string): Promise<string> {
  const json: unknown = await response.json().catch(() => null);
  return Option.match(decodeErrorBody(json), {
    onNone: () => fallback,
    onSome: ({ message }) => message,
  });
}

/** Posts to a guest route with no body. Resolves to its answer, or to a message for the guest. */
export async function postGuestAction<A>(
  endpoint: GuestShareEndpoint,
  route: string,
  decode: (json: unknown) => Option.Option<A>,
  failed: string,
): Promise<A | string> {
  try {
    const response = await guestShareRequest(endpoint, route, { init: { method: "POST" } });
    if (!response.ok) return await failureOf(response, failed);
    return Option.getOrElse(decode(await response.json().catch(() => null)), () => failed);
  } catch {
    return UNREACHABLE;
  }
}

/**
 * Sends the owner a message from this guest, which waits for them unless they let this guest's
 * messages through. Resolves to what went wrong, or null.
 */
export async function postGuestMessage(
  endpoint: GuestShareEndpoint,
  text: string,
  files: ReadonlyArray<File>,
  board: {
    /** The artifact card the reply should rewrite once the owner sends it. */
    readonly artifactId?: string | undefined;
    /** The thread box it was asked from, whose own conversation runs it. */
    readonly boxId?: string;
    /** The board cards that went with it, so the server names them for everyone. */
    readonly cardRefs?: ReadonlyArray<string>;
  } = {},
): Promise<string | null> {
  const form = new FormData();
  form.append("shareId", endpoint.shareId);
  form.append("text", text);
  if (board.artifactId !== undefined) form.append("artifactId", board.artifactId);
  if (board.boxId !== undefined) form.append("boxId", board.boxId);
  if (board.cardRefs !== undefined && board.cardRefs.length > 0) {
    form.append("cardRefs", JSON.stringify(board.cardRefs));
  }
  for (const file of files) form.append("file", file, file.name);
  return guestShareRequest(endpoint, `${GUEST_ROUTE_PREFIX}/messages`, {
    init: { method: "POST", body: form },
  }).then(
    (response) => (response.ok ? null : failureOf(response, "Could not send it. Try again.")),
    () => UNREACHABLE,
  );
}

/**
 * Opens the guest's own Tinkjam on a short-lived handoff token, with a task or artifact card as a
 * draft when given one. Call it in the click itself: a tab opened after a request counts as a
 * popup. Resolves to what went wrong, or null.
 */
export async function openOnMyMachine(
  endpoint: GuestShareEndpoint,
  host: string,
  card: Pick<Parameters<typeof buildJoinLink>[0], "task" | "artifact" | "board"> = {},
): Promise<string | null> {
  const tab = window.open("", "_blank");
  const handoff = await postGuestAction(
    endpoint,
    GUEST_HANDOFF_ROUTE,
    decodeHandoff,
    "Could not open this board on your computer. Try again.",
  );
  if (typeof handoff === "string") {
    tab?.close();
    return handoff;
  }
  const url = buildJoinLink({
    host,
    token: handoff.token,
    origin: configuredHostedAppUrl(),
    ...card,
  });
  if (tab === null) {
    window.location.href = url;
    return null;
  }
  tab.opener = null;
  tab.location.href = url;
  return null;
}
