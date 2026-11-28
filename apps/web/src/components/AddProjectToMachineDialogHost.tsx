import type { EnvironmentId, ScopedProjectRef } from "@t3tools/contracts";
import { lazy, Suspense } from "react";
import { create } from "zustand";

import { readProject, subscribeProject } from "../state/entities";

export interface AddProjectToMachineRequest {
  readonly projectRef: ScopedProjectRef;
  readonly targetEnvironmentId: EnvironmentId | null;
}

const useRequest = create<{ request: AddProjectToMachineRequest | null; session: number }>(() => ({
  request: null,
  session: 0,
}));

let endRequestWithProject: (() => void) | null = null;

const AddProjectToMachineDialog = lazy(() =>
  import("./AddProjectToMachineDialog").then((module) => ({
    default: module.AddProjectToMachineDialog,
  })),
);

/** Opens the dialog that clones a project onto another connected machine. */
export function openAddProjectToMachine(request: AddProjectToMachineRequest) {
  if (readProject(request.projectRef) === null) return;
  endRequestWithProject?.();
  // The request ends when its project goes away, so a project that comes back
  // later cannot reopen a dialog nobody asked for.
  endRequestWithProject = subscribeProject(request.projectRef, (project) => {
    if (project === null) closeAddProjectToMachine();
  });
  useRequest.setState((state) => ({ request, session: state.session + 1 }));
}

export function closeAddProjectToMachine() {
  endRequestWithProject?.();
  endRequestWithProject = null;
  useRequest.setState({ request: null });
}

export function AddProjectToMachineDialogHost() {
  const request = useRequest((state) => state.request);
  const session = useRequest((state) => state.session);
  return request ? (
    <Suspense fallback={null}>
      <AddProjectToMachineDialog key={session} request={request} />
    </Suspense>
  ) : null;
}
