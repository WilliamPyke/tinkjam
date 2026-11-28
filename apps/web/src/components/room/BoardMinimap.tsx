import type { RoomBoard } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { type PointerEvent, type RefObject, memo, useEffect, useRef, useState } from "react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { observeResize } from "~/lib/observeResize";

import { MinimapAgentMarks } from "./BoardAgents";
import { BoardFloat } from "./BoardChrome";
import {
  type MinimapFrame,
  type MinimapItem,
  boardViewCentredOn,
  minimapFrame,
  minimapItems,
  minimapRect,
  minimapShift,
  minimapToBoard,
} from "./boardMinimap.logic";
import {
  type BoardPoint,
  type BoardSize,
  type BoardView,
  boardBounds,
  visibleBoardRect,
} from "./roomBoard.logic";
import { useBoardPointers } from "./roomBoardLive";

const MINIMAP_SIZE: BoardSize = { width: 168, height: 104 };
/** Below this window width the minimap starts hidden, until someone shows it. */
const MINIMAP_MIN_WINDOW_WIDTH = 900;

const MinimapChoice = Schema.NullOr(Schema.Boolean);

/** Whether this browser shows the minimap: its own choice, else only on a wide enough window. */
export function useBoardMinimap(): readonly [boolean, () => void] {
  const [choice, setChoice] = useLocalStorage("t3code.roomBoardMinimap", null, MinimapChoice);
  const [wide] = useState(
    () => typeof window === "undefined" || window.innerWidth >= MINIMAP_MIN_WINDOW_WIDTH,
  );
  const shown = choice ?? wide;
  return [shown, () => setChoice(!shown)];
}

const PAINTS = {
  yellow: "var(--color-paint-yellow)",
  green: "var(--color-paint-green)",
  blue: "var(--color-paint-blue)",
  pink: "var(--color-paint-pink)",
  purple: "var(--color-paint-purple)",
  grey: "var(--color-paint-grey)",
} as const;
const DEEP_PAINTS = {
  yellow: "var(--color-paint-yellow-deep)",
  green: "var(--color-paint-green-deep)",
  blue: "var(--color-paint-blue-deep)",
  pink: "var(--color-paint-pink-deep)",
  purple: "var(--color-paint-purple-deep)",
  grey: "var(--color-paint-grey-deep)",
} as const;

const minimapKey = (items: ReadonlyArray<MinimapItem>) =>
  items
    .map(
      (item) =>
        `${item.id}${item.tone}${item.color ?? ""}${item.x},${item.y},${item.width},${item.height}`,
    )
    .join("|");

/**
 * The cards, painted onto a canvas in `frame`, the frame of the cards alone. A pan that reaches
 * past them only shrinks and moves the canvas, so it never paints them again. Painted again when
 * the cards or the theme change.
 */
const MinimapCards = memo(
  function MinimapCards({
    items,
    frame,
  }: {
    readonly items: ReadonlyArray<MinimapItem>;
    readonly drawn: string;
    readonly frame: MinimapFrame;
  }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- paints the canvas, again when the theme on the page's root changes
    useEffect(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d") ?? null;
      if (canvas === null || context === null) return;
      const paint = () => {
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(MINIMAP_SIZE.width * ratio);
        canvas.height = Math.round(MINIMAP_SIZE.height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        // A canvas takes no CSS variables: each colour is read back through the canvas's style.
        const colors = new Map<string, string>();
        const color = (token: string) => {
          let resolved = colors.get(token);
          if (resolved === undefined) {
            canvas.style.color = token;
            resolved = getComputedStyle(canvas).color;
            colors.set(token, resolved);
          }
          return resolved;
        };
        for (const item of items) {
          const rect = minimapRect(frame, item);
          context.globalAlpha =
            item.tone !== "section" ? 1 : (item.color ?? "grey") === "grey" ? 0.08 : 0.2;
          context.fillStyle = color(
            item.tone === "paint"
              ? PAINTS[item.color ?? "yellow"]
              : item.tone === "section"
                ? DEEP_PAINTS[item.color ?? "grey"]
                : "var(--color-card)",
          );
          context.fillRect(rect.x, rect.y, rect.width, rect.height);
          if (item.tone === "window") {
            context.strokeStyle = color("var(--color-board-hairline)");
            context.lineWidth = 1;
            context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
          }
        }
      };
      paint();
      const themed = new MutationObserver(paint);
      themed.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme-id"],
      });
      return () => themed.disconnect();
    }, [items, frame]);
    return (
      <canvas
        ref={canvasRef}
        aria-hidden
        className="block"
        style={{ width: MINIMAP_SIZE.width, height: MINIMAP_SIZE.height }}
      />
    );
  },
  (before, after) => before.drawn === after.drawn,
);

/**
 * Everyone else's pointers as dots in their colour. Reads the live store itself, so a pointer
 * moving renders only these few circles; `scale` keeps them the same size at any zoom.
 */
function MinimapPointers({ scale }: { readonly scale: number }) {
  const pointers = useBoardPointers();
  return pointers.map((pointer) => (
    <circle
      key={pointer.key}
      cx={pointer.x}
      cy={pointer.y}
      r={3 / scale}
      fill={pointer.color}
      stroke="var(--color-card)"
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  ));
}

/**
 * A small map of the whole board in the corner: every card as a plain rect and the part in view
 * as an outline. Pressing it moves the view there, and dragging pans it.
 */
export function BoardMinimap({
  board,
  cardIds,
  view,
  surfaceRef,
  onView,
}: {
  readonly board: Pick<RoomBoard, "positions" | "sizes" | "notes">;
  /** The board's fixed cards: the room thread's, each person's and each agent's. */
  readonly cardIds: ReadonlyArray<string>;
  readonly view: BoardView;
  readonly surfaceRef: RefObject<HTMLElement | null>;
  readonly onView: (view: BoardView) => void;
}) {
  const [area, setArea] = useState<BoardSize | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- follows the board surface's size, which the view rect is drawn from
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null) return;
    const measure = () => setArea({ width: surface.clientWidth, height: surface.clientHeight });
    measure();
    return observeResize(surface, measure);
  }, [surfaceRef]);

  const items = minimapItems(board, cardIds);
  const drawn = minimapKey(items);
  const content = boardBounds(items);
  // While a drag pans the view, the map holds still under the pointer.
  const [held, setHeld] = useState<{
    readonly frame: MinimapFrame;
    readonly grab: BoardPoint;
  } | null>(null);
  if (area === null || area.width === 0) return null;
  const viewport = visibleBoardRect(view, area);
  const frame = held?.frame ?? minimapFrame(content, viewport, MINIMAP_SIZE);
  const drawnFrame = content === null ? frame : minimapFrame(content, content, MINIMAP_SIZE);
  const shift = minimapShift(drawnFrame, frame);
  const viewRect = minimapRect(frame, viewport);
  const worldTransform = `translate(${frame.offset.x} ${frame.offset.y}) scale(${frame.scale}) translate(${-frame.world.x} ${-frame.world.y})`;

  const boardPointOf = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return minimapToBoard(frame, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  };
  const centreOn = (point: BoardPoint, grab: BoardPoint) =>
    onView(boardViewCentredOn(view, area, { x: point.x - grab.x, y: point.y - grab.y }));

  return (
    <BoardFloat className="relative overflow-hidden p-0">
      <div
        className="pointer-events-none absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${shift.x}px, ${shift.y}px) scale(${shift.scale})` }}
      >
        <MinimapCards items={items} drawn={drawn} frame={drawnFrame} />
      </div>
      <svg
        aria-label="Minimap. Press or drag to move the view."
        role="img"
        width={MINIMAP_SIZE.width}
        height={MINIMAP_SIZE.height}
        className="relative block cursor-pointer touch-none"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = boardPointOf(event);
          const middle = {
            x: viewport.x + viewport.width / 2,
            y: viewport.y + viewport.height / 2,
          };
          const inside =
            point.x >= viewport.x &&
            point.x <= viewport.x + viewport.width &&
            point.y >= viewport.y &&
            point.y <= viewport.y + viewport.height;
          // Grabbing the view's rect drags it from where it was taken; anywhere else centres it.
          const grab = inside ? { x: point.x - middle.x, y: point.y - middle.y } : { x: 0, y: 0 };
          setHeld({ frame, grab });
          if (!inside) centreOn(point, grab);
        }}
        onPointerMove={(event) => {
          if (held === null) return;
          centreOn(boardPointOf(event), held.grab);
        }}
        onPointerUp={() => setHeld(null)}
        onPointerCancel={() => setHeld(null)}
      >
        <g transform={worldTransform}>
          <MinimapAgentMarks items={items} drawn={drawn} />
        </g>
        <rect
          x={viewRect.x}
          y={viewRect.y}
          width={viewRect.width}
          height={viewRect.height}
          rx={4}
          fill="var(--color-primary)"
          fillOpacity={0.06}
          stroke="var(--color-primary)"
          strokeWidth={1.5}
        />
        <g transform={worldTransform}>
          <MinimapPointers scale={frame.scale} />
        </g>
      </svg>
    </BoardFloat>
  );
}
