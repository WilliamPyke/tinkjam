import { describe, expect, it } from "vite-plus/test";

import { act, render } from "../../../test/render";
import { BoardSyncNote, holdBoardChange } from "./BoardSyncNote";

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
});
