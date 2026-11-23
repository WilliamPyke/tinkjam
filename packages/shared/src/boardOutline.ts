import {
  ROOM_BOARD_OUTLINE_MAX_PER_KIND,
  ROOM_BOARD_OUTLINE_NAME_MAX_LENGTH,
  ROOM_BOARD_ROOM_BOX,
  type RoomBoard,
  type RoomBoardNote,
  type RoomBoardOutline,
  type RoomBoardOutlineItem,
} from "@t3tools/contracts";

const UNNAMED: Readonly<Record<RoomBoardOutlineItem["kind"], string>> = {
  artifact: "Untitled artifact",
  thread: "Untitled agent",
  section: "Untitled section",
};

/** The first line that says anything, cut to what an outline carries. */
function nameOf(text: string, kind: RoomBoardOutlineItem["kind"]): string {
  const line =
    text
      .split("\n")
      .map((part) => part.replace(/\s+/g, " ").trim())
      .find((part) => part !== "") ?? UNNAMED[kind];
  return line.length <= ROOM_BOARD_OUTLINE_NAME_MAX_LENGTH
    ? line
    : // A cut never leaves half an emoji behind.
      `${line.slice(0, ROOM_BOARD_OUTLINE_NAME_MAX_LENGTH - 1).replace(/[\uD800-\uDBFF]$/, "")}…`;
}

const kindOf = (note: RoomBoardNote): RoomBoardOutlineItem["kind"] | null =>
  note.section === true
    ? "section"
    : note.kind === "artifact" || note.kind === "thread"
      ? note.kind
      : null;

/**
 * A board's artifacts, thread boxes, then sections, each in the order added; notes are left out.
 * `roomThread` titles the room thread's own box, null on a board without one (a cloud board).
 * A live view is named after what it shows. A summary sent over the wire keeps `perKind`'s default.
 */
export function boardOutline(
  board: RoomBoard | undefined,
  roomThread: string | null,
  perKind: number = ROOM_BOARD_OUTLINE_MAX_PER_KIND,
): RoomBoardOutline {
  const notes = board?.notes ?? [];
  const byId = new Map(notes.map((note) => [note.id, note]));
  const of = (kind: RoomBoardOutlineItem["kind"]) =>
    notes
      .filter((note) => kindOf(note) === kind)
      .map((note): RoomBoardOutlineItem => {
        const source = note.viewOf === undefined ? undefined : byId.get(note.viewOf);
        return { id: note.id, kind, name: nameOf(note.text || (source?.text ?? ""), kind) };
      });
  const threads: ReadonlyArray<RoomBoardOutlineItem> = [
    ...(roomThread === null
      ? []
      : [{ id: ROOM_BOARD_ROOM_BOX, kind: "thread" as const, name: nameOf(roomThread, "thread") }]),
    ...of("thread"),
  ];
  return {
    items: [of("artifact"), threads, of("section")].flatMap((group) => group.slice(0, perKind)),
  };
}
