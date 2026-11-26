import { expect, it } from "vite-plus/test";

import { cycleMembers, type GraphModule, staticallyReached } from "./startupChunks";

const nm = "C:\\repo\\node_modules";
const lucide = `${nm}\\lucide-react\\dist\\esm`;
const effect = `${nm}\\effect\\dist`;

const graph: Record<string, Partial<GraphModule>> = {
  "C:\\repo\\src\\main.tsx": {
    code: `import { ArrowLeft as Back } from "lucide-react";
import { pipe, isRecord } from "effect";
import "./theme.ts";
import "./index.css";`,
    importedIds: [
      `${lucide}\\lucide-react.js`,
      `${effect}\\index.js`,
      "C:\\repo\\src\\theme.ts",
      "C:\\repo\\src\\index.css",
    ],
  },
  "C:\\repo\\src\\theme.ts": { code: "export const theme = 1;" },
  "C:\\repo\\src\\index.css": { code: "" },
  "C:\\repo\\src\\iconByName.ts": {
    code: `import * as Lucide from "lucide-react";`,
    importedIds: [`${lucide}\\lucide-react.js`],
  },
  [`${lucide}\\lucide-react.js`]: {
    code: `/** @license lucide-react */
import * as index from './icons/index.js';
export { index as icons };
export { default as ArrowLeft, default as LucideArrowLeft } from './icons/arrow-left.js';
export { default as X } from './icons/x.js';
//# sourceMappingURL=lucide-react.js.map`,
    importedIds: [
      `${lucide}\\icons\\index.js`,
      `${lucide}\\icons\\arrow-left.js`,
      `${lucide}\\icons\\x.js`,
    ],
  },
  [`${lucide}\\icons\\index.js`]: {
    code: `export { default as ArrowLeft } from './arrow-left.js';
export { default as X } from './x.js';`,
    importedIds: [`${lucide}\\icons\\arrow-left.js`, `${lucide}\\icons\\x.js`],
  },
  [`${lucide}\\icons\\arrow-left.js`]: { code: "export default 1;", exports: ["default"] },
  [`${lucide}\\icons\\x.js`]: { code: "export default 2;", exports: ["default"] },
  [`${effect}\\index.js`]: {
    code: `// @barrel
export {
absurd,
pipe } from "./Function.js";
export * as Crypto from "./Crypto.js";
export * from "./Predicate.js";
export * from "./Order.js";
export * from "./Endpoint.js";`,
    importedIds: [
      `${effect}\\Function.js`,
      `${effect}\\Crypto.js`,
      `${effect}\\Predicate.js`,
      `${effect}\\Order.js`,
      `${effect}\\Endpoint.js`,
    ],
  },
  [`${effect}\\Endpoint.js`]: {
    code: `export * from "@scope/endpoint";`,
    importedIds: [`${nm}\\@scope\\endpoint\\index.js`],
    exports: ["*"],
  },
  [`${nm}\\@scope\\endpoint\\index.js`]: {
    code: "export const isRecord = 2;",
    exports: ["isRecord"],
  },
  [`${effect}\\Function.js`]: { code: "export const pipe = 1;", exports: ["absurd", "pipe"] },
  [`${effect}\\Crypto.js`]: { code: "export const key = 1;", exports: ["key"] },
  [`${effect}\\Predicate.js`]: { code: "export const isRecord = 1;", exports: ["isRecord"] },
  [`${effect}\\Order.js`]: { code: "export const sort = 1;", exports: ["sort"] },
};

const moduleInfo = (id: string): GraphModule | null => {
  const module = graph[id];
  return module === undefined
    ? null
    : {
        code: module.code ?? null,
        importedIds: module.importedIds ?? [],
        exports: module.exports ?? [],
      };
};

it("follows a barrel only through the names its importer asks for", () => {
  const reached = [...staticallyReached("C:\\repo\\src\\main.tsx", moduleInfo)].map((id) =>
    id.replace(/^C:\\repo\\(node_modules\\)?/, ""),
  );
  expect(reached.sort()).toEqual(
    [
      "src\\main.tsx",
      "src\\theme.ts",
      "src\\index.css",
      "lucide-react\\dist\\esm\\icons\\arrow-left.js",
      "effect\\dist\\Function.js",
      "effect\\dist\\Predicate.js",
      "effect\\dist\\Endpoint.js",
      "@scope\\endpoint\\index.js",
    ].sort(),
  );
});

it("follows a whole barrel imported as a namespace", () => {
  const reached = staticallyReached("C:\\repo\\src\\iconByName.ts", moduleInfo);
  expect(reached.has(`${lucide}\\lucide-react.js`)).toBe(true);
  expect(reached.has(`${lucide}\\icons\\x.js`)).toBe(true);
  expect(reached.has(`${lucide}\\icons\\index.js`)).toBe(true);
});

it("joins a barrel that may have side effects, and what sits between it and the group", () => {
  const env = "C:\\repo\\packages\\client-runtime\\src\\environment";
  const sideEffectFree = new Set([
    `${lucide}\\lucide-react.js`,
    `${lucide}\\icons\\index.js`,
    `${lucide}\\icons\\arrow-left.js`,
    `${lucide}\\icons\\x.js`,
    `${lucide}\\shared.js`,
  ]);
  const cyclic: Record<string, Partial<GraphModule>> = {
    "C:\\repo\\src\\main.tsx": {
      code: `import { scopeRef } from "@t3tools/client-runtime/environment";
import { ArrowLeft } from "lucide-react";`,
      importedIds: [`${env}\\index.ts`, `${lucide}\\lucide-react.js`],
    },
    [`${env}\\index.ts`]: {
      code: `export * from "./scoped.ts";
export * from "./guest.ts";`,
      importedIds: [`${env}\\scoped.ts`, `${env}\\guest.ts`],
    },
    [`${env}\\scoped.ts`]: { code: "export const scopeRef = 1;", exports: ["scopeRef"] },
    [`${env}\\guest.ts`]: {
      code: `import { scopeRef } from "./scoped.ts";
export const guest = scopeRef;`,
      importedIds: [`${env}\\scoped.ts`],
      exports: ["guest"],
    },
    [`${lucide}\\lucide-react.js`]: {
      code: `export { default as ArrowLeft } from './icons/arrow-left.js';
export { default as X } from './icons/x.js';`,
      importedIds: [`${lucide}\\icons\\arrow-left.js`, `${lucide}\\icons\\x.js`],
    },
    [`${lucide}\\icons\\arrow-left.js`]: {
      code: `import shared from "../shared.js";`,
      importedIds: [`${lucide}\\shared.js`],
      exports: ["default"],
    },
    [`${lucide}\\icons\\x.js`]: {
      code: `import shared from "../shared.js";`,
      importedIds: [`${lucide}\\shared.js`],
      exports: ["default"],
    },
    [`${lucide}\\shared.js`]: { code: "export default 1;", exports: ["default"] },
  };
  const info = (id: string): GraphModule | null => {
    const module = cyclic[id];
    return module === undefined
      ? null
      : {
          code: module.code ?? null,
          importedIds: module.importedIds ?? [],
          exports: module.exports ?? [],
          moduleSideEffects: !sideEffectFree.has(id),
        };
  };

  const group = staticallyReached("C:\\repo\\src\\main.tsx", info);
  expect(group.has(`${env}\\index.ts`)).toBe(false);
  expect(group.has(`${env}\\guest.ts`)).toBe(false);
  expect(group.has(`${lucide}\\shared.js`)).toBe(true);
  expect([...cycleMembers(group, new Set(), info)].sort()).toEqual(
    [`${env}\\guest.ts`, `${env}\\index.ts`].sort(),
  );
});
