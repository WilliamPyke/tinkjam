import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "~/index.css";

import { render, stubGlobal } from "../../test/render";
import { useCommitOnBlur } from "../hooks/useCommitOnBlur";
import { AppRouteModal, AppRouteModalClose } from "./AppRouteModal";

function CommitOnBlurField({ onCommit }: { onCommit: (next: string) => void }) {
  return <input aria-label="Instructions" {...useCommitOnBlur("", onCommit)} />;
}

describe("AppRouteModal", () => {
  it("commits a focused field when Esc closes it", async () => {
    const onCommit = vi.fn();
    await using _screen = await render(
      <AppRouteModal label="Settings">
        <CommitOnBlurField onCommit={onCommit} />
      </AppRouteModal>,
      { router: "/settings/general" },
    );

    await page.getByRole("textbox", { name: "Instructions" }).fill("Keep titles short");
    await userEvent.keyboard("{Escape}");

    expect(onCommit).toHaveBeenCalledWith("Keep titles short");
  });

  it("closes on Escape while its Close button has focus", async () => {
    await using screen = await render(
      <AppRouteModal label="Settings">
        <AppRouteModalClose />
      </AppRouteModal>,
      { router: "/settings" },
    );

    page.getByRole("button", { name: "Close" }).element().focus();
    // The tooltip is open; it is the layer that would hear the key first.
    await expect.element(page.getByText("Close (Esc)")).toBeVisible();
    await userEvent.keyboard("{Escape}");

    await vi.waitFor(() => expect(screen.router?.state.location.pathname).toBe("/"));
  });

  it("leaves for the home when opened from its own address, even with no animation frames", async () => {
    await using screen = await render(
      <AppRouteModal label="Settings">
        <AppRouteModalClose />
      </AppRouteModal>,
      { router: "/settings" },
    );
    // A background tab runs no animation frames.
    using _frames = stubGlobal("requestAnimationFrame", () => 0);

    await page.getByRole("button", { name: "Close" }).click();

    await vi.waitFor(() => expect(screen.router?.state.location.pathname).toBe("/"));
  });
});
