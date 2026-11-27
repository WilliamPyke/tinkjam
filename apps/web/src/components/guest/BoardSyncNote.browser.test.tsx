import { describe, expect, it } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { BoardSyncNote, holdBoardChange, holdSendingBoardChange } from "./BoardSyncNote";

describe("BoardSyncNote", () => {
  it("shows only the board whose change is waiting", async () => {
    await using screen = await render(
      <>
        <BoardSyncNote live shareId="board-a" />
        <BoardSyncNote live shareId="board-b" />
      </>,
      // Nothing here links or navigates.
      { router: false },
    );
    let release: () => void = () => {};
    await act(() => {
      release = holdBoardChange("board-a");
    });
    try {
      expect(screen.container.querySelectorAll('[role="status"]')).toHaveLength(1);
    } finally {
      await act(() => release());
    }
  });

  it("asks before the page goes while a change is on its way, without a note", async () => {
    await using screen = await render(<BoardSyncNote live shareId="board-a" />, {
      // Nothing here links or navigates.
      router: false,
    });
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const release = holdSendingBoardChange();
    try {
      expect(leave()).toBe(true);
      expect(screen.container.querySelectorAll('[role="status"]')).toHaveLength(0);
    } finally {
      release();
    }
    expect(leave()).toBe(false);
  });
});
