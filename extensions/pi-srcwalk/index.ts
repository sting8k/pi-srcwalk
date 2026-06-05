import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { executeSearch } from "../../src/engine.js";
import type { SrcwalkCommand } from "../../src/domain/types.js";
import { formatResult } from "../../src/output/format.js";
import { truncateForTool } from "../../src/output/truncate.js";
import { commandDisplay } from "../../src/router/intent.js";
import { runCommand } from "../../src/srcwalk/runner.js";
import crypto from "node:crypto";
import path from "node:path";

const SearchParams = Type.Object({
  query: Type.String({ description: "What to find: a question, symbol, file path, path:line, callers/callees/deps request, overview, or test search." }),
  scope: Type.Optional(Type.String({ description: "One repo-relative dir/file to limit search; omit or use '.' for repo root. Examples: 'src', 'src/index/cache.ts'. Not glob, symbol, path:line, absolute path, or multi-scope." })),
});

const ReviewParams = Type.Object({
  target: Type.Optional(Type.String({ description: "Changes to review: 'staged' (default) or 'working-tree'." })),
  scope: Type.Optional(Type.String({ description: "One repo-relative dir/file to limit review evidence; omit or use '.' for whole diff. Examples: 'src', 'src/index/cache.ts'. Not glob, absolute path, or multi-scope." })),
});

const ShowParams = Type.Object({
  search_id: Type.Optional(Type.String({ description: "Search ID from a previous semantic_search call. Required when using candidate_id." })),
  candidate_id: Type.Optional(Type.Number({ description: "Candidate number (1-based) from the search results. Use with search_id." })),
  target: Type.Optional(Type.String({ description: "Direct target path:line to show (e.g. 'src/index/cache.ts:154-259'). Alternative to search_id+candidate_id." })),
  mode: Type.Optional(Type.String({ description: "Output mode: 'context' (default, with flow map and call neighborhood) or 'show' (raw code with context lines)." })),
  scope: Type.Optional(Type.String({ description: "Override scope for context mode. Defaults to the search's scope, or '.' if using direct target." })),
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
    description: "Find relevant code evidence in the current repo. Handles natural-language, symbol, file, caller/callee, dependency, overview, and test queries; returns ranked candidates, retrieval confidence, and bounded srcwalk evidence.",
    promptSnippet: "Find ranked code evidence with srcwalk-backed semantic_search",
    promptGuidelines: [
      "Use semantic_search first for code discovery or navigation questions, including where code lives, how an implementation works, who calls a symbol, dependencies, overviews, tests, or relevant files.",
      "Call semantic_search with query only by default. Set scope only to one repo-relative directory/file when the user or prior evidence identifies it; put symbols and path:line targets in query, not scope.",
      "Treat Retrieval confidence as confidence in candidate selection. If it is medium/low or abstained=true, narrow scope or verify with returned evidence before claiming an answer.",
      "Use returned targets as bounded evidence. Read exact files or ranges before editing or making detailed code claims.",
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
    name: "semantic_review",
    label: "Semantic Review",
    description: "Review current code changes with srcwalk. Use for staged diffs, working-tree changes, patch risk, or change summaries; returns bounded review evidence and changed-symbol context.",
    promptSnippet: "Review current code changes with srcwalk-backed semantic_review",
    promptGuidelines: [
      "Use semantic_review instead of semantic_search when the user asks to review, check, summarize, or assess current changes, staged files, diffs, patches, or change risk.",
      "Call semantic_review with no arguments by default to review staged changes. Use target='working-tree' only when the user asks about unstaged/current working tree changes.",
      "Use semantic_search for finding existing code; use semantic_review for evaluating changed code.",
      "Treat semantic_review output as bounded diff evidence; read exact changed files or ranges before making detailed fix claims.",
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
    description: "Open and display a specific candidate from a previous semantic_search, or a direct target path:line. Shows structural context (flow map, callers, callees) by default, or raw code with surrounding lines.",
    promptSnippet: "Show candidate code context with semantic_show",
    promptGuidelines: [
      "Use semantic_show after semantic_search to examine a specific candidate in detail without copying the target path manually.",
      "Pass search_id and candidate_id from the search results to open the exact candidate.",
      "Alternatively pass target directly (e.g. 'src/index/cache.ts:154-259') for a stateless show.",
      "Default mode is 'context' which shows flow map, call neighborhood, and analysis. Use mode='show' for raw code lines.",
    ],
    parameters: ShowParams,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      return {
        search_id: input.search_id,
        candidate_id: input.candidate_id,
        target: input.target,
        mode: input.mode,
        scope: input.scope,
      };
    },
    async execute(_toolCallId: string, params: { search_id?: string; candidate_id?: number; target?: string; mode?: string; scope?: string }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      // Resolve target from params
      let target: string;
      let scope: string;
      let candidateInfo: string;
      let repo = ctx.cwd;

      if (params.target) {
        // Stateless: target provided directly
        target = params.target;
        scope = params.scope?.trim() || ".";
        candidateInfo = target;
      } else if (params.search_id && params.candidate_id != null) {
        // Stateful: lookup from registry
        cleanupSearches();
        const record = recentSearches.get(params.search_id);
        if (!record) {
          return { content: [{ type: "text", text: `semantic_show: search_id "${params.search_id}" not found or expired. Run semantic_search again or pass target directly.` }] };
        }
        // Repo safety check
        if (path.resolve(record.repo) !== path.resolve(ctx.cwd)) {
          return { content: [{ type: "text", text: `semantic_show: search_id "${params.search_id}" belongs to a different repo. Run semantic_search again in this repo or pass a direct target.` }] };
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
        return { content: [{ type: "text", text: "semantic_show: provide either (search_id + candidate_id) or target directly." }] };
      }

      const mode = params.mode === "show" ? "show" : "context";
      onUpdate?.({ content: [{ type: "text", text: `Running semantic_show ${mode} for ${target}...` }] });

      const command: SrcwalkCommand = mode === "show"
        ? { label: `show:${target}`, args: ["srcwalk", "show", target, "-C", "12", "--budget", "5000"], purpose: "show candidate code", parseAs: "show" }
        : { label: `context:${target}`, args: ["srcwalk", "context", target, "--scope", scope, "--budget", "5000"], purpose: "show candidate context", parseAs: "context" };

      const result = await runCommand(repo, command, signal);

      const header = [
        `# semantic-show: ${candidateInfo}`,
        `search_id: ${params.search_id ?? "-"} | candidate_id: ${params.candidate_id ?? "-"} | mode: ${mode}`,
        `scope: ${scope}`,
        "",
      ].join("\n");

      const packet = result.code === 0
        ? header + result.output.trim()
        : header + `(command failed code=${result.code})\n\n${result.output.trim()}`;

      const truncated = await truncateForTool(packet);

      return { content: [{ type: "text", text: truncated.text }] };
    },
    renderCall(args: { search_id?: string; candidate_id?: number; target?: string; mode?: string }, theme: ThemeLike) {
      const label = args.target ?? (args.search_id ? `search:${args.search_id} candidate:${args.candidate_id}` : "");
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
