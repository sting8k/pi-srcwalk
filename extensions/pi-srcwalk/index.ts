import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { executeSearch } from "../../src/engine.js";
import type { SrcwalkCommand } from "../../src/domain/types.js";
import { formatResult } from "../../src/output/format.js";
import { truncateForTool } from "../../src/output/truncate.js";
import { commandDisplay } from "../../src/router/intent.js";
import { runCommand } from "../../src/srcwalk/runner.js";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const SearchParams = Type.Object({
  query: Type.String({ description: "What to find: natural-language question, symbol, file, path:line, overview, deps, or tests. Use semantic_inspect for known-symbol callers/callees/references." }),
  scope: Type.Optional(Type.String({ description: "One repo-relative dir/file to limit search; omit or use '.' for repo root. Examples: 'src', 'src/index/cache.ts'. Not glob, symbol, path:line, absolute path, or multi-scope." })),
});

const ReviewParams = Type.Object({
  target: Type.Optional(Type.String({ description: "Changes to review: 'staged' (default) or 'working-tree'." })),
  scope: Type.Optional(Type.String({ description: "One repo-relative dir/file to limit review evidence; omit or use '.' for whole diff. Examples: 'src', 'src/index/cache.ts'. Not glob, absolute path, or multi-scope." })),
});

const ShowParams = Type.Object({
  search_id: Type.Optional(Type.String({ description: "ID from semantic_search. Use with candidate_id." })),
  inspect_id: Type.Optional(Type.String({ description: "ID from semantic_inspect. Use with candidate_id." })),
  candidate_id: Type.Optional(Type.Number({ description: "1-based candidate number from semantic_search or semantic_inspect." })),
  target: Type.Optional(Type.String({ description: "Direct path:line target, e.g. 'src/index/cache.ts:154-259'. Stateless alternative to id+candidate_id." })),
  mode: Type.Optional(Type.String({ description: "Output mode: 'context' (default, with flow map and call neighborhood) or 'show' (raw code with context lines)." })),
  scope: Type.Optional(Type.String({ description: "Override scope for context mode. Defaults to the stored result scope, or '.' if using direct target." })),
});

const InspectParams = Type.Object({
  symbol: Type.String({ description: "Exact symbol name, not natural language (e.g. 'buildOrLoadIndex')." }),
  relation: Type.Optional(Type.String({ description: "What to show: 'all' (default), 'callers', 'callees', or 'references'." })),
  scope: Type.Optional(Type.String({ description: "One repo-relative dir/file to limit search; omit or use '.' for repo root. File scopes are widened to their parent directory for callers/callees trace commands." })),
  limit: Type.Optional(Type.Number({ description: "Max results per section (default: 20)." })),
});


interface ThemeLike {
  fg(role: string, text: string): string;
  bold(text: string): string;
}

interface ToolResultLike {
  content: Array<{ type: string; text?: string }>;
  details?: unknown;
}

interface SemanticSearchDetails {
  searchId?: string;
  query: string;
  scope: string;
  confidence: { abstained: boolean; level: string; reason: string };
  candidates: Array<{ id?: number; target: string; symbol?: string; score: number; source: string; kind: string }>;
  cache?: { cacheKind: string; cacheHit: boolean; chunks: number; files: number; cacheLocation: string };
  truncated?: boolean;
  fullOutputPath?: string;
}


interface SemanticInspectDetails {
  inspectId: string;
  symbol: string;
  relation: string;
  scope: string;
  candidates: Array<{ id?: number; target: string; symbol?: string }>;
  truncated?: boolean;
  fullOutputPath?: string;
}

// === Search Registry (for semantic_show) ===
interface CandidateRecord {
  target: string;
  symbol?: string;
}

interface SearchRecord {
  repo: string;
  scope: string;
  candidates: CandidateRecord[];
  createdAt: number;
  lastAccess: number;
}

const recentSearches = new Map<string, SearchRecord>();
const MAX_RECENT_SEARCHES = 25;
const SEARCH_TTL_MS = 30 * 60 * 1000;
const repoSearchSeq = new Map<string, number>();

function repoKey(repo: string): string {
  return crypto
    .createHash("sha256")
    .update(path.resolve(repo))
    .digest("hex")
    .slice(0, 5);
}

function nextSearchId(repo: string): string {
  const rk = repoKey(repo);
  const next = (repoSearchSeq.get(rk) ?? 0) + 1;
  repoSearchSeq.set(rk, next);
  return `r${rk}-s${next.toString(36)}`;
}

function cleanupSearches(): void {
  const now = Date.now();
  for (const [id, record] of recentSearches) {
    if (now - record.createdAt > SEARCH_TTL_MS) recentSearches.delete(id);
  }
  if (recentSearches.size > MAX_RECENT_SEARCHES) {
    const sorted = [...recentSearches.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    for (let i = 0; i < sorted.length - MAX_RECENT_SEARCHES; i++) {
      recentSearches.delete(sorted[i]![0]);
    }
  }
}

const inspectSearchSeq = new Map<string, number>();

function nextInspectId(repo: string): string {
  const rk = repoKey(repo);
  const next = (inspectSearchSeq.get(rk) ?? 0) + 1;
  inspectSearchSeq.set(rk, next);
  return `r${rk}-u${next.toString(36)}`;
}

const INSPECT_TARGET_RE = /[\w./-]+\.\w+:\d+(?:-\d+)?/g;
const INSPECT_GROUP_FILE_RE = /^(?:#+\s*)?(?<file>[\w./-]+\.\w+)\s+\[\d+\s+(?:usages?|matches?)\]/;
const INSPECT_GROUP_LINE_RE = /^(?:-\s*)?(?:\[[^\]]+\]\s*)?:(?<range>\d+(?:-\d+)?)(?:\s|$)/;

function addInspectTarget(targets: string[], seen: Set<string>, target: string): void {
  if (seen.has(target)) return;
  seen.add(target);
  targets.push(target);
}

function parseInspectTargets(output: string): string[] {
  const targets: string[] = [];
  const seen = new Set<string>();
  let currentFile: string | undefined;
  for (const raw of output.split("\n")) {
    const line = raw.trim();
    for (const m of line.matchAll(INSPECT_TARGET_RE)) addInspectTarget(targets, seen, m[0]);

    const group = line.match(INSPECT_GROUP_FILE_RE);
    if (group?.groups?.file) {
      currentFile = group.groups.file;
      continue;
    }

    const groupedLine = currentFile ? line.match(INSPECT_GROUP_LINE_RE) : undefined;
    if (groupedLine?.groups?.range) addInspectTarget(targets, seen, `${currentFile}:${groupedLine.groups.range}`);
  }
  return targets;
}

function inspectNeedsTrace(relation: string): boolean {
  return relation === "all" || relation === "callers" || relation === "callees";
}

function isFileScope(repo: string, scope: string): boolean {
  if (scope === ".") return false;
  try {
    return fs.statSync(path.resolve(repo, scope)).isFile();
  } catch {
    return Boolean(path.extname(scope));
  }
}

function parentScope(scope: string): string {
  const parent = path.dirname(scope);
  return parent === "." ? "." : parent;
}

function traceScopeForInspect(repo: string, scope: string, relation: string): string {
  return inspectNeedsTrace(relation) && isFileScope(repo, scope) ? parentScope(scope) : scope;
}

function inspectCommands(symbol: string, relation: string, scope: string, traceScope: string, limit: number): SrcwalkCommand[] {
  const cmds: SrcwalkCommand[] = [];
  if (relation === "all" || relation === "callers") {
    cmds.push({ label: `trace-callers:${symbol}`, args: ["srcwalk", "trace", "callers", symbol, "--scope", traceScope, "--limit", String(limit), "--budget", "5000"], purpose: "trace callers", parseAs: "trace" });
  }
  if (relation === "all" || relation === "callees") {
    cmds.push({ label: `trace-callees:${symbol}`, args: ["srcwalk", "trace", "callees", symbol, "--scope", traceScope, "--detailed", "--budget", "5000"], purpose: "trace callees", parseAs: "trace" });
  }
  if (relation === "all" || relation === "references") {
    cmds.push({ label: `discover:${symbol}`, args: ["srcwalk", "discover", symbol, "--as", "symbol", "--scope", scope, "--limit", String(limit), "--budget", "5000"], purpose: "discover references", parseAs: "discover" });
  }
  return cmds;
}

function formatInspectPacket(repo: string, symbol: string, relation: string, scope: string, traceScope: string, results: Array<{ code: number; output: string; command: SrcwalkCommand }>): string {
  const sections = [`# semantic-inspect: ${symbol}`, `repo: ${repo}`, `relation: ${relation}`, `scope: ${scope}`];
  if (traceScope !== scope) sections.push(`trace_scope: ${traceScope} (file scope adjusted for callers/callees)`);
  sections.push("");
  for (const r of results) {
    const label = r.command.label;
    const isCallers = label.startsWith("trace-callers");
    const isCallees = label.startsWith("trace-callees");
    const section = isCallers ? "Callers" : isCallees ? "Callees" : "References";
    sections.push(`## ${section}`);
    const out = r.output.trim();
    if (r.code !== 0) {
      sections.push(`(command failed code=${r.code})`);
    } else if (out) {
      sections.push(out);
    } else {
      sections.push("(none)");
    }
    sections.push("");
  }
  return sections.join("\n");
}

type ReviewTarget = "staged" | "working-tree";

interface SemanticReviewDetails {
  target: ReviewTarget;
  scope: string;
  code: number;
  elapsedMs: number;
  changedFiles?: number;
  shownFiles?: number;
  changedHunks?: number;
  changedSymbols?: number;
  truncated?: boolean;
  fullOutputPath?: string;
}

function normalizeReviewTarget(target?: string): ReviewTarget {
  const normalized = target?.trim().toLowerCase();
  return normalized === "working-tree" || normalized === "worktree" || normalized === "working" ? "working-tree" : "staged";
}

function reviewCommand(target: ReviewTarget, scope: string): SrcwalkCommand {
  const args = ["srcwalk", "review"];
  if (target === "staged") args.push("--staged");
  if (scope.trim()) args.push("--scope", scope.trim());
  args.push("--limit", "8", "--budget", "7000");
  return { label: target === "staged" ? "review:staged" : "review:working-tree", args, purpose: "review current code changes", parseAs: "review" };
}

function parseReviewDetails(output: string): Pick<SemanticReviewDetails, "changedFiles" | "shownFiles" | "changedHunks" | "changedSymbols"> {
  const files = output.match(/files: changed=(\d+) shown=(\d+)/);
  const hunks = output.match(/hunks: total=(\d+) shown=(\d+)/);
  const symbols = output.match(/symbols: total=(\d+) shown=(\d+)/);
  return {
    changedFiles: files ? Number(files[1]) : undefined,
    shownFiles: files ? Number(files[2]) : undefined,
    changedHunks: hunks ? Number(hunks[1]) : undefined,
    changedSymbols: symbols ? Number(symbols[1]) : undefined,
  };
}

function formatReviewPacket(repo: string, target: ReviewTarget, scope: string, result: { code: number; elapsedMs: number; output: string; command: SrcwalkCommand }): string {
  const status = result.code === 0 ? "ok" : `code=${result.code}`;
  return [
    `# semantic-review: ${target}`,
    `repo: ${repo}`,
    `scope: ${scope}`,
    "",
    "## Command",
    `- [${status}, ${result.elapsedMs}ms] ${commandDisplay(result.command)}`,
    "",
    "## Review evidence",
    "```text",
    result.output.trim() || "(no review output)",
    "```",
    "",
  ].join("\n");
}

export default function piSrcwalkExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "semantic_search",
    label: "Semantic Search",
    description: "Discover ranked code evidence when the exact target is unknown: natural-language questions, files, symbols, overviews, deps, and tests.",
    promptSnippet: "Discover ranked code evidence with semantic_search",
    promptGuidelines: [
      "Use semantic_search for discovery when the target or symbol is unknown or ambiguous.",
      "Prefer semantic_inspect when the user names a concrete symbol and asks for callers, callees, or references.",
      "Set scope only to one repo-relative dir/file when known; put symbols and path:line targets in query.",
      "Treat confidence and returned targets as bounded evidence; verify exact ranges before detailed claims or edits.",
    ],
    parameters: SearchParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      return { query: input.query, scope: input.scope };
    },
    async execute(_toolCallId: string, params: { query: string; scope?: string }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      onUpdate?.({ content: [{ type: "text", text: "Running semantic_search..." }] });
      const result = await executeSearch({
        query: params.query,
        repo: ctx.cwd,
        scope: params.scope ?? ".",
        maxResults: 3,
        detail: "normal",
        signal,
      });

      // Generate search ID & store in registry
      cleanupSearches();
      const searchId = nextSearchId(ctx.cwd);
      const candidatesWithIds = result.candidates.map((c, i) => ({
        id: i + 1,
        target: c.target,
        symbol: c.symbol,
        score: c.score,
        source: c.source,
        kind: c.kind,
      }));
      recentSearches.set(searchId, {
        repo: ctx.cwd,
        scope: result.plan.scope,
        candidates: candidatesWithIds,
        createdAt: Date.now(),
        lastAccess: Date.now(),
      });

      const packet = `search_id: ${searchId}\n\n${formatResult(result, false)}`;
      const truncated = await truncateForTool(packet);
      const details: SemanticSearchDetails = {
        searchId,
        query: result.plan.query,
        scope: result.plan.scope,
        confidence: { abstained: result.confidence.abstained, level: result.confidence.level, reason: result.confidence.reason },
        candidates: candidatesWithIds,
        cache: result.cache ? { cacheKind: result.cache.cacheKind, cacheHit: result.cache.cacheHit, chunks: result.cache.chunks, files: result.cache.files, cacheLocation: result.cache.cacheLocation } : undefined,
        truncated: truncated.truncated,
        fullOutputPath: truncated.fullOutputPath,
      };
      return { content: [{ type: "text", text: truncated.text }], details };
    },
    renderCall(args: { query?: string; scope?: string }, theme: ThemeLike) {
      let text = theme.fg("toolTitle", theme.bold("semantic_search ")) + theme.fg("accent", `"${args.query ?? ""}"`);
      if (args.scope) text += theme.fg("muted", ` in ${args.scope}`);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Searching srcwalk evidence..."), 0, 0);
      const details = result.details as SemanticSearchDetails | undefined;
      if (!details) return new Text(result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "", 0, 0);
      let text = details.searchId ? theme.fg("dim", `${details.searchId} `) : "";
      text += details.confidence.abstained ? theme.fg("warning", `abstained: ${details.confidence.reason}`) : theme.fg("success", `${details.candidates.length} candidate(s), ${details.confidence.level} confidence`);
      if (details.cache) text += theme.fg("dim", ` · cache ${details.cache.cacheHit ? "hit" : "built"} ${details.cache.chunks} chunks`);
      if (details.truncated) text += theme.fg("warning", " · truncated");
      if (expanded) {
        for (const cand of details.candidates.slice(0, 5)) text += `\n${theme.fg("dim", `${cand.target} ${cand.symbol ?? ""} ${cand.score.toFixed(1)}`)}`;
        if (details.fullOutputPath) text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
      }
      return new Text(text, 0, 0);
    },
  });

  pi.registerTool({
    name: "semantic_inspect",
    label: "Semantic Inspect",
    description: "Show callers, detailed callees, and references for a known symbol.",
    promptSnippet: "Show callers/callees/references for a known symbol",
    promptGuidelines: [
      "Use semantic_inspect only when the symbol name is known.",
      "Default relation='all' shows callers, detailed callees, and references.",
      "Use relation='callers', 'callees', or 'references' to narrow output.",
      "Use semantic_search first for ambiguous names or natural-language discovery.",
      "Open returned targets with semantic_show using inspect_id + candidate_id.",
    ],
    parameters: InspectParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      return {
        symbol: input.symbol,
        relation: input.relation,
        scope: input.scope,
        limit: input.limit,
      };
    },
    async execute(_toolCallId: string, params: { symbol: string; relation?: string; scope?: string; limit?: number }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      const symbol = params.symbol;
      const relation = params.relation ?? "all";
      const scope = params.scope?.trim() || ".";
      const limit = Math.max(1, Math.min(params.limit ?? 20, 50));
      onUpdate?.({ content: [{ type: "text", text: `Running semantic_inspect for ${symbol} (${relation})...` }] });

      if (!["all", "callers", "callees", "references"].includes(relation)) {
        return { content: [{ type: "text", text: `semantic_inspect: relation must be 'all', 'callers', 'callees', or 'references', got '${relation}'.` }] };
      }

      const traceScope = traceScopeForInspect(ctx.cwd, scope, relation);
      const commands = inspectCommands(symbol, relation, scope, traceScope, limit);
      const results: Array<{ code: number; output: string; command: SrcwalkCommand }> = [];
      for (const cmd of commands) {
        const result = await runCommand(ctx.cwd, cmd, signal);
        results.push(result);
      }

      // Build registry entry for semantic_show
      cleanupSearches();
      const inspectId = nextInspectId(ctx.cwd);
      const allTargets = new Set<string>();
      const allCandidates: Array<{ id: number; target: string; symbol?: string }> = [];
      for (const r of results) {
        for (const t of parseInspectTargets(r.output)) {
          if (!allTargets.has(t)) {
            allTargets.add(t);
            allCandidates.push({ id: allCandidates.length + 1, target: t, symbol });
          }
        }
      }
      recentSearches.set(inspectId, {
        repo: ctx.cwd,
        scope: traceScope,
        candidates: allCandidates,
        createdAt: Date.now(),
        lastAccess: Date.now(),
      });

      const packet = `inspect_id: ${inspectId}\n\n${formatInspectPacket(ctx.cwd, symbol, relation, scope, traceScope, results)}`;
      const truncated = await truncateForTool(packet);
      const details: SemanticInspectDetails = {
        inspectId,
        symbol,
        relation,
        scope,
        candidates: allCandidates,
        truncated: truncated.truncated,
        fullOutputPath: truncated.fullOutputPath,
      };
      return { content: [{ type: "text", text: truncated.text }], details };
    },
    renderCall(args: { symbol?: string; relation?: string; scope?: string }, theme: ThemeLike) {
      let text = theme.fg("toolTitle", theme.bold("semantic_inspect ")) + theme.fg("accent", args.symbol ?? "");
      if (args.relation && args.relation !== "all") text += theme.fg("muted", ` (${args.relation})`);
      if (args.scope) text += theme.fg("muted", ` in ${args.scope}`);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Inspecting symbol..."), 0, 0);
      const details = result.details as SemanticInspectDetails | undefined;
      if (!details) return new Text(result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "", 0, 0);
      let text = theme.fg("dim", `${details.inspectId} `) + theme.fg("accent", details.symbol) + theme.fg("dim", ` · ${details.relation}`);
      if (details.candidates.length) text += theme.fg("dim", ` · ${details.candidates.length} targets`);
      if (details.truncated) text += theme.fg("warning", " · truncated");
      if (expanded && details.fullOutputPath) text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
      return new Text(text, 0, 0);
    },
  });

  pi.registerTool({
    name: "semantic_review",
    label: "Semantic Review",
    description: "Review staged or working-tree changes with srcwalk diff evidence and risk hints.",
    promptSnippet: "Review current code changes with semantic_review",
    promptGuidelines: [
      "Use semantic_review for review, check, summarize, or assess current changes, diffs, patches, or risk.",
      "Default is staged changes; use target='working-tree' only for unstaged/current working-tree changes.",
      "Use semantic_search or semantic_inspect for existing-code discovery; use semantic_review for changed-code evidence.",
      "Treat output as bounded diff evidence; read exact ranges before detailed fix claims.",
    ],
    parameters: ReviewParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      return { target: input.target, scope: input.scope };
    },
    async execute(_toolCallId: string, params: { target?: string; scope?: string }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      const target = normalizeReviewTarget(params.target);
      const scope = params.scope?.trim() || ".";
      onUpdate?.({ content: [{ type: "text", text: `Running semantic_review (${target})...` }] });
      const command = reviewCommand(target, scope);
      const result = await runCommand(ctx.cwd, command, signal);
      const packet = formatReviewPacket(ctx.cwd, target, scope, result);
      const truncated = await truncateForTool(packet);
      const details: SemanticReviewDetails = {
        target,
        scope,
        code: result.code,
        elapsedMs: result.elapsedMs,
        ...parseReviewDetails(result.output),
        truncated: truncated.truncated,
        fullOutputPath: truncated.fullOutputPath,
      };
      return { content: [{ type: "text", text: truncated.text }], details };
    },
    renderCall(args: { target?: string; scope?: string }, theme: ThemeLike) {
      const target = normalizeReviewTarget(args.target);
      let text = theme.fg("toolTitle", theme.bold("semantic_review ")) + theme.fg("accent", target);
      if (args.scope) text += theme.fg("muted", ` in ${args.scope}`);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Reviewing current changes..."), 0, 0);
      const details = result.details as SemanticReviewDetails | undefined;
      if (!details) return new Text(result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "", 0, 0);
      const status = details.code === 0 ? theme.fg("success", `${details.target} review`) : theme.fg("warning", `${details.target} review code=${details.code}`);
      let text = `${status} · files ${details.changedFiles ?? 0}`;
      if (details.changedHunks !== undefined) text += theme.fg("dim", ` · hunks ${details.changedHunks}`);
      if (details.changedSymbols !== undefined) text += theme.fg("dim", ` · symbols ${details.changedSymbols}`);
      if (details.truncated) text += theme.fg("warning", " · truncated");
      if (expanded && details.fullOutputPath) text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
      return new Text(text, 0, 0);
    },
  });

  pi.registerTool({
    name: "semantic_show",
    label: "Semantic Show",
    description: "Open a candidate from semantic_search/semantic_inspect, or a direct path:line target. Default context mode shows flow/call context; show mode shows raw code.",
    promptSnippet: "Open code context with semantic_show",
    promptGuidelines: [
      "Use semantic_show after semantic_search or semantic_inspect to inspect one candidate.",
      "Pass search_id/inspect_id + candidate_id, or pass target directly for stateless use.",
      "Default mode='context' gives flow/call context; use mode='show' for raw code.",
    ],
    parameters: ShowParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      return {
        search_id: input.search_id,
        inspect_id: input.inspect_id,
        candidate_id: input.candidate_id,
        target: input.target,
        mode: input.mode,
        scope: input.scope,
      };
    },
    async execute(_toolCallId: string, params: { search_id?: string; inspect_id?: string; candidate_id?: number; target?: string; mode?: string; scope?: string }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      // Resolve target from params
      let target: string;
      let scope: string;
      let candidateInfo: string;
      let repo = ctx.cwd;
      const registryId = params.search_id ?? params.inspect_id;

      if (params.target) {
        // Stateless: target provided directly
        target = params.target;
        scope = params.scope?.trim() || ".";
        candidateInfo = target;
      } else if (registryId && params.candidate_id != null) {
        // Stateful: lookup from registry
        cleanupSearches();
        const record = recentSearches.get(registryId);
        if (!record) {
          return { content: [{ type: "text", text: `semantic_show: id "${registryId}" not found or expired. Run semantic_search/semantic_inspect again or pass target directly.` }] };
        }
        // Repo safety check
        if (path.resolve(record.repo) !== path.resolve(ctx.cwd)) {
          return { content: [{ type: "text", text: `semantic_show: id "${registryId}" belongs to a different repo. Run semantic_search/semantic_inspect again in this repo or pass a direct target.` }] };
        }
        record.lastAccess = Date.now();
        repo = record.repo;
        const candidateIdx = params.candidate_id - 1;
        const candidate = record.candidates[candidateIdx];
        if (!candidate) {
          return { content: [{ type: "text", text: `semantic_show: candidate_id ${params.candidate_id} out of range (1-${record.candidates.length}).` }] };
        }
        target = candidate.target;
        scope = params.scope?.trim() || record.scope;
        candidateInfo = `${candidate.target}${candidate.symbol ? ` ${candidate.symbol}` : ""}`;
      } else {
        return { content: [{ type: "text", text: "semantic_show: provide either (search_id/inspect_id + candidate_id) or target directly." }] };
      }

      const mode = params.mode === "show" ? "show" : "context";
      onUpdate?.({ content: [{ type: "text", text: `Running semantic_show ${mode} for ${target}...` }] });

      const command: SrcwalkCommand = mode === "show"
        ? { label: `show:${target}`, args: ["srcwalk", "show", target, "-C", "12", "--budget", "5000"], purpose: "show candidate code", parseAs: "show" }
        : { label: `context:${target}`, args: ["srcwalk", "context", target, "--scope", scope, "--budget", "5000"], purpose: "show candidate context", parseAs: "context" };

      const result = await runCommand(repo, command, signal);

      const header = [
        `# semantic-show: ${candidateInfo}`,
        `search_id: ${params.search_id ?? "-"} | inspect_id: ${params.inspect_id ?? "-"} | candidate_id: ${params.candidate_id ?? "-"} | mode: ${mode}`,
        `scope: ${scope}`,
        "",
      ].join("\n");

      const packet = result.code === 0
        ? header + result.output.trim()
        : header + `(command failed code=${result.code})\n\n${result.output.trim()}`;

      const truncated = await truncateForTool(packet);

      return { content: [{ type: "text", text: truncated.text }] };
    },
    renderCall(args: { search_id?: string; inspect_id?: string; candidate_id?: number; target?: string; mode?: string }, theme: ThemeLike) {
      const registryId = args.search_id ?? args.inspect_id;
      const label = args.target ?? (registryId ? `id:${registryId} candidate:${args.candidate_id}` : "");
      let text = theme.fg("toolTitle", theme.bold("semantic_show ")) + theme.fg("accent", label);
      if (args.mode) text += theme.fg("muted", ` (${args.mode})`);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Showing candidate..."), 0, 0);
      const text = result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "";
      const firstLine = text.split("\n")[0] ?? "";
      return new Text(firstLine || text, 0, 0);
    },
  });
}
