import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { THEME_APPEARANCE_MODE_STORAGE_KEY } from "../themePalette";

const THEME_STORAGE_KEY = "t3code:theme";

function stubEnvironment() {
  const changeListeners: Array<() => void> = [];
  const classes = new Set<string>();
  const storage = new Map<string, string>();
  const query = {
    matches: false,
    addEventListener: (type: string, listener: () => void) => {
      if (type === "change") changeListeners.push(listener);
    },
    removeEventListener: () => {},
  };
  const documentElement = {
    dataset: {} as Record<string, string | undefined>,
    offsetHeight: 0,
    classList: {
      add: (name: string) => void classes.add(name),
      remove: (name: string) => void classes.delete(name),
      toggle: (name: string, force?: boolean) => {
        const next = force ?? !classes.has(name);
        if (next) classes.add(name);
        else classes.delete(name);
        return next;
      },
    },
    style: {
      backgroundColor: "",
      setProperty: () => {},
      removeProperty: () => {},
    },
  };
  vi.stubGlobal("window", {
    location: { pathname: "/" },
    localStorage: {
      getItem: (key: string): string | null => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
    matchMedia: () => query,
  });
  vi.stubGlobal("document", { documentElement });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    callback();
    return 0;
  });
  return {
    classes,
    query,
    storage,
    emitChange: () => changeListeners.forEach((listener) => listener()),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTheme", () => {
  it("follows the OS light and dark switch while the page is open", async () => {
    const env = stubEnvironment();
    env.storage.set(THEME_STORAGE_KEY, "system");
    env.storage.set(THEME_APPEARANCE_MODE_STORAGE_KEY, "system");

    vi.resetModules();
    await import("./useTheme");

    expect(env.classes.has("dark")).toBe(false);
    env.query.matches = true;
    env.emitChange();
    expect(env.classes.has("dark")).toBe(true);
    env.query.matches = false;
    env.emitChange();
    expect(env.classes.has("dark")).toBe(false);
  });

  it("ignores the OS switch when the appearance mode is not System", async () => {
    const env = stubEnvironment();
    env.storage.set(THEME_STORAGE_KEY, "system");
    env.storage.set(THEME_APPEARANCE_MODE_STORAGE_KEY, "light");

    vi.resetModules();
    await import("./useTheme");

    env.query.matches = true;
    env.emitChange();
    expect(env.classes.has("dark")).toBe(false);
  });
});
