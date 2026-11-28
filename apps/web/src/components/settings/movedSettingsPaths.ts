import type { SettingsPath } from "./settingsSearch";

export const RENAMED_SETTINGS_PATHS: Readonly<Record<string, SettingsPath>> = {
  "/settings/integrations": "/settings/browser",
  "/settings/storage": "/settings/maintenance",
  "/settings/beta": "/settings/labs",
};

const SPLIT_SETTINGS_PATHS: ReadonlySet<string> = new Set([
  "/settings/general",
  "/settings/appearance",
  "/settings/source-control",
  "/settings/connections",
  ...Object.keys(RENAMED_SETTINGS_PATHS),
]);

/** Old settings links that may now live elsewhere; `movedSettingsPath` says where. */
export function isSplitSettingsPath(pathname: string): boolean {
  return SPLIT_SETTINGS_PATHS.has(pathname);
}
