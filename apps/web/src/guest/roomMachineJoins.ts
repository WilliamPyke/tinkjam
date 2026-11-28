import { Atom } from "effect/reactivity";

import { appAtomRegistry } from "~/rpc/atomRegistry";

// Bumped when one of this person's machines joins a room from this page, so the room asks again.
export const roomMachineJoinsAtom = Atom.family((_shareId: string) =>
  Atom.make(0).pipe(Atom.keepAlive, Atom.withLabel("guest:room-machine-joins")),
);

/** Tells an open room that one of this person's machines just joined it. */
export const announceRoomMachineJoined = (shareId: string) =>
  appAtomRegistry.update(roomMachineJoinsAtom(shareId), (count) => count + 1);
