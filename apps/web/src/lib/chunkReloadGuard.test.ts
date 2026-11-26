import { describe, expect, it, vi } from "vite-plus/test";

import { holdChunkReload, reloadForChunkLoadError } from "./chunkReloadGuard";

function createStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

const AT = 1_800_000_000_000;

describe("reloadForChunkLoadError", () => {
  it("reloads, lets a failure right after the reload surface, and reloads for a later deploy", () => {
    const storage = createStorageStub();
    const reload = vi.fn();

    expect(reloadForChunkLoadError(() => storage, reload, AT)).toBe(true);
    expect(reloadForChunkLoadError(() => storage, reload, AT + 5_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    expect(reloadForChunkLoadError(() => storage, reload, AT + 10 * 60_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("does not reload while a board has edits it has not sent", () => {
    const storage = createStorageStub();
    const reload = vi.fn();
    const release = holdChunkReload();

    expect(reloadForChunkLoadError(() => storage, reload, AT)).toBe(false);
    release();
    release();
    expect(reloadForChunkLoadError(() => storage, reload, AT)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("never reloads when storage is blocked, so a persistent failure cannot loop", () => {
    const reload = vi.fn();
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };

    expect(reloadForChunkLoadError(blocked, reload, AT)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
