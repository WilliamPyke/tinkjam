type KeyboardAssistWindow = Pick<
  Window,
  | "cancelAnimationFrame"
  | "getComputedStyle"
  | "innerHeight"
  | "matchMedia"
  | "requestAnimationFrame"
  | "visualViewport"
>;

const TEXT_FIELD_SELECTOR = 'input, textarea, [contenteditable]:not([contenteditable="false"])';
const KEYBOARD_FIELD_MARGIN = 12;

export function softwareKeyboardFieldOverlap(
  field: Pick<DOMRectReadOnly, "bottom">,
  viewport: Pick<VisualViewport, "height" | "offsetTop">,
  margin = KEYBOARD_FIELD_MARGIN,
): number {
  return Math.max(0, field.bottom - (viewport.offsetTop + viewport.height - margin));
}

/** iOS Safari shrinks the visual viewport without resizing the layout under its keyboard. */
export function installSoftwareKeyboardAssist(
  win: KeyboardAssistWindow,
  doc: Document,
): () => void {
  const viewport = win.visualViewport;
  if (viewport === null || viewport === undefined || !win.matchMedia("(pointer: coarse)").matches) {
    return () => {};
  }
  const root = doc.documentElement;
  const writeViewport = () => {
    root.style.setProperty("--visual-viewport-height", `${viewport.height}px`);
    const inset = Math.max(0, win.innerHeight - (viewport.offsetTop + viewport.height));
    root.style.setProperty("--software-keyboard-inset", `${inset}px`);
  };
  const nearestScroller = (field: HTMLElement) => {
    for (let element = field.parentElement; element !== null; element = element.parentElement) {
      const { overflowY } = win.getComputedStyle(element);
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        element.scrollHeight > element.clientHeight + 1
      ) {
        return element;
      }
    }
    return null;
  };
  const activeField = () => {
    const active = doc.activeElement;
    return active instanceof HTMLElement && active.matches(TEXT_FIELD_SELECTOR) ? active : null;
  };
  const reveal = () => {
    const field = activeField();
    if (field === null) return;
    if (softwareKeyboardFieldOverlap(field.getBoundingClientRect(), viewport) === 0) return;
    const scroller = nearestScroller(field);
    field.scrollIntoView({ block: "nearest" });
    if (scroller === null) return;
    const remaining = softwareKeyboardFieldOverlap(field.getBoundingClientRect(), viewport);
    if (remaining > 0) scroller.scrollTop += remaining;
  };
  let frame: number | null = null;
  const schedule = () => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      frame = win.requestAnimationFrame(() => {
        frame = null;
        reveal();
      });
    });
  };
  const update = () => {
    writeViewport();
    schedule();
  };
  writeViewport();
  doc.addEventListener("focusin", schedule);
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  return () => {
    doc.removeEventListener("focusin", schedule);
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    if (frame !== null) win.cancelAnimationFrame(frame);
    root.style.removeProperty("--visual-viewport-height");
    root.style.removeProperty("--software-keyboard-inset");
  };
}

type VirtualKeyboard = EventTarget & {
  readonly boundingRect: Pick<DOMRectReadOnly, "height">;
  readonly overlaysContent: boolean;
};

type KeyboardWindow = Pick<Window, "innerHeight" | "visualViewport"> & {
  readonly navigator: Navigator & { readonly virtualKeyboard?: VirtualKeyboard };
};

const KEYBOARD_THRESHOLD = 150;

function viewportSnapshot(viewport: VisualViewport) {
  return {
    width: Math.round(viewport.width),
    height: Math.round(viewport.height),
    scale: viewport.scale,
  };
}

export function createSoftwareKeyboardStore(win: KeyboardWindow | undefined, isDesktop: boolean) {
  const listeners = new Set<() => void>();
  let viewportOpen = false;
  const viewport = isDesktop ? undefined : win?.visualViewport;
  const keyboard = isDesktop ? undefined : win?.navigator.virtualKeyboard;
  let previous = viewport ? viewportSnapshot(viewport) : undefined;

  const getSnapshot = () => {
    // Chromium can expose the API while withholding geometry outside overlay mode.
    // Keep the browser's automatic viewport resizing instead of enabling overlays.
    if (keyboard && (keyboard.overlaysContent || keyboard.boundingRect.height > 0)) {
      return keyboard.boundingRect.height > 0;
    }
    return viewportOpen;
  };

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const onViewportResize = () => {
    if (!viewport || !win) return;
    const current = viewportSnapshot(viewport);
    // Adapted from Ionic's keyboard assist, MIT, Copyright (c) 2015-present Drifty Co.
    // https://github.com/ionic-team/ionic-framework/blob/main/core/src/utils/keyboard/keyboard.ts
    const scaledHeightDifference = previous
      ? (previous.height - current.height) * current.scale
      : 0;
    if (Math.abs(current.height - win.innerHeight / current.scale) <= 1) {
      viewportOpen = false;
    } else if (
      !viewportOpen &&
      previous?.width === current.width &&
      scaledHeightDifference > KEYBOARD_THRESHOLD
    ) {
      viewportOpen = true;
    }
    previous = current;
    notify();
  };

  const subscribe = (listener: () => void) => {
    if (isDesktop || !win) return () => {};
    if (listeners.size === 0) {
      if (viewport) {
        previous = viewportSnapshot(viewport);
        // A composer can mount after the keyboard has already opened.
        viewportOpen = win.innerHeight - previous.height * previous.scale > KEYBOARD_THRESHOLD;
        viewport.addEventListener("resize", onViewportResize);
      }
      keyboard?.addEventListener("geometrychange", notify);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        viewport?.removeEventListener("resize", onViewportResize);
        keyboard?.removeEventListener("geometrychange", notify);
      }
    };
  };

  return { getSnapshot, subscribe };
}
