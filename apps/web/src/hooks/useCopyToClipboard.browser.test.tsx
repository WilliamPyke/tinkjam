import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../test/render";
import { useCopyToClipboard } from "./useCopyToClipboard";

function CopyButton({ onError }: { readonly onError: (error: Error) => void }) {
  const { copyToClipboard } = useCopyToClipboard({ onError });
  return (
    <button type="button" onClick={() => copyToClipboard("board link", undefined)}>
      Copy
    </button>
  );
}

describe("useCopyToClipboard", () => {
  it("reports a refused copy to its caller without logging it as uncaught", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new Error("denied"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    await using screen = await render(<CopyButton onError={onError} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(consoleError).not.toHaveBeenCalled();
    writeText.mockRestore();
    consoleError.mockRestore();
  });
});
