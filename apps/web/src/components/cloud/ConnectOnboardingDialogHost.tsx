import { lazy, Suspense } from "react";

import { hasCloudPublicConfig } from "~/cloud/publicConfig";

const ConfiguredConnectOnboardingDialog = lazy(() =>
  import("./ConnectOnboardingDialog").then((module) => ({
    default: module.ConfiguredConnectOnboardingDialog,
  })),
);

export function ConnectOnboardingDialog() {
  if (!hasCloudPublicConfig()) return null;

  return (
    <Suspense fallback={null}>
      <ConfiguredConnectOnboardingDialog />
    </Suspense>
  );
}
