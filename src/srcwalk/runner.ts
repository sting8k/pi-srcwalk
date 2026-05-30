import { spawn } from "node:child_process";
import type { CommandResult, SrcwalkCommand } from "../domain/types.js";

export async function runCommand(repo: string, command: SrcwalkCommand, signal?: AbortSignal, timeoutMs = 45_000): Promise<CommandResult> {
  const started = performance.now();
  return await new Promise<CommandResult>((resolve) => {
    const child = spawn(command.args[0]!, command.args.slice(1), { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const errs: Buffer[] = [];
    let settled = false;
    const finish = (code: number, extra = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      const output = Buffer.concat(chunks).toString("utf8") + Buffer.concat(errs).toString("utf8") + extra;
      resolve({ command, output, code, elapsedMs: Math.round(performance.now() - started), matchCount: parseMatchCount(output) });
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
    child.stdout?.on("data", (d) => chunks.push(Buffer.from(d)));
    child.stderr?.on("data", (d) => errs.push(Buffer.from(d)));
    child.on("error", (err) => finish(-1, `\n${err.message}`));
    child.on("close", (code) => finish(code ?? 0));
  });
}

export function parseMatchCount(output: string): number | undefined {
  const m = output.match(/(?:—|,)\s*(?<count>\d+) matches/);
  return m?.groups?.count ? Number(m.groups.count) : undefined;
}

export function isEmptyResult(result: CommandResult): boolean {
  const out = result.output.trim();
  return result.code !== 0 || out.length < 40 || /no matches|0 matches/i.test(out);
}
