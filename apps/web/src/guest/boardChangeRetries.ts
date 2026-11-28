const controllers = new Map<string, AbortController>();

/** The retry controller for one board, made when its first change has to wait. */
export function boardChangeRetryController(shareId: string): AbortController {
  const existing = controllers.get(shareId);
  if (existing !== undefined && !existing.signal.aborted) return existing;
  const controller = new AbortController();
  controllers.set(shareId, controller);
  return controller;
}

/** Stops every change still waiting to reach one board. */
export function stopBoardChangeRetries(shareId: string) {
  const controller = controllers.get(shareId);
  if (controller === undefined) return;
  controller.abort();
  controllers.delete(shareId);
}
