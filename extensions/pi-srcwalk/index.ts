import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { executeSearch } from "../../src/engine.js";
import { executeSemanticGrep, formatSemanticGrepResult } from "../../src/grep/semantic-grep.js";
import type { SrcwalkCommand } from "../../src/domain/types.js";
import { formatResult } from "../../src/output/format.js";
import { truncateForTool } from "../../src/output/truncate.js";
import { commandDisplay } from "../../src/router/intent.js";
import { runCommand } from "../../src/srcwalk/runner.js";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const QueryParams = Type.Object({
  query: Type.String({ description: "What to find: natural-language question, symbol, file, path:line, overview, deps, or tests. Use semantic_inspect for known-symbol context/callers/callees/references." }),
  scope: Type.Optional(Type.String({ description: "One repo-relative dir/file to limit search; omit or use '.' for repo root. Examples: 'src', 'src/index/cache.ts'. Not glob, symbol, path:line, absolute path, or multi-scope." })),
});

const GrepParams = Type.Object({
  pattern: Type.Optional(Type.String({ description: "Text or regex pattern to search. Use query as an alias if you prefer. Use semantic_query for code-intent discovery and semantic_grep for exact match search." })),
  query: Type.Optional(Type.String({ description: "Alias of pattern." })),
  scope: Type.Optional(Type.String({ description: "Repo-relative dir/file scope to search. Omit or use '.' for repo root. Examples: 'src', 'src/index/cache.ts'." })),
  path: Type.Optional(Type.String({ description: "Alias of scope." })),
  glob: Type.Optional(Type.String({ description: "Optional simple glob to narrow files, e.g. '**/*.ts' or 'src/**/*.md'." })),
  literal: Type.Optional(Type.Boolean({ description: "Treat the pattern as a literal string instead of regex." })),
  regex: Type.Optional(Type.Boolean({ description: "Treat the pattern as regex; overrides literal when true." })),
  ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive search." })),
  ignore_case: Type.Optional(Type.Boolean({ description: "Alias of ignoreCase." })),
  context: Type.Optional(Type.Number({ description: "Number of surrounding lines to include around each match." })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of matches to return (default: 100)." })),
  max_results: Type.Optional(Type.Number({ description: "Alias of limit." })),
});

const ReviewParams = Type.Object({
  target: Type.Optional(Type.String({ description: "Changes to review: 'staged' (default) or 'working-tree'." })),
  scope: Type.Optional(Type.String({ description: "One repo-relative dir/file to limit review evidence; omit or use '.' for whole diff. If scope points to a nested git repo, review runs inside that repo. Examples: 'src', 'nested-repo', 'src/index/cache.ts'. Not glob, absolute path, or multi-scope." })),
});

const ShowParams = Type.Object({
  search_id: Type.Optional(Type.String({ description: "ID from semantic_query. Use with candidate_id." })),
  inspect_id: Type.Optional(Type.String({ description: "ID from semantic_inspect. Use with candidate_id." })),
  candidate_id: Type.Optional(Type.Number({ description: "1-based candidate number from semantic_query or semantic_inspect." })),
  target: Type.Optional(Type.String({ description: "Direct path:line target(s), e.g. 'src/index/cache.ts:154-259' or 'a.ts:10,b.ts:20-30'. Stateless alternative to id+candidate_id." })),
});

// === before_agent_start sentinels ===
const SENTINEL_START = "<!-- pi-srcwalk:tools-rules:start -->";
const SENTINEL_END   = "<!-- pi-srcwalk:tools-rules:end -->";

const InspectParams = Type.Object({
  symbol: Type.String({ description: "Exact symbol name(s), comma-separated for up to 3 (e.g. 'buildOrLoadIndex' or 'foo,bar,baz'). Not natural language." }),
  relation: Type.Optional(Type.String({ description: "Relation section to include with context: 'all' (default), 'callers', 'callees', or 'references'." })),
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

interface SemanticQueryDetails {
  searchId?: string;
  query: string;
  scope: string;
  confidence: { abstained: boolean; level: string; reason: string };
  candidates: Array<{ id?: number; target: string; symbol?: string; score: number; source: string; kind: string }>;
  cache?: { cacheKind: string; cacheHit: boolean; chunks: number; files: number; cacheLocation: string };
  truncated?: boolean;
  fullOutputPath?: string;
}

interface SemanticGrepDetails {
  pattern: string;
  scope: string;
  glob?: string;
  literal: boolean;
  ignoreCase: boolean;
  backend: string;
  anchors: string[];
  stats: {
    cacheHit: boolean;
    indexedFiles: number;
    candidateFiles: number;
    searchedFiles: number;
    matchedFiles: number;
    totalMatches: number;
    truncated: boolean;
    buildMs: number;
    queryMs: number;
    sizeBytes: number;
    cacheLocation: string;
  };
  error?: string;
  truncated?: boolean;
  fullOutputPath?: string;
}


interface SemanticInspectDetails {
  inspectId: string;
  symbol?: string;
  symbols?: string[];
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
  // Always run discover first — used for target resolution + references
  cmds.push({ label: `discover:${symbol}`, args: ["srcwalk", "discover", symbol, "--as", "symbol", "--scope", scope, "--limit", String(limit), "--budget", "5000"], purpose: "discover references", parseAs: "discover" });
  // Context is added separately after discover resolves the target
  if (relation === "all" || relation === "callers") {
    cmds.push({ label: `trace-callers:${symbol}`, args: ["srcwalk", "trace", "callers", symbol, "--scope", traceScope, "--limit", String(limit), "--budget", "5000"], purpose: "trace callers", parseAs: "trace" });
  }
  if (relation === "all" || relation === "callees") {
    cmds.push({ label: `trace-callees:${symbol}`, args: ["srcwalk", "trace", "callees", symbol, "--scope", traceScope, "--detailed", "--budget", "5000"], purpose: "trace callees", parseAs: "trace" });
  }
  return cmds;
}

async function inspectOneSymbol(
  symbol: string,
  relation: string,
  scope: string,
  traceScope: string,
  repo: string,
  signal: AbortSignal | undefined,
  limit: number,
): Promise<{ results: Array<{ code: number; output: string; command: SrcwalkCommand }>; targets: string[] }> {
  const commands = inspectCommands(symbol, relation, scope, traceScope, limit);
  const results: Array<{ code: number; output: string; command: SrcwalkCommand }> = [];

  const discoverCmd = commands.shift()!;
  const discoverResult = await runCommand(repo, discoverCmd, signal);

  const discoverTargets = parseInspectTargets(discoverResult.output);
  const resolvedTarget = discoverTargets.length > 0 ? discoverTargets[0]! : symbol;

  const contextCmd: SrcwalkCommand = {
    label: `context:${symbol}`,
    args: ["srcwalk", "context", resolvedTarget, "--scope", scope, "--budget", "5000"],
    purpose: "inspect symbol context",
    parseAs: "context",
  };
  const contextResult = await runCommand(repo, contextCmd, signal);
  results.push(contextResult);

  for (const cmd of commands) {
    const result = await runCommand(repo, cmd, signal);
    results.push(result);
  }

  if (relation === "all" || relation === "references") results.push(discoverResult);

  const targets = new Set<string>();
  for (const r of results) {
    for (const t of parseInspectTargets(r.output)) {
      targets.add(t);
    }
  }
  return { results, targets: Array.from(targets) };
}

function formatInspectPacket(repo: string, symbol: string, relation: string, scope: string, traceScope: string, results: Array<{ code: number; output: string; command: SrcwalkCommand }>): string {
  const sections = [`# semantic-inspect: ${symbol}`, `repo: ${repo}`, `relation: ${relation}`, `scope: ${scope}`];
  if (traceScope !== scope) sections.push(`trace_scope: ${traceScope} (file scope adjusted for callers/callees)`);
  sections.push("");
  for (const r of results) {
    const label = r.command.label;
    const isContext = label.startsWith("context:");
    const isCallers = label.startsWith("trace-callers");
    const isCallees = label.startsWith("trace-callees");
    const section = isContext ? "Context" : isCallers ? "Callers" : isCallees ? "Callees" : "References";
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
  repo: string;
  scope: string;
  effectiveScope: string;
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

interface ReviewExecutionContext {
  repo: string;
  scope: string;
  requestedScope: string;
}

function isInsideOrSame(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function tryStat(target: string): fs.Stats | undefined {
  try {
    return fs.statSync(target);
  } catch {
    return undefined;
  }
}

function tryRealpath(target: string): string | undefined {
  try {
    return fs.realpathSync(target);
  } catch {
    return undefined;
  }
}

function hasGitMetadata(dir: string): boolean {
  return fs.existsSync(path.join(dir, ".git"));
}

function findNestedGitRoot(startDir: string, stopAt: string): string | undefined {
  let current = path.resolve(startDir);
  const stop = path.resolve(stopAt);

  while (isInsideOrSame(stop, current)) {
    if (current !== stop && hasGitMetadata(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return undefined;
}

function resolveReviewContext(cwd: string, scope: string): ReviewExecutionContext {
  const repo = path.resolve(cwd);
  const repoRealpath = tryRealpath(repo) ?? repo;
  const requestedScope = scope.trim() || ".";
  const resolvedScope = path.resolve(repo, requestedScope);

  if (isInsideOrSame(repo, resolvedScope)) {
    const scopeStat = tryStat(resolvedScope);
    const searchStart = scopeStat?.isDirectory() ? resolvedScope : path.dirname(resolvedScope);
    const nestedRepo = findNestedGitRoot(searchStart, repo);
    const nestedRealpath = nestedRepo ? tryRealpath(nestedRepo) : undefined;

    if (nestedRepo && nestedRealpath && isInsideOrSame(repoRealpath, nestedRealpath)) {
      const nestedScope = path.relative(nestedRepo, resolvedScope) || ".";
      return {
        repo: nestedRepo,
        scope: nestedScope,
        requestedScope,
      };
    }
  }

  return { repo, scope: requestedScope, requestedScope };
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

function formatReviewPacket(repo: string, target: ReviewTarget, reviewCtx: ReviewExecutionContext, result: { code: number; elapsedMs: number; output: string; command: SrcwalkCommand }): string {
  const status = result.code === 0 ? "ok" : `code=${result.code}`;
  const requestedScopeLine = reviewCtx.requestedScope !== reviewCtx.scope ? [`requested_scope: ${reviewCtx.requestedScope}`] : [];
  return [
    `# semantic-review: ${target}`,
    `repo: ${repo}`,
    ...requestedScopeLine,
    `scope: ${reviewCtx.scope}`,
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

function disableDefaultGrepIfSupported(pi: ExtensionAPI): void {
  const controls = pi as unknown as {
    getActiveTools?: () => unknown[];
    setActiveTools?: (names: string[]) => void;
  };
  const activeTools = controls.getActiveTools?.();
  if (!Array.isArray(activeTools) || typeof controls.setActiveTools !== "function") return;

  const activeNames = activeTools
    .map((tool) => typeof tool === "string" ? tool : (tool as { name?: unknown })?.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
  const nextNames = [...new Set([...activeNames.filter((name) => name !== "grep"), "semantic_grep"])];
  controls.setActiveTools(nextNames);
}

export default function piSrcwalkExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "semantic_query",
    label: "Semantic Query",
    description: "Discover ranked code evidence when the exact target is unknown: natural-language questions, files, symbols, overviews, deps, and tests.",
    promptSnippet: "Discover ranked code evidence with semantic_query",
    promptGuidelines: [
      "Use semantic_query for discovery when the target or symbol is unknown or ambiguous.",
      "Prefer semantic_inspect when the user names a concrete symbol and asks for callers, callees, or references.",
      "Set scope only to one repo-relative dir/file when known; put symbols and path:line targets in query.",
      "Treat confidence and returned targets as bounded evidence; verify exact ranges before detailed claims or edits.",
    ],
    parameters: QueryParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      return { query: input.query, scope: input.scope };
    },
    async execute(_toolCallId: string, params: { query: string; scope?: string }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      onUpdate?.({ content: [{ type: "text", text: "Running semantic_query..." }] });
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
      const details: SemanticQueryDetails = {
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
      let text = theme.fg("toolTitle", theme.bold("semantic_query ")) + theme.fg("accent", `"${args.query ?? ""}"`);
      if (args.scope) text += theme.fg("muted", ` in ${args.scope}`);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Searching srcwalk evidence..."), 0, 0);
      const details = result.details as SemanticQueryDetails | undefined;
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
    name: "semantic_grep",
    label: "Semantic Grep",
    description: "Search raw text or regex deterministically with trigram-index candidate pruning and full-scan fallback for weak regex patterns.",
    promptSnippet: "Search exact text/regex with semantic_grep",
    promptGuidelines: [
      "Use semantic_grep for raw text or regex matches; use semantic_query for NL/code-intent discovery.",
      "Prefer literal=true for exact strings and regex=true for regex patterns like 'foo.*bar'.",
      "Set scope to one repo-relative dir/file and glob only when a file-pattern filter is useful.",
      "Treat semantic_grep as the pi-srcwalk replacement for the default grep tool; avoid built-in grep unless semantic_grep lacks support and say why.",
    ],
    parameters: GrepParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      return {
        pattern: input.pattern ?? input.query,
        scope: input.scope ?? input.path,
        glob: input.glob,
        literal: input.literal,
        regex: input.regex,
        ignoreCase: input.ignoreCase ?? input.ignore_case,
        context: input.context,
        maxResults: input.max_results ?? input.limit,
      };
    },
    async execute(_toolCallId: string, params: { pattern?: string; query?: string; scope?: string; glob?: string; literal?: boolean; regex?: boolean; ignoreCase?: boolean; context?: number; maxResults?: number }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      const pattern = params.pattern ?? params.query ?? "";
      if (!pattern.trim()) {
        return { content: [{ type: "text", text: "semantic_grep: provide pattern or query." }] };
      }
      const scope = params.scope?.trim() || ".";
      const mode = params.regex ? "regex" : params.literal ? "literal" : "regex";
      onUpdate?.({ content: [{ type: "text", text: `Running semantic_grep (${mode})...` }] });
      const result = await executeSemanticGrep({
        pattern,
        repo: ctx.cwd,
        scope,
        glob: params.glob,
        literal: params.literal,
        regex: params.regex,
        ignoreCase: params.ignoreCase,
        context: params.context,
        maxResults: params.maxResults,
        signal,
      });
      const packet = formatSemanticGrepResult(result);
      const truncated = await truncateForTool(packet);
      const details: SemanticGrepDetails = {
        pattern: result.pattern,
        scope: result.scope,
        glob: result.glob,
        literal: result.literal,
        ignoreCase: result.ignoreCase,
        backend: result.backend,
        anchors: result.anchors,
        stats: result.stats,
        error: result.error,
        truncated: truncated.truncated,
        fullOutputPath: truncated.fullOutputPath,
      };
      return { content: [{ type: "text", text: truncated.text }], details };
    },
    renderCall(args: { pattern?: string; query?: string; scope?: string; glob?: string; literal?: boolean; regex?: boolean }, theme: ThemeLike) {
      const label = args.pattern ?? args.query ?? "";
      const mode = args.regex ? "regex" : args.literal ? "literal" : "regex";
      let text = theme.fg("toolTitle", theme.bold("semantic_grep ")) + theme.fg("accent", `/${label}/`) + theme.fg("dim", ` ${mode}`);
      if (args.scope) text += theme.fg("muted", ` in ${args.scope}`);
      if (args.glob) text += theme.fg("muted", ` glob ${args.glob}`);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Searching text/regex matches..."), 0, 0);
      const details = result.details as SemanticGrepDetails | undefined;
      if (!details) return new Text(result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "", 0, 0);
      if (details.error) return new Text(theme.fg("warning", `semantic_grep error: ${details.error}`), 0, 0);
      let text = theme.fg("success", `${details.stats.totalMatches} match(es)`) + theme.fg("dim", ` · ${details.backend} · ${details.stats.candidateFiles}/${details.stats.indexedFiles} files`);
      if (details.stats.truncated) text += theme.fg("warning", " · match limit");
      if (details.truncated) text += theme.fg("warning", " · output truncated");
      if (expanded) {
        text += `\n${theme.fg("dim", `anchors: ${details.anchors.length ? details.anchors.join(", ") : "none"}`)}`;
        if (details.fullOutputPath) text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
      }
      return new Text(text, 0, 0);
    },
  });

  pi.registerTool({
    name: "semantic_inspect",
    label: "Semantic Inspect",
    description: "Inspect known symbol(s) deeply: context + callers + callees + references in one shot. Accepts one symbol or up to 3 symbols.",
    promptSnippet: "Inspect known symbol(s): context + callers + callees + references",
    promptGuidelines: [
      "Use semantic_inspect only when symbol name(s) are known exactly.",
      "Accepts one symbol, or comma-separated symbols (max 3).",
      "Example: 'buildOrLoadIndex' or 'foo, bar, baz'.",
      "Default relation='all' shows context, callers, detailed callees, and references.",
      "Context is always shown; use relation='callers', 'callees', or 'references' to narrow relation sections.",
      "Use semantic_query first for ambiguous names or natural-language discovery.",
      "Open returned targets with semantic_show using inspect_id + candidate_id.",
    ],
    parameters: InspectParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      const raw = typeof input.symbol === "string" ? input.symbol : "";
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      return {
        symbol: parts.length === 1 ? parts[0] : undefined,
        symbols: parts.length > 1 ? parts : undefined,
        relation: input.relation,
        scope: input.scope,
        limit: input.limit,
      };
    },
    async execute(_toolCallId: string, params: { symbol?: string; symbols?: string[]; relation?: string; scope?: string; limit?: number }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      const rawSymbols = params.symbols ?? (params.symbol ? [params.symbol] : []);
      const relation = params.relation ?? "all";
      const scope = params.scope?.trim() || ".";
      const limit = Math.max(1, Math.min(params.limit ?? 20, 50));

      if (rawSymbols.length === 0) {
        return { content: [{ type: "text", text: "semantic_inspect: provide either symbol or symbols." }] };
      }
      if (rawSymbols.length > 3) {
        return { content: [{ type: "text", text: `semantic_inspect: max 3 symbols, got ${rawSymbols.length}.` }] };
      }
      if (!["all", "callers", "callees", "references"].includes(relation)) {
        return { content: [{ type: "text", text: `semantic_inspect: relation must be 'all', 'callers', 'callees', or 'references', got '${relation}'.` }] };
      }

      const traceScope = traceScopeForInspect(ctx.cwd, scope, relation);
      const isMulti = rawSymbols.length > 1;
      onUpdate?.({ content: [{ type: "text", text: `Running semantic_inspect for ${rawSymbols.join(", ")} (${relation})...` }] });

      const symbolResults: Array<{ symbol: string; results: Array<{ code: number; output: string; command: SrcwalkCommand }>; targets: string[] }> = [];
      for (const symbol of rawSymbols) {
        const { results, targets } = await inspectOneSymbol(symbol, relation, scope, traceScope, ctx.cwd, signal, limit);
        symbolResults.push({ symbol, results, targets });
      }

      // Build registry entry for semantic_show
      cleanupSearches();
      const inspectId = nextInspectId(ctx.cwd);
      let idCounter = 1;
      const allCandidates: Array<{ id: number; target: string; symbol?: string }> = [];
      for (const sr of symbolResults) {
        for (const t of sr.targets) {
          allCandidates.push({ id: idCounter++, target: t, symbol: sr.symbol });
        }
      }
      recentSearches.set(inspectId, {
        repo: ctx.cwd,
        scope: traceScope,
        candidates: allCandidates,
        createdAt: Date.now(),
        lastAccess: Date.now(),
      });

      // Build packet
      let packet: string;
      if (isMulti) {
        const sections = [`# semantic-inspect: ${rawSymbols.length} symbols`, `repo: ${ctx.cwd}`, `relation: ${relation}`, `scope: ${scope}`];
        if (traceScope !== scope) sections.push(`trace_scope: ${traceScope} (file scope adjusted for callers/callees)`);
        sections.push("");
        for (const sr of symbolResults) {
          sections.push(`# Symbol: ${sr.symbol}`);
          for (const r of sr.results) {
            const label = r.command.label;
            const isContext = label.startsWith("context:");
            const isCallers = label.startsWith("trace-callers");
            const isCallees = label.startsWith("trace-callees");
            const section = isContext ? "Context" : isCallers ? "Callers" : isCallees ? "Callees" : "References";
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
        }
        packet = `inspect_id: ${inspectId}\n\n${sections.join("\n")}`;
      } else {
        packet = `inspect_id: ${inspectId}\n\n${formatInspectPacket(ctx.cwd, rawSymbols[0]!, relation, scope, traceScope, symbolResults[0]!.results)}`;
      }

      const truncated = await truncateForTool(packet);
      const details: SemanticInspectDetails = {
        inspectId,
        symbol: isMulti ? undefined : rawSymbols[0],
        symbols: isMulti ? rawSymbols : undefined,
        relation,
        scope,
        candidates: allCandidates,
        truncated: truncated.truncated,
        fullOutputPath: truncated.fullOutputPath,
      };
      return { content: [{ type: "text", text: truncated.text }], details };
    },
    renderCall(args: { symbol?: string; symbols?: string[]; relation?: string; scope?: string }, theme: ThemeLike) {
      const label = args.symbols ? `${args.symbols.length} symbols` : (args.symbol ?? "");
      let text = theme.fg("toolTitle", theme.bold("semantic_inspect ")) + theme.fg("accent", label);
      if (args.relation && args.relation !== "all") text += theme.fg("muted", ` (${args.relation})`);
      if (args.scope) text += theme.fg("muted", ` in ${args.scope}`);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Inspecting symbol..."), 0, 0);
      const details = result.details as SemanticInspectDetails | undefined;
      if (!details) return new Text(result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "", 0, 0);
      const label = details.symbols ? `${details.symbols.length} symbols` : (details.symbol ?? "");
      let text = theme.fg("dim", `${details.inspectId} `) + theme.fg("accent", label) + theme.fg("dim", ` · ${details.relation}`);
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
      "Use semantic_query or semantic_inspect for existing-code discovery; use semantic_review for changed-code evidence.",
      "If scope points to a nested git repo, semantic_review runs inside that repo.",
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
      const reviewCtx = resolveReviewContext(ctx.cwd, scope);
      const repoLabel = path.relative(path.resolve(ctx.cwd), reviewCtx.repo) || reviewCtx.repo;
      const reviewLocation = reviewCtx.repo === path.resolve(ctx.cwd) ? scope : `${repoLabel}:${reviewCtx.scope}`;
      onUpdate?.({ content: [{ type: "text", text: `Running semantic_review (${target}) in ${reviewLocation}...` }] });
      const command = reviewCommand(target, reviewCtx.scope);
      const result = await runCommand(reviewCtx.repo, command, signal);
      const packet = formatReviewPacket(reviewCtx.repo, target, reviewCtx, result);
      const truncated = await truncateForTool(packet);
      const details: SemanticReviewDetails = {
        target,
        repo: reviewCtx.repo,
        scope: reviewCtx.requestedScope,
        effectiveScope: reviewCtx.scope,
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
    description: "Open a target to read exact source code via srcwalk show. Pass search_id/inspect_id + candidate_id, or a direct path:line target. Supports multi-target like 'a.ts:10,b.ts:20-30'.",
    promptSnippet: "Open exact source code with semantic_show",
    promptGuidelines: [
      "Use semantic_show after semantic_query or semantic_inspect to read one exact source candidate.",
      "Pass search_id/inspect_id + candidate_id, or pass target directly for stateless use.",
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
      };
    },
    async execute(_toolCallId: string, params: { search_id?: string; inspect_id?: string; candidate_id?: number; target?: string }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      // Resolve target from params
      let target: string;
      let candidateInfo: string;
      let repo = ctx.cwd;
      const registryId = params.search_id ?? params.inspect_id;

      if (params.target) {
        // Stateless: target provided directly
        target = params.target;
        candidateInfo = target;
      } else if (registryId && params.candidate_id != null) {
        // Stateful: lookup from registry
        cleanupSearches();
        const record = recentSearches.get(registryId);
        if (!record) {
          return { content: [{ type: "text", text: `semantic_show: id "${registryId}" not found or expired. Run semantic_query/semantic_inspect again or pass target directly.` }] };
        }
        // Repo safety check
        if (path.resolve(record.repo) !== path.resolve(ctx.cwd)) {
          return { content: [{ type: "text", text: `semantic_show: id "${registryId}" belongs to a different repo. Run semantic_query/semantic_inspect again in this repo or pass a direct target.` }] };
        }
        record.lastAccess = Date.now();
        repo = record.repo;
        const candidateIdx = params.candidate_id - 1;
        const candidate = record.candidates[candidateIdx];
        if (!candidate) {
          return { content: [{ type: "text", text: `semantic_show: candidate_id ${params.candidate_id} out of range (1-${record.candidates.length}).` }] };
        }
        target = candidate.target;
        candidateInfo = `${candidate.target}${candidate.symbol ? ` ${candidate.symbol}` : ""}`;
      } else {
        return { content: [{ type: "text", text: "semantic_show: provide either (search_id/inspect_id + candidate_id) or target directly." }] };
      }

      onUpdate?.({ content: [{ type: "text", text: `Running srcwalk show for ${target}...` }] });

      const command: SrcwalkCommand = {
        label: `show:${target}`,
        args: ["srcwalk", "show", target, "-C", "12", "--budget", "5000"],
        purpose: "show source code",
        parseAs: "show",
      };

      const result = await runCommand(repo, command, signal);

      const header = [
        `# semantic-show: ${candidateInfo}`,
        `search_id: ${params.search_id ?? "-"} | inspect_id: ${params.inspect_id ?? "-"} | candidate_id: ${params.candidate_id ?? "-"}`,
        "",
      ].join("\n");

      const packet = result.code === 0
        ? header + result.output.trim()
        : header + `(command failed code=${result.code})\n\n${result.output.trim()}`;

      const truncated = await truncateForTool(packet);

      return { content: [{ type: "text", text: truncated.text }] };
    },
    renderCall(args: { search_id?: string; inspect_id?: string; candidate_id?: number; target?: string }, theme: ThemeLike) {
      const registryId = args.search_id ?? args.inspect_id;
      const label = args.target ?? (registryId ? `id:${registryId} candidate:${args.candidate_id}` : "");
      let text = theme.fg("toolTitle", theme.bold("semantic_show ")) + theme.fg("accent", label);
      return new Text(text, 0, 0);
    },
    renderResult(result: ToolResultLike, { expanded, isPartial }: { expanded: boolean; isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Showing candidate..."), 0, 0);
      const text = result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "";
      const firstLine = text.split("\n")[0] ?? "";
      return new Text(firstLine || text, 0, 0);
    },
  });

  disableDefaultGrepIfSupported(pi);

  // Cast: ExtensionAPI type lacks on() — provided at runtime by Pi
  const piEvents = pi as unknown as { on(event: string, handler: (event: { systemPrompt: string }) => any): void };
  // === before_agent_start: inject semantic_* contract into system prompt ===
  piEvents.on("before_agent_start", async (event) => {
    const block = [
      SENTINEL_START,
      "",
      "## Tools — semantic_* contract",
      "",
      "Default to `semantic_query` for code-structure discovery and `semantic_grep` for raw text/regex search.",
      "Do not use built-in `grep` by default; pi-srcwalk supersedes it with `semantic_grep`.",
      "Use `read` only for exact source confirmation after a semantic tool returns a target.",
      "",
      "### Contract",
      "",
      "1. **semantic_query** — discovery + NL routing:",
      "   NL query → auto-detect intent (overview, deps, tests,",
      "   fuzzy symbol lookup). Use when target is unclear.",
      "   For exact known symbols, use semantic_inspect.",
      "2. **semantic_grep** — deterministic text/regex search:",
      "   Trigram-index path: literal/regex → candidate prune",
      "   when anchors are strong → verify exact line matches;",
      "   full-scan fallback when regex is too weak or complex.",
      "3. **semantic_inspect** — known symbol(s) deep inspect:",
      "   context + callers + callees + references in one shot.",
      "   Accepts one symbol or up to 3 symbols. Runs srcwalk context,",
      "   relation traces, and refs.",
      "4. **semantic_show** — exact source read via srcwalk show:",
      "   path:line or id + candidate. Fixed -C 12 surrounding source lines.",
      "   For structural context of a known symbol, use semantic_inspect.",
      "5. **semantic_review** — verify changes. staged | working-tree.",
      "6. Respect confidence: `abstained: true` → no strong match.",
      "7. Follow search/inspect IDs. Don't retype paths.",
      "8. If you bypass semantic_* for a code claim, say why.",
      "",
      "### Before read/find/raw-text",
      "",
      "- `ls`/`tree`/`find` → `semantic_query`",
      "- raw text or regex search → `semantic_grep`",
      "- `rg \"foo\\(\"` / built-in `grep` → `semantic_grep` unless unsupported",
      "- Blind `read` → `semantic_show` with search/inspect_id + candidate",
      "",
      SENTINEL_END,
    ].join("\n");

    const startIdx = event.systemPrompt.indexOf(SENTINEL_START);
    const endIdx = event.systemPrompt.indexOf(SENTINEL_END);
    if (startIdx !== -1 && endIdx !== -1) {
      return {
        systemPrompt:
          event.systemPrompt.slice(0, startIdx) + block +
          event.systemPrompt.slice(endIdx + SENTINEL_END.length),
      };
    }
    return {
      systemPrompt: event.systemPrompt + "\n" + block
    };
  });
}
