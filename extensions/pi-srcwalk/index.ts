import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { executeSearch } from "../../src/engine.js";
import { formatResult } from "../../src/output/format.js";
import { truncateForTool } from "../../src/output/truncate.js";

const Params = Type.Object({
  query: Type.String({ description: "What to find: a question, symbol, file path, path:line, callers/callees/deps request, overview, or test search." }),
  scope: Type.Optional(Type.String({ description: "Optional relative subdirectory to search when the user or prior evidence identifies a module. Omit by default. Absolute paths and '..' are rejected." })),
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
    parameters: Params,
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
}
