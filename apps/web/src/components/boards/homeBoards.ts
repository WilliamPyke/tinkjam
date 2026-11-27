import { useAtomValue } from "@effect/atom-react";
import { isGuestEnvironment, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { sharedThreadLocationOf } from "~/guest/boardAddress";
import {
  accountBoardsAtom,
  guestShareLocation,
  guestSharesAtom,
  isCloudShare,
  localBoardPreviewsAtom,
} from "~/guest/guestShares";
import { openListedBoard, useWorkspaces } from "~/guest/workspaces";
import { useProjects, useThreadShells } from "~/state/entities";
import { useTeams } from "~/teams/teams";

import { roomBoardLocation } from "../room/roomBoardNavigation";
import { type HomeBoard, joinedBoardSources, withWorkspaceBoards } from "./boardsHome.logic";

/** What `listHomeBoards` reads: the person's own, joined, cloud, workspace and team boards. */
export function useHomeBoardSources() {
  const threads = useThreadShells();
  const projects = useProjects();
  const joined = useAtomValue(guestSharesAtom);
  const accountBoards = useAtomValue(accountBoardsAtom);
  const localPreviews = useAtomValue(localBoardPreviewsAtom);
  const workspaces = useWorkspaces();
  const { teams } = useTeams();
  return {
    threads,
    joined: withWorkspaceBoards(
      joinedBoardSources({
        // A board only looked at from a view link is not one of theirs: it is under Viewed.
        local: joined
          .filter((share) => share.viewOnly !== true)
          .map((share) => ({
            ...share,
            cloud: isCloudShare(share),
            maker: share.made === true,
            preview: localPreviews[share.shareId],
          })),
        listed: accountBoards,
      }),
      workspaces,
    ),
    teams: teams ?? [],
    isOwnEnvironment: (environmentId: string) => !isGuestEnvironment(environmentId),
    projectName: (environmentId: string, projectId: string) =>
      projects.find(
        (project) => project.environmentId === environmentId && project.id === projectId,
      )?.title,
  };
}

/** Where a board on the home opens. */
export function homeBoardLocation(board: HomeBoard) {
  switch (board.kind) {
    case "own":
      return roomBoardLocation(
        scopeThreadRef(EnvironmentId.make(board.environmentId), ThreadId.make(board.threadId)),
      );
    case "joined":
      return sharedThreadLocationOf(board, board.cloud);
    case "team":
      return { to: "/teams/$teamId" as const, params: { teamId: board.teamId } };
  }
}

/**
 * Where to go to open a board, or what went wrong. A board only the account lists gets a session
 * here first, as the same person on it.
 */
export async function openHomeBoard(board: HomeBoard) {
  if (board.kind !== "joined" || !board.remote) return homeBoardLocation(board);
  const opened = await openListedBoard(board);
  return typeof opened === "string" ? opened : guestShareLocation(opened);
}
