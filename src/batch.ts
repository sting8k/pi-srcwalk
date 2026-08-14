import { performance } from "node:perf_hooks";
import { findShellMetachar, normalizeSrcwalkArgs } from "./args.js";
import { runSrcwalk, type SrcwalkResult } from "./runner.js";

export const MAX_BATCH_COMMANDS = 6;
export const BATCH_CONCURRENCY = 3;

export interface PlannedCommand {
  raw: string;
  tokens: string[];
}

export type BatchPlan = { commands: PlannedCommand[] } | { error: string };

/**
 * Validate and normalize a tool call's `args` into independent srcwalk
 * command lines. Accepts a single string (unchanged behavior) or an array of
 * up to MAX_BATCH_COMMANDS strings. Rejects shell metacharacters outside
 * quotes — the tool never runs a shell; batching is the replacement for
 * shell chaining.
 */
export function planBatch(args: string | string[]): BatchPlan {
  const raws = Array.isArray(args) ? args : [args];

  if (raws.length === 0) {
    return { error: "No srcwalk arguments provided. Run `srcwalk guide` or `srcwalk --help` for usage." };
  }
  if (raws.length > MAX_BATCH_COMMANDS) {
    return {
      error:
        `Too many commands: ${raws.length} (max ${MAX_BATCH_COMMANDS} per call). ` +
        "Batch independent lookups in one call; dependent follow-ups go in the next call.",
    };
  }

  const commands: PlannedCommand[] = [];
  for (const raw of raws) {
    const meta = findShellMetachar(raw);
    if (meta !== undefined) {
      return {
        error:
          `Shell metacharacter '${meta}' in command "${raw}" is not supported — no shell. ` +
          "Pass multiple commands as an array instead.",
      };
    }
    const normalized = normalizeSrcwalkArgs(raw);
    if ("error" in normalized) {
      return { error: `Command "${raw}": ${normalized.error}` };
    }
    commands.push({ raw, tokens: normalized.tokens });
  }
  return { commands };
}

export interface BatchCommandResult {
  raw: string;
  result: SrcwalkResult;
}

export interface BatchResult {
  results: BatchCommandResult[];
  totalElapsedMs: number;
}

/**
 * Run planned commands with bounded concurrency, preserving input order in
 * the result array. All commands always run — no fail-fast, since batch
 * commands are independent read-only lookups.
 */
export async function runBatch(
  cwd: string,
  commands: PlannedCommand[],
  signal?: AbortSignal,
  timeoutMs = 45_000,
): Promise<BatchResult> {
  const started = performance.now();
  const results = await mapWithConcurrency(commands, BATCH_CONCURRENCY, (cmd) =>
    runSrcwalk(cwd, cmd.tokens, signal, timeoutMs),
  );
  return {
    results: commands.map((cmd, i) => ({ raw: cmd.raw, result: results[i]! })),
    totalElapsedMs: Math.round(performance.now() - started),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}
