import { statSync } from "node:fs";
import path from "node:path";
import type { Candidate, CommandResult, QueryPlan, SrcwalkCommand } from "../domain/types.js";
import { commandDisplay, extractTarget, makeCmd, strongestSymbol } from "../router/intent.js";
import { isEmptyResult } from "./runner.js";

const CONTEXT_NEXT_RE = /> Next: srcwalk context (?<target>[^\s`]+)/;
const SHOW_NEXT_RE = /> Next: srcwalk show (?<target>[^\s`]+)(?:\s+-C\s+\d+)?/;
const DEF_INLINE_RE = /\[(?<kind>[^\]]+)\]\s+(?<symbol>[A-Za-z_][\w]*)\s+(?<target>[\w./-]+\.\w+:\d+(?:-\d+)?)/;
const DEF_GROUP_FILE_RE = /^\s{2}(?<file>[\w./-]+\.\w+)\s+\[\d+ matches\]/;
const DEF_GROUP_ITEM_RE = /^\s{4}\[(?<kind>[^\]]+)\]\s+(?<symbol>[A-Za-z_][\w]*)\s+:(?<range>\d+(?:-\d+)?)/;
const TEXT_RANK_FILE_RE = /^(?<file>[\w./-]+\.\w+)\s+—\s+(?<terms>\d+) terms?,/;
const SYMBOL_FROM_CONTEXT_RE = /^-\s+[\w./-]+\.\w+:\d+(?:-\d+)?\s+(?<symbol>[A-Za-z_][\w]*)$/m;
const OVERVIEW_FILE_RE = /(?<![\w./-])(?<file>(?:\.{1,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.[A-Za-z0-9]{1,12})(?::(?<range>\d+(?:-\d+)?))?/g;
const OVERVIEW_LINE_RANGE_RE = /\[(?<range>\d+(?:-\d+)?)\]/;
const MAX_OVERVIEW_CANDIDATES = 20;

export function candidateFile(candidate: Pick<Candidate, "target">): string {
  return candidate.target.split(":", 1)[0]!;
}

function addCandidate(candidates: Map<string, Candidate>, candidate: Candidate): void {
  const existing = candidates.get(candidate.target);
  if (!existing) {
    candidates.set(candidate.target, candidate);
    return;
  }
  existing.score = Math.max(existing.score, candidate.score);
  existing.evidence.push(...candidate.evidence.filter((e) => !existing.evidence.includes(e)));
  if (!existing.symbol && candidate.symbol) existing.symbol = candidate.symbol;
  if (existing.kind === "unknown" && candidate.kind !== "unknown") existing.kind = candidate.kind;
}

export function parseCandidates(result: CommandResult): Candidate[] {
  const candidates = new Map<string, Candidate>();
  let currentGroupFile: string | undefined;
  for (const line of result.output.split("\n")) {
    const group = line.match(DEF_GROUP_FILE_RE);
    if (group?.groups?.file) {
      currentGroupFile = group.groups.file;
      continue;
    }
    const item = currentGroupFile ? line.match(DEF_GROUP_ITEM_RE) : undefined;
    if (item?.groups) {
      addCandidate(candidates, { target: `${currentGroupFile}:${item.groups.range}`, source: "grouped-definition", commandLabel: result.command.label, kind: item.groups.kind!, symbol: item.groups.symbol, score: 45, evidence: [line.trim()] });
      continue;
    }
    const inline = line.match(DEF_INLINE_RE);
    if (inline?.groups) {
      addCandidate(candidates, { target: inline.groups.target!, source: "definition", commandLabel: result.command.label, kind: inline.groups.kind!, symbol: inline.groups.symbol, score: 70, evidence: [line.trim()] });
      continue;
    }
    const context = line.match(CONTEXT_NEXT_RE);
    if (context?.groups?.target) {
      addCandidate(candidates, { target: context.groups.target, source: "next-context", commandLabel: result.command.label, kind: "context", score: 60, evidence: [line.trim()] });
      continue;
    }
    const show = line.match(SHOW_NEXT_RE);
    if (show?.groups?.target) {
      addCandidate(candidates, { target: show.groups.target, source: "next-show", commandLabel: result.command.label, kind: "show", score: 45, evidence: [line.trim()] });
      continue;
    }
    const textRank = line.match(TEXT_RANK_FILE_RE);
    if (textRank?.groups?.file) {
      const terms = Number(textRank.groups.terms ?? 1);
      addCandidate(candidates, { target: `${textRank.groups.file}:1`, source: "text-file", commandLabel: result.command.label, kind: "file", score: 35 + terms * 3, evidence: [line.trim()] });
    }
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score);
}

function overviewFileTarget(repo: string, scope: string, rawFile: string): string | undefined {
  if (path.isAbsolute(rawFile) || rawFile.startsWith("../")) return undefined;
  const repoRoot = path.resolve(repo);
  const scopeRoot = path.resolve(repoRoot, scope || ".");
  const candidates = rawFile.includes("/")
    ? [path.resolve(repoRoot, rawFile), path.resolve(scopeRoot, rawFile)]
    : [path.resolve(scopeRoot, rawFile), path.resolve(repoRoot, rawFile)];
  const seen = new Set<string>();
  for (const absolute of candidates) {
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    const relative = path.relative(repoRoot, absolute);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) continue;
    try {
      if (!statSync(absolute).isFile()) continue;
    } catch {
      continue;
    }
    return relative.split(path.sep).join("/");
  }
  return undefined;
}

function validOverviewRange(rawRange: string | undefined): string | undefined {
  if (!rawRange) return "1";
  const [start, end = start] = rawRange.split("-").map(Number);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return undefined;
  return rawRange;
}

export function parseOverviewCandidates(result: CommandResult, repo: string, scope: string, limit = 10): Candidate[] {
  if (result.code !== 0 || result.command.parseAs !== "overview" || !result.output.trim()) return [];
  const max = Math.max(1, Math.min(limit, MAX_OVERVIEW_CANDIDATES));
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const rawLine of result.output.split("\n")) {
    const line = rawLine.trim();
    const lineRange = line.match(OVERVIEW_LINE_RANGE_RE)?.groups?.range;
    for (const match of line.matchAll(OVERVIEW_FILE_RE)) {
      const rawFile = match.groups?.file;
      if (!rawFile) continue;
      const file = overviewFileTarget(repo, scope, rawFile);
      if (!file) continue;
      const range = validOverviewRange(match.groups?.range ?? lineRange);
      if (!range) continue;
      const target = `${file}:${range}`;
      if (seen.has(target)) continue;
      seen.add(target);
      candidates.push({
        target,
        source: "overview",
        commandLabel: result.command.label,
        kind: range === "1" ? "file" : "section",
        score: range === "1" ? 60 : 70,
        evidence: [line.slice(0, 240)],
      });
      if (candidates.length >= max) return candidates;
    }
  }
  return candidates;
}

export function parseFileDiscoverCandidates(result: CommandResult): Candidate[] {
  if (!commandDisplay(result.command).includes("--as file") && result.command.parseAs !== "discover") return [];
  const out: Candidate[] = [];
  let currentDir: string | undefined;
  for (const raw of result.output.split("\n")) {
    const stripped = raw.trim();
    if (!stripped || stripped.startsWith("#") || stripped.startsWith(">")) continue;
    if (stripped.endsWith(")") && stripped.includes("/") && !raw.startsWith("  ")) {
      const maybeDir = stripped.split(" ", 1)[0];
      if (maybeDir?.endsWith("/")) currentDir = maybeDir;
      continue;
    }
    if (currentDir && raw.startsWith("  ") && stripped.includes(".")) {
      const name = stripped.split(" ", 1)[0]!;
      out.push({ target: `${currentDir}${name}:1`, source: "file-discover", commandLabel: result.command.label, kind: "file", score: 58, evidence: [stripped] });
    }
  }
  return out;
}

export function parseSymbolFromContext(output: string): string | undefined {
  return output.match(SYMBOL_FROM_CONTEXT_RE)?.groups?.symbol;
}

export function candidateToContextCmd(candidate: Candidate, scope: string): SrcwalkCommand {
  return makeCmd(`context:${candidate.target}`, ["context", candidate.target, "--scope", scope, "--budget", "5000"], "expand candidate context", "context");
}

export function candidateToShowCmd(candidate: Candidate): SrcwalkCommand {
  return makeCmd(`show:${candidate.target}`, ["show", candidate.target, "-C", "12", "--budget", "5000"], "fallback exact show", "show");
}

export function traceCmd(kind: "callers" | "callees", symbol: string, scope: string): SrcwalkCommand {
  return makeCmd(`trace-${kind}:${symbol}`, ["trace", kind, symbol, "--scope", scope, "--budget", "5000"], `${kind} trace`, "trace");
}

export function depsCmd(file: string, budget = "5000"): SrcwalkCommand {
  return makeCmd(`deps:${file}`, ["deps", file, "--budget", budget], "file dependency evidence", "deps");
}

export function assessCmd(symbol: string, scope: string): SrcwalkCommand {
  return makeCmd(`assess:${symbol}`, ["assess", symbol, "--scope", scope, "--budget", "5000"], "blast radius assessment", "assess");
}

export function synthesizeCandidateFromCommand(result: CommandResult, plan: QueryPlan): Candidate[] {
  const out: Candidate[] = [];
  if (result.command.label === "target-context") {
    const target = extractTarget(commandDisplay(result.command));
    if (target) out.push({ target, source: "exact-context", commandLabel: result.command.label, kind: "context-target", symbol: parseSymbolFromContext(result.output), score: 120, evidence: ["exact target context"] });
  }
  if (result.command.parseAs === "context" && !out.length) {
    const target = extractTarget(commandDisplay(result.command));
    if (target) out.push({ target, source: "exact-context", commandLabel: result.command.label, kind: "context-target", symbol: parseSymbolFromContext(result.output), score: 80, evidence: ["exact target context"] });
  }
  if (result.command.parseAs === "show" && !isEmptyResult(result)) {
    const arg = result.command.args[2] ?? "file";
    out.push({ target: arg.includes(":") ? arg : `${arg}:1`, source: "file-show", commandLabel: result.command.label, kind: "file", score: 65, evidence: ["exact file show"] });
  }
  if (result.command.parseAs === "deps" && !isEmptyResult(result)) {
    const arg = result.command.args[2] ?? "file";
    out.push({ target: arg.includes(":") ? arg : `${arg}:1`, source: "file-deps", commandLabel: result.command.label, kind: "file", score: 70, evidence: ["exact file deps"] });
  }
  return out;
}

export function fallbackSymbol(plan: QueryPlan, top?: Candidate): string | undefined {
  return top?.symbol || strongestSymbol(plan.query, plan.keywords);
}
