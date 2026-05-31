import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { executeSearch } from "../../src/engine.js";
import type { SrcwalkCommand } from "../../src/domain/types.js";
import { formatResult } from "../../src/output/format.js";
import { truncateForTool } from "../../src/output/truncate.js";
import { commandDisplay } from "../../src/router/intent.js";
import { runCommand } from "../../src/srcwalk/runner.js";

const SearchParams = Type.Object({
  query: Type.String({ description: "What to find: a question, symbol, file path, path:line, callers/callees/deps request, overview, or test search." }),
  scope: Type.Optional(Type.String({ description: "Optional scope to search when the user or prior evidence identifies a module/path. Omit by default." })),
});

const ReviewParams = Type.Object({
  target: Type.Optional(Type.String({ description: "Changes to review: 'staged' (default) or 'working-tree'." })),
  scope: Type.Optional(Type.String({ description: "Optional scope to limit changed evidence when reviewing a large diff." })),
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
  query: string;
  scope: string;
  confidence: { abstained: boolean; level: string; reason: string };
  candidates: Array<{ target: string; symbol?: string; score: number; source: string; kind: string }>;
  cache?: { cacheHit: boolean; chunks: number; files: number; cacheDir: string };
  truncated?: boolean;
  fullOutputPath?: string;
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
      "Call semantic_search with query only by default. Set scope only when the user names a repo subdirectory or prior evidence identifies the module to inspect.",
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
      const packet = formatResult(result, false);
      const truncated = await truncateForTool(packet);
      const details: SemanticSearchDetails = {
        query: result.plan.query,
        scope: result.plan.scope,
        confidence: { abstained: result.confidence.abstained, level: result.confidence.level, reason: result.confidence.reason },
        candidates: result.candidates.map((c) => ({ target: c.target, symbol: c.symbol, score: c.score, source: c.source, kind: c.kind })),
        cache: result.cache ? { cacheHit: result.cache.cacheHit, chunks: result.cache.chunks, files: result.cache.files, cacheDir: result.cache.cacheDir } : undefined,
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
      let text = details.confidence.abstained ? theme.fg("warning", `abstained: ${details.confidence.reason}`) : theme.fg("success", `${details.candidates.length} candidate(s), ${details.confidence.level} confidence`);
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
}
