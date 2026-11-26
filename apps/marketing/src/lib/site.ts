export const SITE_NAME = "Tinkjam";
export const APP_URL = "https://app.tinkjam.com/";
export const SIGN_IN_URL = `${APP_URL}sign-in`;
// The public sample board's view link, as infra/boards/scripts/sample-board.mjs prints it. Empty
// hides "See a sample board". Keep it the same as SAMPLE_BOARD_URL in apps/web/src/sampleBoard.ts.
export const SAMPLE_BOARD_URL: string =
  "https://app.tinkjam.com/guest?host=boards.tinkjam.com#1ecbf7b4-8fc3-46f8-8a5c-8a683e311029.v.usrcvSaVH6bFGp3ACk5tGWNPWwFWYCZ5eXYLRB7usFE";

// The sample boards "See a sample board" offers, each built from infra/boards/sample/<id>.json by
// infra/boards/scripts/sample-board.mjs, which prints its view link.
export const SAMPLE_BOARDS: ReadonlyArray<{
  id: "onboarding-v2" | "kitebox-deck" | "next-phone-2006";
  title: string;
  about: string;
  who: string;
  url: string;
}> = [
  {
    id: "onboarding-v2",
    title: "Onboarding v2",
    about:
      "A product team plans a new welcome flow. Three agents write the copy, the screens and the weekly update.",
    who: "4 people, 3 agents",
    url: SAMPLE_BOARD_URL,
  },
  {
    id: "kitebox-deck",
    title: "Kitebox seed deck",
    about:
      "A startup's pitch deck. One agent writes the slides from the team's notes, another designs them.",
    who: "4 people, 2 agents",
    url: "https://app.tinkjam.com/guest?host=boards.tinkjam.com#7d494c55-6ded-4b55-bbc3-af0987fc7825.v.y62Lnvzs2R4HBz17Fj86dXiVVBbzMKxhGPiXg6PBxAs",
  },
  {
    id: "next-phone-2006",
    title: "The next phone, 2006",
    about:
      "Three researchers pick the next feature for a phone. Each agent builds on what the others found.",
    who: "3 people, 3 agents",
    url: "https://app.tinkjam.com/guest?host=boards.tinkjam.com#377ba172-9516-4bf2-8c6c-1534d09bfbbe.v.eNHL9MtnAan-xqLDGsmGBLDAnk32LgO9-pOzuTYikhY",
  },
];

// Tinkjam Sync downloads, copied into dist/downloads/ at deploy. Release files are named
// tinkjam-sync-v<version>-<os>-<arch>.<ext>; point each constant at the real file at release.
const SYNC_VERSION = "1.0.5";
const WINDOWS_DOWNLOAD = "/downloads/TinkjamSyncSetup.exe";
const MAC_DMG_DOWNLOAD = "/downloads/Tinkjam-Sync.dmg";
const LINUX_DOWNLOADS = [
  {
    label: "AppImage (beta)",
    href: `/downloads/tinkjam-sync-v${SYNC_VERSION}-linux-x86_64.AppImage`,
  },
  { label: ".deb (beta)", href: `/downloads/tinkjam-sync-v${SYNC_VERSION}-linux-x86_64.deb` },
  { label: ".rpm (beta)", href: `/downloads/tinkjam-sync-v${SYNC_VERSION}-linux-x86_64.rpm` },
];
// The published install commands (mac/scripts/install.sh in the tinkjam-sync repository prints the Linux one).
const MAC_INSTALL_COMMAND = "curl -fsSL https://tinkjam.com/downloads/install.sh | bash";
const LINUX_INSTALL_COMMAND = "npx -y https://tinkjam.com/sync.tgz --install";
export const CHECKSUMS_URL = "/downloads/checksums.txt";
export const SYNC_SOURCE_URL = "https://github.com/WilliamPyke/tinkjam-sync";
// A Mac app downloaded in a browser is stopped by Gatekeeper unless it is notarized, so until
// then Mac installs by command. Set each flag once its files are in dist/downloads/.
const MAC_NOTARIZED: boolean = false;
const LINUX_PUBLISHED: boolean = true;
export const CHECKSUMS_PUBLISHED: boolean = true;

type SyncMethod =
  | { kind: "files"; files: ReadonlyArray<{ label: string; href: string }> }
  | { kind: "command"; command: string };

type SyncOs = "mac" | "windows" | "linux";
type SyncStep = { text: string; note?: string };

const APPROVAL_STEP: SyncStep = {
  text: "Your browser opens by itself. Sign in if it asks, then press Approve this computer.",
};
const COMMAND_STEP: Readonly<Record<SyncOs, SyncStep>> = {
  mac: {
    text: "Open Terminal, paste the install command and press Return",
    note: "Press Command and Space, type Terminal, press Return.",
  },
  windows: { text: "Paste it into a terminal and press Enter" },
  linux: { text: "Open a terminal, paste the install command and press Enter" },
};
const FILE_STEP: Readonly<Record<SyncOs, SyncStep>> = {
  mac: { text: "Download Tinkjam Sync and open the file" },
  windows: {
    text: "Download Tinkjam Sync and open the file",
    note: "Windows does not recognise Tinkjam Sync yet, so it says it protected your PC. Choose More info, then Run anyway.",
  },
  linux: {
    text: "Download Tinkjam Sync. Open the AppImage, or install the package and open Tinkjam Sync.",
  },
};

function syncSteps(os: SyncOs, method: SyncMethod): ReadonlyArray<SyncStep> {
  return [method.kind === "command" ? COMMAND_STEP[os] : FILE_STEP[os], APPROVAL_STEP];
}

const MAC_METHOD: SyncMethod = MAC_NOTARIZED
  ? { kind: "files", files: [{ label: "Download for Mac", href: MAC_DMG_DOWNLOAD }] }
  : { kind: "command", command: MAC_INSTALL_COMMAND };
const WINDOWS_METHOD: SyncMethod = {
  kind: "files",
  files: [{ label: "Download for Windows", href: WINDOWS_DOWNLOAD }],
};
const LINUX_METHOD: SyncMethod = LINUX_PUBLISHED
  ? {
      kind: "files",
      files: LINUX_DOWNLOADS.map((file) => ({
        label: `Download for Linux: ${file.label}`,
        href: file.href,
      })),
    }
  : { kind: "command", command: LINUX_INSTALL_COMMAND };

export const SYNC_SYSTEMS: ReadonlyArray<{
  os: SyncOs;
  name: string;
  method: SyncMethod;
  steps: ReadonlyArray<SyncStep>;
}> = [
  { os: "mac", name: "Mac", method: MAC_METHOD, steps: syncSteps("mac", MAC_METHOD) },
  {
    os: "windows",
    name: "Windows",
    method: WINDOWS_METHOD,
    steps: syncSteps("windows", WINDOWS_METHOD),
  },
  { os: "linux", name: "Linux", method: LINUX_METHOD, steps: syncSteps("linux", LINUX_METHOD) },
];

// Tinkjam is a fork of T3 Code, which is MIT licensed; the legal page credits it.
export const UPSTREAM_REPO_URL = "https://github.com/pingdotgg/t3code";
