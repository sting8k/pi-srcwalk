import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

export interface SrcwalkResult {
  output: string;
  exitCode: number;
  elapsedMs: number;
  /** True when the srcwalk binary itself could not be spawned (not on PATH). */
  binaryNotFound: boolean;
}

/**
 * Run the `srcwalk` CLI directly with argv tokens, without a shell.
 *
 * stdout and stderr are concatenated (stderr appended after stdout, matching
 * the old semantic engine behavior). Partial output is preserved on abort or
 * timeout so the agent still sees what was produced.
 */
export async function runSrcwalk(
  cwd: string,
  args: string[],
  signal?: AbortSignal,
  timeoutMs = 45_000,
): Promise<SrcwalkResult> {
  const started = performance.now();

  // An already-aborted signal never fires the abort listener in Node — bail
  // before spawning instead of letting the child run to completion.
  if (signal?.aborted) {
    return { output: "\nCommand aborted", exitCode: -1, elapsedMs: 0, binaryNotFound: false };
  }

  return await new Promise<SrcwalkResult>((resolve) => {
    const child = spawn("srcwalk", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    const finish = (exitCode: number, extra = "", binaryNotFound = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      const output = Buffer.concat(stdout).toString("utf8") + Buffer.concat(stderr).toString("utf8") + extra;
      resolve({ output, exitCode, elapsedMs: Math.round(performance.now() - started), binaryNotFound });
    };

    const abort = () => {
      child.kill("SIGTERM");
      finish(-1, "\nCommand aborted");
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(-1, "\nCommand timed out");
    }, timeoutMs);

    signal?.addEventListener("abort", abort, { once: true });
    child.stdout?.on("data", (d) => stdout.push(Buffer.from(d)));
    child.stderr?.on("data", (d) => stderr.push(Buffer.from(d)));
    child.on("error", (err) => {
      const notFound = (err as NodeJS.ErrnoException).code === "ENOENT";
      finish(-1, notFound ? "" : `\n${err.message}`, notFound);
    });
    child.on("close", (code) => finish(code ?? 0));
  });
}
