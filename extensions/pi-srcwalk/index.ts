import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { executeSearch } from "../../src/engine.js";
import { formatResult } from "../../src/output/format.js";
import { truncateForTool } from "../../src/output/truncate.js";

const Params = Type.Object({
  query: Type.String({ description: "What to find in the current repo: a natural-language question, symbol, file, or srcwalk target." }),
  scope: Type.Optional(Type.String({ description: "Optional relative repo subdirectory to narrow search when the user names a clear module/path. Defaults to the whole repo. Absolute paths and '..' are rejected." })),
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
    description: "Search code evidence in the current repo using srcwalk plus a TS-native persistent BM25/PRF cache and RRF fusion. Provide a query; optionally provide a relative scope only when narrowing to a known module/path. Output is truncated to 2000 lines or 50KB; full output is saved to a temp file when truncated.",
    promptSnippet: "Find exact code evidence with srcwalk-backed semantic_search",
    promptGuidelines: [
      "Use semantic_search before raw grep when the user asks where code lives, how an implementation works, who calls a symbol, or which files are relevant.",
      "Call semantic_search with query only by default; set scope only when the user names a clear repo subdirectory or prior evidence identifies the module to inspect.",
      "Do not try to tune result count, depth, verbosity, repo, or embedding options; semantic_search chooses those defaults internally.",
      "Treat semantic_search abstained=true as no strong match; do not claim evidence exists unless candidates or expansion output support it.",
      "Use semantic_search targets as bounded evidence; follow up with read/edit tools only after selecting exact paths or ranges.",
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
