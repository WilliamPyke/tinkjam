import {
  boardBounds,
  fitBoardOnSurface,
  type BoardRect,
  type BoardSize,
  type BoardView,
} from "./roomBoard.logic";

/** Below this a board's text is too small to read, so a board never opens smaller. */
export const BOARD_FIRST_VIEW_MIN_ZOOM = 0.7;
/** How near a board too big to read whole opens on its start: readable, with what is around it. */
const BOARD_FIRST_VIEW_ZOOM = 0.75;
const NARROW_WIDTH = 640;
const CHROME_GAP = 12;
// The "Showing where to start" hint sits under the header's end; the start opens clear of it.
const HINT_ROOM = 40;

/**
 * The board's first view: the whole board when readable, and always on a phone; otherwise its
 * start (or first card) at about 75%, clear of the board's edges and chrome. `whole` says which.
 */
export function firstBoardView(input: {
  readonly rects: ReadonlyArray<BoardRect>;
  readonly start: BoardRect | null;
  readonly area: BoardSize;
  /** The chrome floating over the board's top and bottom, in screen pixels. */
  readonly covered: { readonly top: number; readonly bottom: number };
  readonly margin: number;
  /** A board just made from a template opens whole, even when that is smaller than reading size. */
  readonly forceFit?: boolean;
}): { readonly view: BoardView; readonly whole: boolean } {
  const { rects, area, covered, margin } = input;
  const fit = fitBoardOnSurface(rects, area, covered, margin);
  const bounds = boardBounds(rects);
  if (
    bounds === null ||
    area.width < NARROW_WIDTH ||
    input.forceFit === true ||
    fit.zoom >= BOARD_FIRST_VIEW_MIN_ZOOM
  ) {
    return { view: fit, whole: true };
  }
  const target =
    input.start ??
    rects.reduce((first, rect) =>
      rect.y < first.y || (rect.y === first.y && rect.x < first.x) ? rect : first,
    );
  const side = margin;
  const top = Math.max(side, covered.top + CHROME_GAP + HINT_ROOM);
  const room = {
    width: Math.max(1, area.width - side * 2),
    height: Math.max(1, area.height - top - Math.max(side, covered.bottom + CHROME_GAP)),
  };
  const zoom = Math.max(
    BOARD_FIRST_VIEW_MIN_ZOOM,
    Math.min(
      BOARD_FIRST_VIEW_ZOOM,
      room.width / Math.max(1, target.width),
      room.height / Math.max(1, target.height),
    ),
  );
  // Centred on the start; one wider or taller than the screen shows from its own start.
  const place = (start: number, length: number, space: number, before: number, edge: number) => {
    const centred =
      length * zoom > space
        ? before - start * zoom
        : before + (space - length * zoom) / 2 - start * zoom;
    // Never past the board's first card: the screen shows the board there, not empty space.
    return Math.round(Math.min(centred, before - edge * zoom));
  };
  return {
    view: {
      zoom,
      x: place(target.x, target.width, room.width, side, bounds.x),
      y: place(target.y, target.height, room.height, top, bounds.y),
    },
    whole: false,
  };
}
