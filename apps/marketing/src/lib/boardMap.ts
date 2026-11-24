// A sample board's cards as boxes on a small map, from the same description the board is built from.

interface MapCard {
  readonly x: number;
  readonly y: number;
  readonly kind?: string;
  readonly section?: boolean;
  readonly color?: string;
  readonly size?: { readonly w: number; readonly h: number };
}

export interface MapBox {
  readonly kind: "section" | "note" | "card";
  readonly color: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// The board's own default sizes (ROOM_BOARD_NOTE_SIZE and friends in packages/shared).
const sizeOf = (card: MapCard) =>
  card.size ??
  (card.kind === "artifact"
    ? { w: 380, h: 400 }
    : card.kind === "thread"
      ? { w: 340, h: 460 }
      : { w: 192, h: 144 });

export function boardMap(cards: ReadonlyArray<MapCard>): {
  readonly viewBox: string;
  readonly boxes: ReadonlyArray<MapBox>;
} {
  const shown = cards.filter((card) => card.kind !== "comment");
  const left = Math.min(...shown.map((card) => card.x));
  const top = Math.min(...shown.map((card) => card.y));
  const right = Math.max(...shown.map((card) => card.x + sizeOf(card).w));
  const bottom = Math.max(...shown.map((card) => card.y + sizeOf(card).h));
  return {
    viewBox: `${left} ${top} ${right - left} ${bottom - top}`,
    boxes: shown.map((card) => ({
      kind: card.section
        ? "section"
        : card.kind === undefined || card.kind === "task"
          ? "note"
          : "card",
      color: card.color ?? (card.kind === "task" ? "grey" : "yellow"),
      x: card.x,
      y: card.y,
      ...sizeOf(card),
    })),
  };
}
