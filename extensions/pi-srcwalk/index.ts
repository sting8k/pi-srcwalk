import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { executeSearch } from "../../src/engine.js";
import { formatResult } from "../../src/output/format.js";
import { truncateForTool } from "../../src/output/truncate.js";

const Params = Type.Object({
  query: Type.String({ description: "Natural language, symbol, file, or srcwalk target to find evidence for." }),
  scope: Type.Optional(Type.String({ description: "Relative repo scope to search. Defaults to '.'. Absolute paths and '..' are rejected." })),
  max_results: Type.Optional(Type.Number({ description: "Maximum candidates to return. Defaults to 3, capped at 10." })),
  detail: Type.Optional(Type.String({ description: "Evidence expansion depth: brief, normal, or deep. Defaults to normal." })),
  verbose: Type.Optional(Type.Boolean({ description: "Include per-candidate scoring evidence in the packet." })),
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
    description: "Search code evidence using srcwalk plus a TS-native persistent BM25/PRF cache and RRF fusion. Output is truncated to 2000 lines or 50KB; full output is saved to a temp file when truncated.",
    promptSnippet: "Find exact code evidence with srcwalk-backed semantic_search",
    promptGuidelines: [
      "Use semantic_search before raw grep when the user asks where code lives, how an implementation works, who calls a symbol, or which files are relevant.",
      "Treat semantic_search abstained=true as no strong match; do not claim evidence exists unless candidates or expansion output support it.",
      "Use semantic_search targets as bounded evidence; follow up with read/edit tools only after selecting exact paths or ranges.",
    ],
    parameters: Params,
    prepareArguments(args: unknown) {
      if (!args || typeof args !== "object") return args;
      const input = args as Record<string, unknown>;
      if (typeof input.maxResults === "number" && input.max_results === undefined) return { ...input, max_results: input.maxResults };
      return args;
    },
    async execute(_toolCallId: string, params: { query: string; scope?: string; max_results?: number; detail?: string; verbose?: boolean }, signal: AbortSignal | undefined, onUpdate: ((update: { content: Array<{ type: "text"; text: string }> }) => void) | undefined, ctx: { cwd: string }) {
      onUpdate?.({ content: [{ type: "text", text: "Running semantic_search..." }] });
      const detail = params.detail === "brief" || params.detail === "deep" ? params.detail : "normal";
      const result = await executeSearch({
        query: params.query,
        repo: ctx.cwd,
        scope: params.scope ?? ".",
        maxResults: params.max_results ?? 3,
        detail,
        signal,
      });
      const packet = formatResult(result, Boolean(params.verbose));
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
