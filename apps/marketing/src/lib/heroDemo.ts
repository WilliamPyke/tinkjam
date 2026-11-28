// The hero's one interaction: draw a line from Priya's note to Sam's Codex and watch the board
// play out. Sam still presses Send, as on a real board.

type Point = { x: number; y: number };

class Stopped extends Error {}

/** False when the board's parts are missing and there is nothing to draw. */
export function startHeroDemo(board: HTMLElement, onDone: () => void): boolean {
  const find = <T extends Element>(selector: string) => board.querySelector<T>(selector);
  const linker = find<HTMLButtonElement>("[data-linker]");
  const dot = find<HTMLElement>("[data-linker-dot]");
  const replay = find<HTMLButtonElement>("[data-replay]");
  const codex = find<HTMLElement>("[data-codex]");
  const landing = find<HTMLElement>("[data-landing]");
  const sam = find<HTMLElement>("[data-sam]");
  const send = find<HTMLElement>("[data-send]");
  const status = find<HTMLElement>("[data-status]");
  const says = find<HTMLElement>("[data-says]");
  const live = find<HTMLElement>("[data-live]");
  const announce = find<HTMLElement>("[data-announce]");
  const link = find<SVGPathElement>("[data-link]");
  const linkHead = find<SVGPathElement>("[data-link-head]");
  const lineFigma = find<SVGPathElement>("[data-line-figma]");
  const lineOut = find<SVGPathElement>("[data-line-out]");
  if (
    !linker ||
    !dot ||
    !replay ||
    !codex ||
    !landing ||
    !sam ||
    !send ||
    !status ||
    !says ||
    !live ||
    !announce ||
    !link ||
    !linkHead ||
    !lineFigma ||
    !lineOut
  ) {
    return false;
  }

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const canTravel = CSS.supports("offset-path", 'path("M0 0")');
  let run = 0;

  // The board is drawn at 1440 wide and scaled down with the window.
  const toBoard = (x: number, y: number): Point => {
    const rect = board.getBoundingClientRect();
    const scale = rect.width / board.offsetWidth || 1;
    return { x: (x - rect.left) / scale, y: (y - rect.top) / scale };
  };
  const centre = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return toBoard(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };
  // Straight down into Codex when the note sits above it.
  const codexTop = (from: Point) => {
    const rect = codex.getBoundingClientRect();
    const left = toBoard(rect.left, rect.top - 3);
    const right = toBoard(rect.right, rect.top);
    return { x: Math.min(Math.max(from.x, left.x + 40), right.x - 40), y: left.y };
  };
  const overCodex = (event: PointerEvent) => {
    const rect = codex.getBoundingClientRect();
    const slop = 18;
    return (
      event.clientX > rect.left - slop &&
      event.clientX < rect.right + slop &&
      event.clientY > rect.top - slop &&
      event.clientY < rect.bottom + slop
    );
  };
  // A board connector: down, across and down again, with rounded corners.
  const draw = (from: Point, to: Point) => {
    const across = to.x - from.x;
    const turn = to.y - Math.min(80, Math.max(0, (to.y - from.y) / 2));
    const radius = Math.min(16, Math.abs(across) / 2, Math.abs(turn - from.y), to.y - turn);
    const side = Math.sign(across);
    const d =
      Math.abs(across) < 1 || to.y <= from.y
        ? `M${from.x} ${from.y}L${to.x} ${to.y}`
        : `M${from.x} ${from.y}V${turn - radius}Q${from.x} ${turn} ${from.x + side * radius} ${turn}` +
          `H${to.x - side * radius}Q${to.x} ${turn} ${to.x} ${turn + radius}V${to.y}`;
    link.setAttribute("d", d);
    // The arrowhead follows the connector's last stretch.
    const angle = d.includes("V") ? Math.PI / 2 : Math.atan2(to.y - from.y, to.x - from.x);
    const wing = (side: number) =>
      `${to.x - 8 * Math.cos(angle) + side * 7 * Math.sin(angle)} ${to.y - 8 * Math.sin(angle) - side * 7 * Math.cos(angle)}`;
    linkHead.setAttribute("d", `M${wing(1)}L${to.x} ${to.y}L${wing(-1)}`);
  };
  const clearLine = () => {
    link.removeAttribute("d");
    linkHead.removeAttribute("d");
  };
  const moving = () => !reduced.matches;

  const step = (token: number, ms: number) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(
        () => (token === run ? resolve() : reject(new Stopped())),
        reduced.matches ? 0 : ms,
      ),
    );

  // A card's content riding a line into or out of the agent.
  const travel = (path: SVGPathElement, label: string, kind: string) => {
    // Stacked boards on phones hide the lines between cards that are no longer side by side.
    if (!moving() || !canTravel || getComputedStyle(path).display === "none") return;
    const packet = document.createElement("span");
    packet.className = `packet packet--${kind}`;
    packet.textContent = label;
    packet.setAttribute("aria-hidden", "true");
    packet.style.offsetPath = `path("${path.getAttribute("d")}")`;
    board.append(packet);
    void packet
      .animate(
        [
          { offsetDistance: "0%", opacity: 0 },
          { offsetDistance: "5%", opacity: 1, offset: 0.05 },
          { offsetDistance: "92%", opacity: 1, offset: 0.92 },
          { offsetDistance: "100%", opacity: 0 },
        ],
        { duration: 1300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      )
      .finished.catch(() => undefined)
      .finally(() => packet.remove());
  };

  const samTo = async (to: Point) => {
    if (!moving() || getComputedStyle(sam).display === "none") return;
    sam.classList.remove("drift");
    // The arrow's tip sits near the top left of its icon.
    const tip = sam.querySelector("svg")?.getBoundingClientRect();
    if (tip === undefined) return;
    const at = toBoard(tip.left + 4, tip.top + 3);
    await sam
      .animate([{ translate: "0 0" }, { translate: `${to.x - at.x}px ${to.y - at.y}px` }], {
        duration: 850,
        easing: "cubic-bezier(0.5, 0, 0.2, 1)",
        fill: "forwards",
      })
      .finished.catch(() => undefined);
  };
  const samBack = () => {
    const there = sam.getAnimations();
    if (there.length === 0) return;
    const back = sam.animate([{ translate: "0 0" }], {
      duration: 900,
      easing: "cubic-bezier(0.5, 0, 0.2, 1)",
    });
    void back.finished
      .then(() => {
        for (const animation of there) animation.cancel();
        sam.classList.add("drift");
      })
      .catch(() => undefined);
  };

  const say = (text: string) => {
    says.textContent = text;
    if (!reduced.matches) {
      says.animate(
        [
          { opacity: 0, translate: "0 4px" },
          { opacity: 1, translate: "0 0" },
        ],
        260,
      );
    }
  };

  const play = async (token: number) => {
    board.dataset.demo = "linked";
    announce.textContent = "Priya's note is connected to Sam's Codex. Sam can send it.";
    await step(token, 700);
    await samTo(centre(send));
    await step(token, 150);
    send.classList.add("is-pressed");
    await step(token, 250);
    codex.dataset.state = "working";
    status.textContent = "Working";
    travel(link, "Priya's note", "note");
    travel(lineFigma, "Spring photos", "figma");
    say("Reading Priya's note and Spring photos");
    announce.textContent = "Sam pressed Send. Codex is reading the note and the Figma file.";
    samBack();
    await step(token, 1400);
    say("Making the photos bigger");
    landing.dataset.state = "updating";
    live.textContent = "Updating";
    await step(token, 1100);
    say("Taking out the carousel");
    travel(lineOut, "", "dot");
    await step(token, 600);
    landing.dataset.state = "updated";
    await step(token, 900);
    codex.dataset.state = "done";
    status.textContent = "Done";
    live.textContent = "Live";
    say("Made the photos bigger and took out the carousel.");
    announce.textContent = "Codex updated the landing page. Maya commented: Much better.";
    await step(token, 900);
    board.dataset.demo = "done";
    replay.hidden = false;
    if (document.activeElement === linker) replay.focus();
    onDone();
  };

  const start = async (drawIn: boolean) => {
    if (board.dataset.demo !== undefined) return;
    const token = ++run;
    const from = centre(dot);
    draw(from, codexTop(from));
    if (drawIn && moving()) {
      const length = `${link.getTotalLength()}`;
      link.animate(
        [
          { strokeDasharray: length, strokeDashoffset: length },
          { strokeDasharray: length, strokeDashoffset: "0" },
        ],
        { duration: 650, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
      linkHead.animate([{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], 650);
    }
    try {
      await play(token);
    } catch (error) {
      if (!(error instanceof Stopped)) throw error;
    }
  };

  const reset = () => {
    run += 1;
    delete board.dataset.demo;
    delete landing.dataset.state;
    codex.dataset.state = "ready";
    status.textContent = "Ready";
    live.textContent = "Live";
    says.textContent = "";
    announce.textContent = "";
    send.classList.remove("is-pressed");
    clearLine();
    for (const animation of sam.getAnimations()) animation.cancel();
    sam.classList.add("drift");
    for (const packet of board.querySelectorAll(".packet")) packet.remove();
    replay.hidden = true;
    linker.focus();
  };

  linker.addEventListener("pointerdown", (event) => {
    if (board.dataset.demo !== undefined || event.button !== 0) return;
    event.preventDefault();
    linker.setPointerCapture(event.pointerId);
    const from = centre(dot);
    const origin = { x: event.clientX, y: event.clientY };
    let dragged = false;
    board.classList.add("is-drawing");
    const move = (next: PointerEvent) => {
      if (Math.hypot(next.clientX - origin.x, next.clientY - origin.y) > 6) dragged = true;
      if (!dragged) return;
      const over = overCodex(next);
      codex.classList.toggle("is-target", over);
      draw(from, over ? codexTop(from) : toBoard(next.clientX, next.clientY));
    };
    const end = (last: PointerEvent) => {
      linker.removeEventListener("pointermove", move);
      linker.removeEventListener("pointerup", end);
      linker.removeEventListener("pointercancel", end);
      board.classList.remove("is-drawing");
      codex.classList.remove("is-target");
      // A tap draws the line for you; a drag has to end on Codex.
      if (last.type === "pointerup" && (!dragged || overCodex(last))) {
        void start(!dragged);
        return;
      }
      clearLine();
    };
    linker.addEventListener("pointermove", move);
    linker.addEventListener("pointerup", end);
    linker.addEventListener("pointercancel", end);
  });
  // Enter and Space click with no pointer behind it.
  linker.addEventListener("click", (event) => {
    if (event.detail === 0) void start(true);
  });
  replay.addEventListener("click", reset);
  return true;
}
