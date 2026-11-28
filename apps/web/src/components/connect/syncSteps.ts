import type { SyncInstall, SyncOs } from "~/syncDownloads";

export interface SyncStepCopy {
  readonly text: string;
  readonly note?: string;
}

const APPROVAL_STEP =
  "Your browser opens by itself. Sign in if it asks, then press Approve this computer.";

const COMMAND_STEP: Readonly<Record<SyncOs, SyncStepCopy>> = {
  mac: {
    text: "Open Terminal, paste the install command and press Return",
    note: "Press Command and Space, type Terminal, press Return.",
  },
  windows: { text: "Paste it into a terminal and press Enter" },
  linux: { text: "Open a terminal, paste the install command and press Enter" },
};

const FILE_STEP: Readonly<Record<SyncOs, SyncStepCopy>> = {
  mac: { text: "Download Tinkjam Sync and open the file" },
  windows: {
    text: "Download Tinkjam Sync and open the file",
    note: "Windows does not recognise Tinkjam Sync yet, so it says it protected your PC. Choose More info, then Run anyway.",
  },
  linux: {
    text: "Download Tinkjam Sync. Open the AppImage, or install the package and open Tinkjam Sync.",
  },
};

export function syncStepCopy(os: SyncOs, install: SyncInstall): ReadonlyArray<SyncStepCopy> {
  return [install.method === "command" ? COMMAND_STEP[os] : FILE_STEP[os], { text: APPROVAL_STEP }];
}
