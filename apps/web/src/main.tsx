import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource-variable/inter";
import "@fontsource-variable/outfit";
import "./index.css";

import { hasCloudPublicConfig } from "./cloud/publicConfig";
import { isElectron } from "./env";
import { startAppServices } from "./appInit";
import { AppRoot } from "./AppRoot";
import { reloadingForChunkLoadError } from "./lib/chunkReloadGuard";

const router = startAppServices();

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const app = <AppRoot router={router} />;
const navigateInApp = (to: string, replace: boolean) => router.navigate({ href: to, replace });

// Split by runtime to keep Clerk out of local startup and clerk-js out of browser builds.
const managedAuthShellModule =
  clerkPublishableKey && hasCloudPublicConfig()
    ? isElectron
      ? import("./components/clerk/ElectronManagedAuthShell")
      : import("./components/clerk/BrowserManagedAuthShell")
    : null;

export const startup = Promise.all([
  managedAuthShellModule?.then((module) => module.default) ?? null,
  router.load(),
]).then(([ManagedAuthShell]) => {
  // Route chunk failures resolve router.load() and surface later through the error boundary.
  if (reloadingForChunkLoadError()) return;
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      {ManagedAuthShell && clerkPublishableKey ? (
        <ManagedAuthShell publishableKey={clerkPublishableKey} navigate={navigateInApp}>
          {app}
        </ManagedAuthShell>
      ) : (
        app
      )}
    </React.StrictMode>,
  );
});
