import { guestEnvironmentId } from "@t3tools/client-runtime/environment";
import { CLOUD_BOARD_TITLE_MAX_LENGTH } from "@t3tools/contracts";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  EllipsisIcon,
  FolderInputIcon,
  FolderOutputIcon,
  LogOutIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import {
  isAccountBoard,
  leaveAccountBoard,
  openAccountBoard,
  refreshAccountBoards,
} from "~/guest/boardAccount";
import { deleteCloudBoard, removeFromCloudBoard, renameCloudBoard } from "~/guest/cloudBoards";
import {
  findGuestShare,
  forgetGuestShare,
  noteAccountBoardTitle,
  rememberGuestShare,
} from "~/guest/guestShares";
import { moveBoardOutOfWorkspace, moveBoardToWorkspace, useWorkspaces } from "~/guest/workspaces";
import { ensureLocalApi } from "~/localApi";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { toastManager } from "../ui/toast";

interface JoinedBoardRef {
  readonly shareId: string;
  readonly title: string;
  readonly cloud: boolean;
  /** This person made the cloud board, so they delete it rather than leave it. */
  readonly maker?: boolean;
  /** The workspace it is in: its members leave the workspace, not the board. */
  readonly workspaceId?: string | null;
}

/**
 * Forgets a joined board on this browser and, when it is the open board, goes home, saying so
 * when `toast` is given.
 */
export function useForgetJoinedBoard() {
  const navigate = useNavigate();
  const openEnvironmentId = useParams({
    strict: false,
    select: (params) => params.environmentId ?? null,
  });
  return (shareId: string, toast?: string) => {
    forgetGuestShare(shareId);
    if (openEnvironmentId === guestEnvironmentId(shareId)) void navigate({ to: "/" });
    if (toast !== undefined) toastManager.add({ type: "success", title: toast });
  };
}

/**
 * Takes a joined board off this browser's boards. A cloud board is left too, freeing the seat,
 * when its host can be reached; it is forgotten here either way. Nobody else loses it.
 */
function useRemoveJoinedBoard() {
  const forget = useForgetJoinedBoard();
  return async (board: JoinedBoardRef) => {
    const confirmed = await ensureLocalApi().dialogs.confirm(
      [
        board.cloud ? `Leave "${board.title}"?` : `Remove "${board.title}" from your boards?`,
        board.cloud
          ? "You leave the board. Everyone else on it keeps it, and the invite link brings you back."
          : "It goes from this browser only. Everyone else on it keeps it. To come back, you need a new link from the owner.",
      ].join("\n"),
      { variant: "destructive", confirmLabel: board.cloud ? "Leave board" : "Remove board" },
    );
    if (!confirmed) return;
    const share = findGuestShare(board.shareId);
    if (board.cloud && isAccountBoard(board.shareId)) {
      // The account leaves it, so it goes from every device it signs in on.
      const failed = await leaveAccountBoard(board.shareId);
      if (failed !== null) toastManager.add({ type: "error", title: failed });
      else forget(board.shareId);
      return;
    }
    if (board.cloud && share?.guestId !== undefined) {
      await removeFromCloudBoard(share, share.guestId);
    }
    forget(board.shareId);
  };
}

/** Deletes a cloud board for everyone, opening it here first when only the account lists it. */
export function useDeleteCloudBoard() {
  const forget = useForgetJoinedBoard();
  return async (board: Pick<JoinedBoardRef, "shareId" | "title">) => {
    const confirmed = await ensureLocalApi().dialogs.confirm(
      [
        `Delete "${board.title}"?`,
        "It is deleted for everyone on it, with everything on it. This cannot be undone.",
      ].join("\n"),
      { variant: "destructive", confirmLabel: "Delete board" },
    );
    if (!confirmed) return;
    const share = findGuestShare(board.shareId) ?? (await openAccountBoard(board.shareId));
    const failed = typeof share === "string" ? share : await deleteCloudBoard(share);
    if (failed === null) forget(board.shareId, "Board deleted");
    else
      toastManager.add({ type: "error", title: "Could not delete the board", description: failed });
  };
}

/** Names a cloud board anew for everyone on it, opening it here first when only the account lists it. */
function RenameJoinedBoardDialog({
  board,
  onClose,
}: {
  readonly board: JoinedBoardRef;
  readonly onClose: () => void;
}) {
  const [name, setName] = useState(board.title);
  const [pending, setPending] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = name.trim();
    if (next === "" || next === board.title || pending) return;
    setPending(true);
    const share = findGuestShare(board.shareId) ?? (await openAccountBoard(board.shareId));
    const failed = typeof share === "string" ? share : await renameCloudBoard(share, next);
    setPending(false);
    if (failed !== null) {
      toastManager.add({ type: "error", title: "Could not rename the board", description: failed });
      return;
    }
    if (typeof share !== "string") {
      // What the boards list shows until the account's list comes back.
      rememberGuestShare({ ...share, title: next });
    }
    noteAccountBoardTitle(board.shareId, next);
    void refreshAccountBoards();
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-sm" bottomStickOnMobile={false}>
        <form className="flex min-h-0 flex-col" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Rename board</DialogTitle>
            <DialogDescription>Everyone on the board sees the new name.</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Name
              <Input
                autoFocus
                maxLength={CLOUD_BOARD_TITLE_MAX_LENGTH}
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                onFocus={(event) => event.currentTarget.select()}
                data-rename-board-name
              />
            </label>
          </DialogPanel>
          <DialogFooter variant="bare">
            <Button
              type="submit"
              disabled={pending || name.trim() === "" || name.trim() === board.title}
            >
              Rename board
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}

/**
 * The menu on a joined board's card: its maker deletes a cloud board, anyone else leaves it, and
 * a board on someone's machine goes from this browser.
 */
export function JoinedBoardMenu({
  board,
  size = "icon-xs",
  variant = "outline",
}: {
  readonly board: JoinedBoardRef;
  readonly size?: "icon-xs" | "icon-micro";
  readonly variant?: "outline" | "ghost-muted";
}) {
  const remove = useRemoveJoinedBoard();
  const deleteBoard = useDeleteCloudBoard();
  const [renaming, setRenaming] = useState(false);
  const workspaces = useWorkspaces() ?? [];
  const workspaceId = board.workspaceId ?? null;
  const inWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  // Its maker moves a cloud board between workspaces; an owner of its workspace takes it out.
  const moveTargets =
    board.cloud && board.maker === true
      ? workspaces.filter((workspace) => workspace.id !== workspaceId)
      : [];
  const canMoveOut =
    workspaceId !== null && (board.maker === true || inWorkspace?.role === "owner");
  // Anyone editing a cloud board may name it; a board on someone's machine has no name here.
  const canRename = board.cloud;
  const canDelete = board.cloud && board.maker === true;
  const canLeave = !canDelete && workspaceId === null;
  if (!canRename && moveTargets.length === 0 && !canMoveOut && !canDelete && !canLeave) return null;
  const moved = (failed: string | null, where: string) =>
    failed === null
      ? toastManager.add({ type: "success", title: `Moved to ${where}` })
      : toastManager.add({ type: "error", title: "Could not move the board", description: failed });
  return (
    <>
      <Menu>
        <MenuTrigger
          render={<Button size={size} variant={variant} aria-label={`More for ${board.title}`} />}
          data-joined-board-menu
        >
          <EllipsisIcon />
        </MenuTrigger>
        <MenuPopup align="end">
          {canRename ? (
            <MenuItem onClick={() => setRenaming(true)} data-rename-board>
              <PencilIcon />
              Rename board
            </MenuItem>
          ) : null}
          {moveTargets.length > 0 ? (
            <MenuSub>
              <MenuSubTrigger>
                <FolderInputIcon />
                Move to workspace
              </MenuSubTrigger>
              <MenuSubPopup>
                {moveTargets.map((workspace) => (
                  <MenuItem
                    key={workspace.id}
                    onClick={() =>
                      void moveBoardToWorkspace(board.shareId, workspace.id).then((failed) =>
                        moved(failed, workspace.name),
                      )
                    }
                  >
                    <span className="min-w-0 truncate">{workspace.name}</span>
                  </MenuItem>
                ))}
              </MenuSubPopup>
            </MenuSub>
          ) : null}
          {canMoveOut && workspaceId !== null ? (
            <MenuItem
              onClick={() =>
                void moveBoardOutOfWorkspace(board.shareId, workspaceId).then((failed) =>
                  moved(failed, board.maker === true ? "My boards" : "its maker's boards"),
                )
              }
              data-move-out-of-workspace
            >
              <FolderOutputIcon />
              {`Move out of ${inWorkspace?.name ?? "workspace"}`}
            </MenuItem>
          ) : null}
          {(canRename || moveTargets.length > 0 || canMoveOut) && (canDelete || canLeave) ? (
            <MenuSeparator />
          ) : null}
          {canDelete ? (
            <MenuItem
              variant="destructive"
              onClick={() => void deleteBoard(board)}
              data-delete-cloud-board
            >
              <Trash2Icon />
              Delete board
            </MenuItem>
          ) : canLeave ? (
            <MenuItem
              variant="destructive"
              onClick={() => void remove(board)}
              data-remove-joined-board
            >
              <LogOutIcon />
              {board.cloud ? "Leave board" : "Remove from my boards"}
            </MenuItem>
          ) : null}
        </MenuPopup>
      </Menu>
      {renaming ? (
        <RenameJoinedBoardDialog board={board} onClose={() => setRenaming(false)} />
      ) : null}
    </>
  );
}
