export type ModuleLoader<T> = () => Promise<T>;

export function createModuleLoadGuard<T>(load: ModuleLoader<T>): () => Promise<T> {
  let ready: Promise<T> | undefined;
  return async () => {
    if (!ready) {
      ready = load().catch((error: unknown) => {
        ready = undefined;
        throw error;
      });
    }
    return await ready;
  };
}

export interface RuntimeModules {
  runner: typeof import("../srcwalk/runner.js");
  engine: typeof import("../engine.js");
  grep: typeof import("../grep/semantic-grep.js");
  format: typeof import("../output/format.js");
  truncate: typeof import("../output/truncate.js");
  router: typeof import("../router/intent.js");
  parser: typeof import("../srcwalk/parse.js");
}

async function loadRuntimeModules(): Promise<RuntimeModules> {
  // Pi/Jiti may run with moduleCache disabled. Retain each namespace so concurrent
  // tool calls share both initialization and the modules used for execution.
  const runner = await import("../srcwalk/runner.js");
  const engine = await import("../engine.js");
  const grep = await import("../grep/semantic-grep.js");
  const format = await import("../output/format.js");
  const truncate = await import("../output/truncate.js");
  const router = await import("../router/intent.js");
  const parser = await import("../srcwalk/parse.js");
  return { runner, engine, grep, format, truncate, router, parser };
}

export const getRuntimeModules = createModuleLoadGuard(loadRuntimeModules);
