import { describe, expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import "~/index.css";
import { render } from "../../../test/render";
import { ToastProvider, toastManager } from "./toast";

describe("toastManager", () => {
  it("shows a toast added before any provider mounted", async () => {
    toastManager.add({ type: "info", title: "Raised before the first render" });

    await using _screen = await render(<ToastProvider>{null}</ToastProvider>);

    await expect.element(page.getByText("Raised before the first render")).toBeVisible();
  });

  it("keeps an error up for at least ten seconds unless it says otherwise", () => {
    const timeouts = new Map<string, number | undefined>();
    const stop = toastManager[" subscribe"]((event) => {
      if (event.action === "add") timeouts.set(event.options.title, event.options.timeout);
    });
    toastManager.add({ type: "error", title: "Could not start a board" });
    toastManager.add({ type: "error", title: "Brief error", timeout: 3_000 });
    toastManager.add({ type: "success", title: "Saved" });
    stop();
    expect(timeouts.get("Could not start a board")).toBe(10_000);
    expect(timeouts.get("Brief error")).toBe(3_000);
    expect(timeouts.get("Saved")).toBeUndefined();
  });

  it("keeps the toast inside a 16px gutter on narrow screens", async () => {
    await page.viewport(390, 844);
    toastManager.add({ type: "error", title: "Something failed", description: "Try again." });
    await using _screen = await render(<ToastProvider>{null}</ToastProvider>);
    await expect.element(page.getByText("Something failed")).toBeVisible();

    const root = document.querySelector<HTMLElement>(
      "[data-slot=toast-viewport] > [data-position]",
    );
    const insideGutter = () => {
      const rect = root?.getBoundingClientRect();
      expect(rect, "toast root").toBeTruthy();
      if (!rect) return;
      // The toast may slide vertically on entry, but must never leave the
      // 16px side gutters — before the fix it entered from translateX(100%+inset).
      expect(rect.left).toBeGreaterThanOrEqual(15);
      expect(rect.right).toBeLessThanOrEqual(window.innerWidth - 15);
    };
    insideGutter();
    await vi.waitFor(() => {
      const rect = root?.getBoundingClientRect();
      if (!rect || Math.round(rect.left) !== 16) throw new Error("toast still animating");
    });
    insideGutter();
  });
});
