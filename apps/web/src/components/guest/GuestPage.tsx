import { useAtomValue } from "@effect/atom-react";
import { guestShareRequest } from "@t3tools/client-runtime/rpc";
import {
  GUEST_HOST_PARAM,
  GUEST_ROUTE_PREFIX,
  GUEST_NAME_MAX_LENGTH,
  GUEST_SHARE_PARAM,
  GUEST_SIGN_IN_PARAM,
  GuestInvitePreview,
  GuestSignInFailure,
  isCloudBoardViewCredential,
} from "@t3tools/contracts";
import { Navigate } from "@tanstack/react-router";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { useEffect, useEffectEvent, useState, type FormEvent } from "react";

import {
  endedShareNoticesAtom,
  forgetGuestShare,
  guestLinkHost,
  guestShareEndpointOf,
  guestShareLocation,
  guestShareOrigin,
  guestSharesAtom,
  type JoinedGuestShare,
  rememberGuestShare,
} from "~/guest/guestShares";
import { boardAccountsEnabled, useBoardAccount } from "~/guest/boardAccount";
import { openViewLink, rememberBoardName, suggestedBoardName } from "~/guest/cloudBoards";
import { isCloudBoardsHost } from "~/guest/cloudBoardsHost";
import {
  ENDED_NOTICE,
  decodeRefusalBody,
  linkRefusalNotice,
  type RefusalNotice,
} from "~/guest/linkRefusal.logic";
import { redeemInvite } from "~/guest/redeemInvite";
import { AccountCorner } from "../boards/BoardsAccount";
import { useT3ConnectAuthPrompt } from "../clerk/useT3ConnectAuthPrompt";
import { BoardBackdrop } from "../room/BoardChrome";
import { TinkjamLoading } from "../TinkjamLoading";
import { TinkjamWordmark } from "../TinkjamLogo";
import { Button, InlineButton } from "../ui/button";
import { Input } from "../ui/input";
import { useAccountBoardOpen } from "./useAccountBoardOpen";
import { GoToTinkjam, GuestNotice, noteGuestSignInFailure } from "./GuestNotice";
import {
  guestEntryStep,
  guestLinkInvite,
  inviteJoinStep,
  type KeptInvite,
} from "./guestStream.logic";

interface GuestEntry {
  /** Unspent invite from the URL hash, if this load came from a link. */
  readonly credential: string | null;
  /** The owner's host the link names, or null when the link may not be followed. */
  readonly host: string | null;
  readonly shareId: string | null;
}

// The entry is read once per address: reading it rewrites the address, and a second read (as
// React's development double render makes) must not find the credential gone.
let captured: { readonly href: string; readonly entry: GuestEntry } | null = null;

const decodeSignInFailure = Schema.decodeUnknownOption(GuestSignInFailure);
const decodeInvitePreview = Schema.decodeUnknownOption(GuestInvitePreview);

// Per tab: the invite between reading its link and joining, so a reload of the address the link
// leaves, or a sign-in that leaves the page, finds it again. Never sent anywhere from here.
const PENDING_INVITE_KEY = "t3code:pending-invite:v1";
const PendingInvite = Schema.Struct({
  shareId: Schema.String,
  host: Schema.NullOr(Schema.String),
  credential: Schema.String,
});
const decodePendingInvite = Schema.decodeUnknownOption(Schema.fromJsonString(PendingInvite));

function keepInvite(invite: KeptInvite) {
  try {
    window.sessionStorage.setItem(PENDING_INVITE_KEY, JSON.stringify(invite));
  } catch {}
}

function forgetKeptInvite() {
  try {
    window.sessionStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}
}

function readKeptInvite(): KeptInvite | null {
  try {
    return Option.getOrNull(
      decodePendingInvite(window.sessionStorage.getItem(PENDING_INVITE_KEY) ?? ""),
    );
  } catch {
    return null;
  }
}

/**
 * The invite credential travels in the URL hash so it never reaches a server log. It is read
 * once and removed from the address and history, and kept for this tab until the person joins.
 * Opening the page never redeems it: only submitting a name does.
 */
function takeGuestEntry(): GuestEntry {
  if (captured === null || captured.href !== window.location.href) {
    // A malformed fragment is an invalid link, not a crash.
    let fromLink = "";
    try {
      fromLink = decodeURIComponent(window.location.hash.slice(1)).trim();
    } catch {}
    const query = new URLSearchParams(window.location.search);
    const requestedHost = query.get(GUEST_HOST_PARAM);
    const host = guestLinkHost(requestedHost);
    const { credential, shareId, keep } = guestLinkInvite({
      fromLink,
      shareId: query.get(GUEST_SHARE_PARAM),
      host: requestedHost,
      followed: host !== null,
      kept: readKeptInvite(),
    });
    if (keep !== null) keepInvite(keep);
    const signInFailure = Option.getOrNull(decodeSignInFailure(query.get(GUEST_SIGN_IN_PARAM)));
    if (shareId !== null && signInFailure !== null) noteGuestSignInFailure(shareId, signInFailure);
    // The share and its host stay in the URL, so a reload finds this browser's session for it.
    const kept = new URLSearchParams();
    if (requestedHost !== null) kept.set(GUEST_HOST_PARAM, requestedHost);
    if (shareId !== null) kept.set(GUEST_SHARE_PARAM, shareId);
    const view = query.get("view");
    if (view !== null) kept.set("view", view);
    window.history.replaceState(
      window.history.state,
      "",
      kept.size === 0 ? window.location.pathname : `${window.location.pathname}?${kept}`,
    );
    captured = {
      href: window.location.href,
      entry: { credential, host, shareId },
    };
  }
  return captured.entry;
}

const INVALID = (
  <GuestNotice {...ENDED_NOTICE}>
    <GoToTinkjam />
  </GuestNotice>
);
// The address a link leaves has no invite in it, so it opens nothing in another tab or device.
const NO_INVITE = (
  <GuestNotice
    title={ENDED_NOTICE.title}
    detail="Open the link you were sent. The address in the browser bar does not open the board by itself."
  >
    <GoToTinkjam />
  </GuestNotice>
);
const UNREACHABLE_DETAIL = "Could not reach Tinkjam. Check your connection and try again.";

/**
 * Where a guest link lands. It asks for the guest's name, joins the share on the owner's host,
 * and hands over to the app, where the thread opens beside any other thread shared with this
 * browser. A share this browser already joined opens straight away.
 */
export function GuestPage() {
  const [entry] = useState(takeGuestEntry);
  const { credential, host } = entry;
  const shares = useAtomValue(guestSharesAtom);
  const [joined, setJoined] = useState<JoinedGuestShare | null>(null);
  const step = guestEntryStep(shares, entry);
  const checking = joined === null && step.step === "check" ? step.share : null;
  const endedNotice = useAtomValue(endedShareNoticesAtom).get(entry.shareId ?? "") ?? null;
  // A plain address with no invite, on a browser with no session: the account may open it.
  const [accountAttempt, setAccountAttempt] = useState(0);
  const accountStep = useAccountBoardOpen({
    shareId: entry.shareId,
    hasSession: step.step !== "invalid",
    reopening: false,
    cloud: credential === null && (host === null || isCloudBoardsHost(host)),
    attempt: accountAttempt,
  });
  // Pasting another guest link into this tab changes only the hash, which does not reload the
  // page; reload so the new invite is read instead of the one already captured.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- hashchange listener reloads the page when another guest link is pasted into this tab
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash !== "") window.location.reload();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- asks the share's host whether this browser's stored session still works before reusing it
  useEffect(() => {
    if (checking === null) return;
    let stopped = false;
    void guestShareRequest(guestShareEndpointOf(checking), GUEST_SESSION_ROUTE).then(
      async (response) => {
        if (stopped) return;
        // Only a refusal joins again; anything else opens the board, which says what is wrong.
        if (SESSION_REFUSED.has(response.status)) {
          const body: unknown = await response.json().catch(() => null);
          if (!stopped) {
            forgetGuestShare(checking.shareId, Option.getOrNull(decodeRefusalBody(body))?.detail);
          }
        } else {
          forgetKeptInvite();
          setJoined(checking);
        }
      },
      () => {
        if (stopped) return;
        forgetKeptInvite();
        setJoined(checking);
      },
    );
    return () => {
      stopped = true;
    };
  }, [checking]);

  const open = joined ?? (step.step === "open" ? step.share : null);
  const onJoined = (share: JoinedGuestShare) => {
    forgetKeptInvite();
    rememberGuestShare(share);
    setJoined(share);
  };
  return (
    <BoardBackdrop className="relative flex h-dvh flex-col overflow-y-auto px-4 py-10 text-foreground">
      {open === null ? <AccountCorner /> : null}
      {open !== null ? (
        <>
          <Navigate {...guestShareLocation(open)} replace />
          {/* Until the board's page has loaded and takes over with a cover of its own. */}
          <TinkjamLoading cover label="Opening the board" />
        </>
      ) : checking !== null || (step.step === "invalid" && accountStep === "opening") ? (
        <TinkjamLoading cover label="Opening the board" />
      ) : step.step === "invalid" || host === null || credential === null ? (
        endedNotice === null ? (
          step.step === "invalid" && accountStep === "unreachable" ? (
            <GuestNotice title="This board could not be opened" detail={UNREACHABLE_DETAIL}>
              <Button type="button" onClick={() => setAccountAttempt((attempt) => attempt + 1)}>
                Try again
              </Button>
            </GuestNotice>
          ) : host !== null && credential === null ? (
            NO_INVITE
          ) : (
            INVALID
          )
        ) : (
          <GuestNotice {...endedNotice}>
            <GoToTinkjam />
          </GuestNotice>
        )
      ) : isCloudBoardViewCredential(credential) ? (
        <ViewStep credential={credential} host={host} onJoined={onJoined} />
      ) : (
        <JoinStep credential={credential} host={host} onJoined={onJoined} />
      )}
    </BoardBackdrop>
  );
}

const GUEST_SESSION_ROUTE = `${GUEST_ROUTE_PREFIX}/session`;
const SESSION_REFUSED = new Set([401, 403, 410]);

interface JoinProps {
  readonly credential: string;
  readonly host: string;
  readonly onJoined: (share: JoinedGuestShare) => void;
}

/**
 * Joins straight away under the account's name when it has one, and asks for a name otherwise
 * (see `inviteJoinStep`). Anyone already on the board comes back as the same person either way.
 */
function JoinStep(props: JoinProps) {
  const account = useBoardAccount();
  const [failed, setFailed] = useState<string | null>(null);
  const step = inviteJoinStep({
    cloud: isCloudBoardsHost(props.host),
    account,
    failed: failed !== null,
  });
  if (step.step === "join") {
    return <JoinAsAccount {...props} name={step.name} onFailed={setFailed} />;
  }
  if (step.step === "wait") return <TinkjamLoading cover label="Opening the board" />;
  return <NameForm {...props} error={failed} />;
}

function JoinAsAccount({
  credential,
  host,
  name,
  onJoined,
  onFailed,
}: JoinProps & { readonly name: string; readonly onFailed: (message: string) => void }) {
  const settle = useEffectEvent((joined: JoinedGuestShare | string) => {
    if (typeof joined === "string") onFailed(joined);
    else onJoined(joined);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- joins the board on its host once, as the signed-in account
  useEffect(() => {
    let stopped = false;
    void redeemInvite({ credential, host, name }).then((joined) => {
      if (!stopped) settle(joined);
    });
    return () => {
      stopped = true;
    };
  }, [credential, host, name]);
  return <TinkjamLoading cover label="Opening the board" />;
}

/** A view link opens the board at once: no name, no sign-in, and nobody's seat. */
function ViewStep({ credential, host, onJoined }: JoinProps) {
  const [failed, setFailed] = useState<
    { readonly message: string } | { readonly temporary: true } | null
  >(null);
  const settle = useEffectEvent(
    (opened: JoinedGuestShare | string | { readonly temporary: true }) => {
      if (typeof opened === "string") setFailed({ message: opened });
      else if ("temporary" in opened) setFailed(opened);
      else onJoined(opened);
    },
  );
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- opens the board on its host once for each attempt, from the view link
  useEffect(() => {
    if (failed !== null) return;
    let stopped = false;
    void openViewLink({ credential, host }).then((opened) => {
      if (!stopped) settle(opened);
    });
    return () => {
      stopped = true;
    };
  }, [credential, host, failed]);
  if (failed === null) return <TinkjamLoading cover label="Opening the board" />;
  if ("temporary" in failed) {
    return (
      <GuestNotice title="This board could not be opened" detail={UNREACHABLE_DETAIL}>
        <Button type="button" onClick={() => setFailed(null)}>
          Try again
        </Button>
      </GuestNotice>
    );
  }
  return <GuestNotice title="This board could not be opened" detail={failed.message} />;
}

function NameForm({
  credential,
  host,
  onJoined,
  error: initialError,
}: JoinProps & { readonly error: string | null }) {
  const [name, setName] = useState(suggestedBoardName);
  const cloud = isCloudBoardsHost(host);
  // Signed in with no name yet: what they type here becomes the account's name.
  const naming = useBoardAccount().status === "signed-in";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  // What the host says of the invite: why it refused it, or what it opens; null until it answers.
  const [told, setTold] = useState<GuestInvitePreview | RefusalNotice | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- asks the host whether the invite still opens anything, and what, before asking for a name
  useEffect(() => {
    let stopped = false;
    void fetch(`${guestShareOrigin(host)}${GUEST_ROUTE_PREFIX}/invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential }),
      credentials: "omit",
    })
      .then(
        // Only a plain refusal counts: an older host has no such route.
        async (response) => {
          if (SESSION_REFUSED.has(response.status)) {
            forgetKeptInvite();
            const body: unknown = await response.json().catch(() => null);
            return linkRefusalNotice(Option.getOrNull(decodeRefusalBody(body))?.detail);
          }
          // Only the cloud board host says what the invite opens; no other answer is read.
          const body: unknown =
            cloud && response.ok ? await response.json().catch(() => null) : null;
          return Option.getOrElse(decodeInvitePreview(body), () => ({}));
        },
        () => ({}),
      )
      .then((answer) => {
        if (!stopped) setTold(answer);
      });
    return () => {
      stopped = true;
    };
  }, [cloud, credential, host]);
  // A refusal is a notice of its own; only an invite that opens something shows the form.
  if (told !== null && "detail" in told) {
    return (
      <GuestNotice title={told.title} detail={told.detail}>
        <GoToTinkjam />
      </GuestNotice>
    );
  }
  // The cloud host answers at once; waiting for it shows the card whole, with nothing changing.
  if (cloud && told === null) return <TinkjamLoading cover label="Opening the invite" />;
  const invite = told ?? {};
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "" || submitting) return;
    setSubmitting(true);
    const joined = await redeemInvite({ credential, host, name: trimmed });
    setSubmitting(false);
    if (typeof joined === "string") {
      setError(joined);
      return;
    }
    // The board first: once this browser has it, nothing here can join it a second time.
    onJoined(joined);
    rememberBoardName(trimmed);
  };
  return (
    <form
      className="m-auto flex w-full max-w-md flex-col gap-5 rounded-dialog border bg-raised p-6 text-card-foreground shadow-board sm:p-8"
      onSubmit={submit}
    >
      <TinkjamWordmark />
      <div className="flex flex-col gap-2">
        <h1
          className="font-heading text-2xl leading-tight font-semibold tracking-brand wrap-break-word"
          data-guest-invite
        >
          {inviteHeading(invite)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {cloud ? (
            <>
              {invite.title !== undefined && invite.maker !== undefined
                ? `${invite.maker} made this board. `
                : null}
              Pick the name everyone on it will see.
              {naming ? " It becomes the name on your account." : null}
            </>
          ) : (
            <>
              Shared with you from <span className="font-medium text-foreground">{host}</span>
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          Tinkjam is a shared whiteboard. No account needed.
        </p>
      </div>
      <label className="flex flex-col gap-2 text-sm font-semibold" htmlFor="guest-name">
        Your name
        <Input
          id="guest-name"
          autoFocus
          autoComplete="name"
          maxLength={GUEST_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={submitting || name.trim() === ""} data-guest-join>
        Join the board
      </Button>
      {cloud && boardAccountsEnabled() ? <SignInInstead /> : null}
      {cloud ? null : (
        <p className="text-xs text-muted-foreground">
          The owner sees your name and approves each message before the agent gets it.
        </p>
      )}
    </form>
  );
}

/** Which board the invite is for, as far as its host said: its name, else whose it is. */
const inviteHeading = ({ title, maker }: GuestInvitePreview) =>
  title !== undefined
    ? `You're invited to "${title}"`
    : maker !== undefined
      ? `You're invited to ${maker}'s board`
      : "You're invited to a board";

/** Signs in first, to join under the account and find the board again on any device. */
function SignInInstead() {
  const account = useBoardAccount();
  const { openAuthPrompt } = useT3ConnectAuthPrompt();
  if (account.status !== "signed-out") return null;
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-1 text-center text-sm text-muted-foreground">
      <InlineButton
        tone="accent"
        touchTarget="padded"
        onClick={() => openAuthPrompt()}
        data-guest-sign-in
      >
        Sign in or create an account
      </InlineButton>
      to find this board on every device.
    </p>
  );
}
