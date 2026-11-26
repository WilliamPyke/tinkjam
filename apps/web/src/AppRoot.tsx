import { RouterProvider } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { QuitHoldOverlay } from "./components/QuitHoldOverlay";
import { isElectron } from "./env";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";
import type { AppRouter } from "./router";

const ElectronBrowserHost = lazy(() =>
  import("./browser/ElectronBrowserHost").then((module) => ({
    default: module.ElectronBrowserHost,
  })),
);

// Keep webviews outside the router but inside its atom registry so route changes preserve them.
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <RouterProvider router={router} />
      {isElectron ? (
        <Suspense fallback={null}>
          <ElectronBrowserHost />
        </Suspense>
      ) : null}
      <QuitHoldOverlay />
    </AppAtomRegistryProvider>
  );
}
