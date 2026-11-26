// @effect-diagnostics nodeBuiltinImport:off - a Vite build plugin; it runs before any Effect runtime.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import type { Plugin } from "vite-plus";

export interface GraphModule {
  readonly code: string | null;
  readonly importedIds: readonly string[];
  readonly exports: readonly string[];
  readonly moduleSideEffects?: boolean | "no-treeshake" | null;
}

type Reexports = Map<string, { readonly target: string; readonly name: string | null }>;

const comments = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const fromClause =
  /(import|export)\s*(?:[\w$]+\s*,\s*)?(\*\s*as\s+([\w$]+)|\*|\{([^}]*)\})\s*from\s*["']([^"']+)["']\s*;?/g;
const localExport = /export\s*\{([^}]*)\}\s*;?/g;
const specifiers = (list: string) =>
  list
    .split(",")
    .map((part) => part.trim().replace(/^type\s+/, ""))
    .filter((part) => part.length > 0)
    .map((part) => {
      const [imported = "", local = imported] = part.split(/\s+as\s+/);
      return { imported, local };
    });

const normalize = (id: string) => id.replaceAll("\\", "/");
const joinRelative = (from: string, spec: string) => {
  const parts = normalize(from).split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
};

// A module made only of re-exports from relative paths, mapped by exported name. `*` marks
// `export * from`, whose names pass through. Anything else is not a barrel.
function barrelReexports(id: string, module: GraphModule): Reexports | null {
  if (module.code === null) return null;
  const targets = new Map(module.importedIds.map((imported) => [normalize(imported), imported]));
  const resolve = (spec: string) =>
    spec.startsWith(".") ? targets.get(joinRelative(id, spec)) : undefined;
  const reexports: Reexports = new Map();
  const namespaces = new Map<string, string>();
  let unresolved = false;
  const code = module.code.replace(comments, "");
  const rest = code
    .replace(
      fromClause,
      (_match, kind: string, _clause, namespace?: string, list?: string, spec = "") => {
        const target = resolve(spec);
        if (target === undefined) unresolved = true;
        else if (kind === "import") {
          if (namespace !== undefined) namespaces.set(namespace, target);
          else unresolved = true;
        } else if (namespace !== undefined) reexports.set(namespace, { target, name: null });
        else if (list === undefined) reexports.set(`*${target}`, { target, name: "*" });
        else
          for (const { imported, local } of specifiers(list))
            reexports.set(local, { target, name: imported });
        return "";
      },
    )
    .replace(localExport, (_match, list: string) => {
      for (const { imported, local } of specifiers(list)) {
        const target = namespaces.get(imported);
        if (target === undefined) unresolved = true;
        else reexports.set(local, { target, name: null });
      }
      return "";
    });
  // An empty module (a stylesheet's stub) runs for its side effect; it is not a barrel.
  return unresolved || reexports.size === 0 || rest.replace(/[\s;]/g, "").length > 0
    ? null
    : reexports;
}

const barrelLookup = (moduleInfo: (id: string) => GraphModule | null) => {
  const barrels = new Map<string, Reexports | null>();
  return (id: string) => {
    if (!barrels.has(id)) {
      const module = moduleInfo(id);
      barrels.set(id, module === null ? null : barrelReexports(id, module));
    }
    return barrels.get(id) ?? null;
  };
};

// Names a module imports from anywhere, and the specifiers it imports whole (`import * as`).
function importsOf(code: string) {
  const names = new Set(["default"]);
  const namespaces: string[] = [];
  for (const match of code.replace(comments, "").matchAll(fromClause)) {
    if (match[1] === "import" && match[3] !== undefined) namespaces.push(match[5] ?? "");
    for (const { imported } of specifiers(match[4] ?? "")) names.add(imported);
  }
  return { names, namespaces };
}

const isSpecifierOf = (id: string, spec: string) => {
  const path = normalize(id).replace(/\.[cm]?[jt]sx?$/, "");
  const tail = spec.replace(/^(\.\.?\/)+/, "");
  return (
    path.includes(`/node_modules/${spec}/`) ||
    path.endsWith(`/${tail}`) ||
    path.endsWith(`/${tail}/index`)
  );
};

// Modules `entry` reaches by static imports, following a barrel only through the names its
// importer asks for: `import { X } from "lucide-react"` reaches one icon, not all of them. Such a
// barrel stays out: its namespace object, if lazy code uses it, needs every icon.
export function staticallyReached(
  entry: string,
  moduleInfo: (id: string) => GraphModule | null,
): Set<string> {
  const reached = new Set<string>();
  const visited = new Set<string>();
  const barrelOf = barrelLookup(moduleInfo);

  const visit = (id: string, names: ReadonlySet<string> | null) => {
    const whole = `${id}\0*`;
    if (visited.has(whole)) return;
    const reexports = barrelOf(id);
    if (reexports === null || names === null) {
      visited.add(whole);
      reached.add(id);
      if (reexports !== null) {
        for (const { target } of reexports.values()) visit(target, null);
        return;
      }
      const module = moduleInfo(id);
      const asked = module?.code ? importsOf(module.code) : null;
      for (const imported of module?.importedIds ?? []) {
        const all =
          asked === null || asked.namespaces.some((spec) => isSpecifierOf(imported, spec));
        visit(imported, all ? null : asked.names);
      }
      return;
    }
    for (const name of names) {
      if (visited.has(`${id}\0${name}`)) continue;
      visited.add(`${id}\0${name}`);
      const direct = reexports.get(name);
      if (direct !== undefined) {
        visit(direct.target, direct.name === null ? null : new Set([direct.name]));
        continue;
      }
      for (const [key, { target }] of reexports) {
        if (!key.startsWith("*")) continue;
        const exports = moduleInfo(target)?.exports ?? [];
        if (barrelOf(target) !== null || exports.includes(name) || exports.includes("*")) {
          visit(target, new Set([name]));
        }
      }
    }
  };

  visit(entry, null);
  return reached;
}

// A barrel that may have side effects stays in the output, importing all it re-exports. Outside
// the group it sits between a startup module and the startup modules it re-exports: a chunk
// cycle. So add every module on a static path from the group back into it.
export function cycleMembers(
  group: ReadonlySet<string>,
  fixed: ReadonlySet<string>,
  moduleInfo: (id: string) => GraphModule | null,
): Set<string> {
  const barrelOf = barrelLookup(moduleInfo);
  const kept = (id: string) => moduleInfo(id)?.moduleSideEffects !== false;

  // Where an import of `name` from `barrel` lands once the bundler rewrites it past the barrel.
  const resolve = (barrel: string, name: string, out: Set<string>, seen: Set<string>) => {
    if (seen.has(`${barrel}\0${name}`)) return;
    seen.add(`${barrel}\0${name}`);
    if (kept(barrel)) out.add(barrel);
    const reexports = barrelOf(barrel) ?? new Map();
    const land = (target: string, imported: string | null) => {
      if (imported === null || barrelOf(target) === null) out.add(target);
      else resolve(target, imported, out, seen);
    };
    const direct = reexports.get(name);
    if (direct !== undefined) return land(direct.target, direct.name);
    for (const [key, { target }] of reexports) {
      if (!key.startsWith("*")) continue;
      const exports = moduleInfo(target)?.exports ?? [];
      if (barrelOf(target) !== null || exports.includes(name) || exports.includes("*")) {
        land(target, name);
      }
    }
  };

  const edges = new Map<string, Set<string>>();
  const edgesOf = (id: string) => {
    const known = edges.get(id);
    if (known !== undefined) return known;
    const out = new Set<string>();
    edges.set(id, out);
    const module = moduleInfo(id);
    const reexports = barrelOf(id);
    if (reexports !== null) {
      for (const { target } of reexports.values()) out.add(target);
      return out;
    }
    const asked = module?.code ? importsOf(module.code) : null;
    for (const imported of module?.importedIds ?? []) {
      const whole =
        asked === null ||
        barrelOf(imported) === null ||
        asked.namespaces.some((spec) => isSpecifierOf(imported, spec));
      if (whole) out.add(imported);
      else for (const name of asked.names) resolve(imported, name, out, new Set());
    }
    return out;
  };

  const outside = new Set<string>();
  const pending = [...group];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    for (const next of edgesOf(id)) {
      if (group.has(next) || fixed.has(next) || outside.has(next)) continue;
      outside.add(next);
      pending.push(next);
    }
  }
  const onCycle = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of outside) {
      if (onCycle.has(id)) continue;
      if ([...edgesOf(id)].some((next) => group.has(next) || onCycle.has(next))) {
        onCycle.add(id);
        grew = true;
      }
    }
  }
  return onCycle;
}

// Rolldown applies package.json `sideEffects` but reports only what plugins set, so read it here.
const packageJsons = new Map<string, { sideEffects?: unknown; name?: unknown } | null>();
function declaredSideEffects(id: string): boolean | null {
  const file = normalize(id).split("?")[0] ?? "";
  for (let dir = NodePath.posix.dirname(file); ; dir = NodePath.posix.dirname(dir)) {
    if (!packageJsons.has(dir)) {
      const path = `${dir}/package.json`;
      packageJsons.set(
        dir,
        NodeFS.existsSync(path) ? JSON.parse(NodeFS.readFileSync(path, "utf8")) : null,
      );
    }
    const pkg = packageJsons.get(dir);
    if (pkg != null && (pkg.name !== undefined || pkg.sideEffects !== undefined)) {
      const { sideEffects } = pkg;
      if (sideEffects === false) return false;
      if (!Array.isArray(sideEffects)) return null;
      const relative = NodePath.posix.relative(dir, file);
      return sideEffects.some(
        (pattern: unknown) =>
          typeof pattern === "string" &&
          NodePath.posix.matchesGlob(
            relative,
            pattern.includes("/") ? pattern.replace(/^\.\//, "") : `**/${pattern}`,
          ),
      );
    }
    if (NodePath.posix.dirname(dir) === dir) return null;
  }
}

// Everything main.tsx imports statically loads at startup anyway, but its modules are spread over
// ~200 tiny chunks by which lazy features share them. Grouping them costs no bytes, only requests.
export function startupChunks() {
  const modules = new Set<string>();
  const plugin: Plugin = {
    name: "t3code:startup-chunks",
    apply: "build",
    buildEnd() {
      const ids = [...this.getModuleIds()];
      const find = (suffix: string) => ids.find((id) => normalize(id).endsWith(suffix));
      const infos = new Map<string, GraphModule | null>();
      const moduleInfo = (id: string) => {
        if (!infos.has(id)) {
          const info = this.getModuleInfo(id);
          infos.set(
            id,
            info === null
              ? null
              : {
                  code: info.code,
                  importedIds: info.importedIds,
                  exports: info.exports,
                  moduleSideEffects: info.moduleSideEffects ?? declaredSideEffects(id),
                },
          );
        }
        return infos.get(id) ?? null;
      };
      const reach = (suffix: string) => {
        const entry = find(suffix);
        return entry === undefined ? new Set<string>() : staticallyReached(entry, moduleInfo);
      };
      // The HTML entry's own modules stay out, or it would import the app before it may start.
      const bootstrap = reach("/src/bootstrap.ts");
      modules.clear();
      for (const id of reach("/src/main.tsx")) if (!bootstrap.has(id)) modules.add(id);
      for (const id of cycleMembers(modules, bootstrap, moduleInfo)) modules.add(id);
    },
  };
  const isOurs = (id: string) =>
    !/[\\/]node_modules[\\/]/.test(id) && /[\\/](apps|packages)[\\/]/.test(id);
  // One CSS file keeps the cascade order; vendor code never imports ours, so no chunk cycle.
  const groups = [
    {
      name: "startup",
      test: (id: string) => modules.has(id) && (isOurs(id) || /\.css($|\?)/.test(id)),
    },
    { name: "startup-vendor", test: (id: string) => modules.has(id) },
  ];
  // The set is already closed under imports; following them again would pull in the HTML entry's.
  return { plugin, codeSplitting: { includeDependenciesRecursively: false, groups } };
}
