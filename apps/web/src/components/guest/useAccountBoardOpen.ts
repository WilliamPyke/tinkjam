import { useEffect, useState } from "react";

import { openAccountBoard, useBoardAccount } from "~/guest/boardAccount";

import { guestBoardOpenStep } from "./guestStream.logic";

/**
 * What a board's plain address shows on a browser with no session for it, opening a cloud board
 * as the signed-in account's own seat or workspace access when it can. A board it opens joins this
 * browser's boards, which shows it.
 */
export function useAccountBoardOpen(input: {
  readonly shareId: string | null;
  readonly hasSession: boolean;
  readonly reopening: boolean;
  readonly cloud: boolean;
  readonly attempt?: number;
}): "board" | "opening" | "invalid" | "unreachable" {
  const account = useBoardAccount();
  const [refused, setRefused] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState<{
    readonly shareId: string;
    readonly attempt: number;
  } | null>(null);
  const attempt = input.attempt ?? 0;
  const step = guestBoardOpenStep({
    hasSession: input.hasSession,
    reopening: input.reopening,
    cloud: input.cloud && input.shareId !== null,
    account: account.status,
    accountRefused: refused !== null && refused === input.shareId,
    accountUnreachable: unreachable?.shareId === input.shareId && unreachable.attempt === attempt,
  });
  const { shareId } = input;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- asks the board host to open the board as the account, which the host decides
  useEffect(() => {
    if (step !== "account" || shareId === null) return;
    let stopped = false;
    void openAccountBoard(shareId, { temporary: "tagged" }).then((opened) => {
      if (stopped) return;
      if (typeof opened === "string") setRefused(shareId);
      else if ("temporary" in opened) setUnreachable({ shareId, attempt });
    });
    return () => {
      stopped = true;
    };
  }, [step, shareId, attempt]);
  return step === "account" ? "opening" : step;
}
