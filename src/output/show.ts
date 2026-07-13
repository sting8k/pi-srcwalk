export const MAX_SHOW_TARGETS = 3;

const SHOW_TARGET_RE = /^[\w./-]+\.\w+:\d+(?:-\d+)?$/;
const SHOW_OUTPUT_MAX_CHARS = 12_000;

export interface ShowTargetSplit {
  targets?: string[];
  error?: string;
}

function isValidShowTarget(target: string): boolean {
  const range = target.slice(target.lastIndexOf(":") + 1).split("-").map(Number);
  const start = range[0];
  const end = range[1] ?? start;
  return SHOW_TARGET_RE.test(target) && Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start;
}

export function splitShowTargets(input: string, maxTargets = MAX_SHOW_TARGETS): ShowTargetSplit {
  const rawTargets = input.split(",").map((target) => target.trim());
  if (!rawTargets.length || rawTargets.some((target) => !target)) return { error: "targets must be non-empty comma-separated path:line values." };
  if (rawTargets.length > maxTargets) return { error: `max ${maxTargets} targets, got ${rawTargets.length}.` };
  if (rawTargets.length > 1 && rawTargets.some((target) => !isValidShowTarget(target))) {
    return { error: "multi-target show requires each target to match path:line or path:start-end." };
  }
  return { targets: rawTargets };
}

function requestedRange(target: string): { start: number; end: number } | undefined {
  const match = target.match(SHOW_TARGET_RE);
  if (!match) return undefined;
  const range = target.slice(target.lastIndexOf(":") + 1).split("-").map(Number);
  const start = range[0];
  const end = range[1] ?? start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return undefined;
  return { start, end };
}

function shownLineNumbers(output: string): Set<number> {
  const lines = new Set<number>();
  for (const line of output.split("\n")) {
    const match = line.match(/^\s*(\d+)(?:\s+|\||-)/);
    if (match?.[1]) lines.add(Number(match[1]));
  }
  return lines;
}

export function showTargetIsExact(target: string, output: string): boolean {
  const trimmed = output.trim();
  if (!trimmed || /\[(?:outline|caveat)\]/i.test(trimmed) || /drill into a symbol|need raw file text/i.test(trimmed)) return false;
  const range = requestedRange(target);
  if (!range) return true;
  if (range.end - range.start > 5_000) return false;
  const lines = shownLineNumbers(trimmed);
  for (let line = range.start; line <= range.end; line += 1) {
    if (!lines.has(line)) return false;
  }
  return true;
}

export function showTargetStatus(target: string, code: number, output: string): string {
  if (code !== 0) return `code=${code}`;
  return showTargetIsExact(target, output) ? "ok" : "degraded (non-exact output)";
}

export function boundShowOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= SHOW_OUTPUT_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, SHOW_OUTPUT_MAX_CHARS)}\n... (target output truncated)`;
}
