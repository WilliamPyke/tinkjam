import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource-variable/inter";
import "@fontsource-variable/outfit";
import "./index.css";

import { hasCloudPublicConfig } from "./cloud/publicConfig";
import { isElectron } from "./env";
import { startAppServices } from "./appInit";
import { AppRoot } from "./AppRoot";
import { needsClerkAtStartup } from "./components/clerk/lazyClerk.logic";
import { configureManagedAuth, ManagedAuthRoot, requestClerk } from "./components/clerk/lazyClerk";
import { wasSignedInHere } from "./guest/browserIdentity";
import { reloadingForChunkLoadError } from "./lib/chunkReloadGuard";
import { installSoftwareKeyboardAssist } from "./lib/softwareKeyboard";

installSoftwareKeyboardAssist(window, document);

const router = startAppServices();

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const managedAuthKey = clerkPublishableKey && hasCloudPublicConfig() ? clerkPublishableKey : null;

const app = <AppRoot router={router} />;
const navigateInApp = (to: string, replace: boolean) => router.navigate({ href: to, replace });

// Split by runtime to keep Clerk out of local startup and clerk-js out of browser builds.
if (managedAuthKey !== null) {
  configureManagedAuth(() =>
    (isElectron
      ? import("./components/clerk/ElectronManagedAuthShell")
      : import("./components/clerk/BrowserManagedAuthShell")
    ).then((module) => module.default),
  );
}

// Someone who has never signed in here gets sign-in only when they ask for it.
const accountReady =
  managedAuthKey === null
    ? null
    : isElectron ||
        needsClerkAtStartup({
          cookie: document.cookie,
          pathname: window.location.pathname,
          search: window.location.search,
          signedInHere: wasSignedInHere(),
        })
      ? requestClerk()
      : import("./guest/boardAccount").then((module) => module.syncBoardAccount(null));

export const startup = Promise.all([accountReady, router.load()]).then(() => {
  // Route chunk failures resolve router.load() and surface later through the error boundary.
  if (reloadingForChunkLoadError()) return;
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      {managedAuthKey === null ? (
        app
      ) : (
        <ManagedAuthRoot publishableKey={managedAuthKey} navigate={navigateInApp}>
          {app}
        </ManagedAuthRoot>
      )}
    </React.StrictMode>,
  );
});
