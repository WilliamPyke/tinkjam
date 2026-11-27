import { useSyncExternalStore, type ComponentType, type ReactNode } from "react";

export interface ManagedAuthShellProps {
  readonly publishableKey: string;
  /** Moves to a page of this app without loading it again. */
  readonly navigate: (to: string, replace: boolean) => Promise<void>;
  readonly children: ReactNode;
}

type ManagedAuthShell = ComponentType<ManagedAuthShellProps>;

type ClerkLoad =
  | { readonly status: "idle" | "loading" | "failed" }
  | { readonly status: "ready"; readonly Shell: ManagedAuthShell; readonly attempt: number };

let loadShell: (() => Promise<ManagedAuthShell>) | null = null;
let pending: Promise<void> | null = null;
let current: ClerkLoad = { status: "idle" };
const listeners = new Set<() => void>();

function settle(next: ClerkLoad) {
  current = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const useClerkLoad = () => useSyncExternalStore(subscribe, () => current);

/** Names the code that signs people in, for `requestClerk` to load. */
export function configureManagedAuth(load: () => Promise<ManagedAuthShell>): void {
  loadShell = load;
}

const RETRY_AFTER_MS = 1_500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Loads sign-in (Clerk), with one quiet retry before the page gives up. */
export function requestClerk(): Promise<void> {
  if (pending !== null) return pending;
  if (loadShell === null) return Promise.resolve();
  settle({ status: "loading" });
  const load = loadShell;
  pending = load()
    .catch(() => wait(RETRY_AFTER_MS).then(load))
    .then(
      (Shell) => settle({ status: "ready", Shell, attempt: 0 }),
      () => {
        pending = null;
        settle({ status: "failed" });
      },
    );
  return pending;
}

/** Retries sign-in where it failed, without loading the whole page again. */
export function retryClerk(): void {
  if (current.status === "ready") {
    settle({ ...current, attempt: current.attempt + 1 });
    return;
  }
  void requestClerk();
}

export const useClerkLoadFailed = () => useClerkLoad().status === "failed";

/** The app, inside sign-in once it has loaded. Loading it mounts the app again, once. */
export function ManagedAuthRoot({ publishableKey, navigate, children }: ManagedAuthShellProps) {
  const load = useClerkLoad();
  if (load.status !== "ready") return children;
  return (
    <load.Shell key={load.attempt} publishableKey={publishableKey} navigate={navigate}>
      {children}
    </load.Shell>
  );
}
