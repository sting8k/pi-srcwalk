import type { AgentToolUpdateCallback, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { normalizeSrcwalkArgs } from "../../src/args.js";
import { runSrcwalk } from "../../src/runner.js";

// === stale tools-rules cleanup (pre-1.3 legacy) ===
// Old pi-srcwalk versions injected a semantic_* contract block into the
// system prompt between these sentinels. The new extension no longer injects
// anything; it only removes the stale block so agents do not call tools that
// no longer exist.
const SENTINEL_START = "<!-- pi-srcwalk:tools-rules:start -->";
const SENTINEL_END = "<!-- pi-srcwalk:tools-rules:end -->";

const SrcwalkParams = Type.Object({
  args: Type.String({
    description:
      "Full srcwalk command line, e.g. \"context executeSearch --scope src\" or \"discover buildOrLoadIndex --expand\". " +
      "Do not prefix with 'srcwalk'. Run \"guide\" for the embedded usage guide.",
  }),
});

interface SrcwalkDetails {
  command: string;
  exitCode: number;
  elapsedMs: number;
  binaryNotFound: boolean;
}

export default function piSrcwalkExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "srcwalk",
    label: "Srcwalk",
    description:
      "Run the srcwalk CLI directly: structural code intelligence (context, trace, deps, discover, overview, review, compare, assess, show, guide). " +
      "Use this tool instead of bash for code-structure reads.",
    promptSnippet: "Run srcwalk CLI for code structure",
    promptGuidelines: [
      "Use the srcwalk tool instead of bash for code-structure reads: context, trace callers/callees, deps, discover, overview, review, compare, assess, show.",
      "Pass the full command line in args, e.g. \"context executeSearch --scope src\". Do not prefix it with 'srcwalk'.",
      "Output is self-bounded by --budget (default 6000 tokens); add --no-budget only when full output is truly needed.",
      "When unsure how to phrase a command, run \"guide\" first.",
    ],
    parameters: SrcwalkParams,
    prepareArguments(args: unknown) {
      const input = (args ?? {}) as Record<string, unknown>;
      return { args: typeof input.args === "string" ? input.args : "" };
    },
    async execute(_toolCallId: string, params: { args: string }, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback | undefined, ctx: { cwd: string }) {
      onUpdate?.({ content: [{ type: "text", text: `Running srcwalk ${params.args}...` }], details: undefined });

      const normalized = normalizeSrcwalkArgs(params.args);
      if ("error" in normalized) {
        return {
          content: [{ type: "text", text: `[srcwalk] ${normalized.error}` }],
          details: { command: params.args, exitCode: 0, elapsedMs: 0, binaryNotFound: false } satisfies SrcwalkDetails,
        };
      }

      const result = await runSrcwalk(ctx.cwd, normalized.tokens, signal);

      let text = result.output;
      if (result.binaryNotFound) {
        text = `[srcwalk] binary not found on PATH — install with \`npm install -g srcwalk\` or run via \`npx srcwalk\`.\n\n${text}`;
      } else if (result.exitCode !== 0) {
        text = `[srcwalk exit ${result.exitCode}]\n${text}`;
      }

      const details: SrcwalkDetails = {
        command: params.args,
        exitCode: result.exitCode,
        elapsedMs: result.elapsedMs,
        binaryNotFound: result.binaryNotFound,
      };
      return { content: [{ type: "text", text }], details };
    },
    renderCall(args: { args?: string }, theme: ThemeLike) {
      return new Text(theme.fg("toolTitle", theme.bold("srcwalk ")) + theme.fg("accent", args.args ?? ""), 0, 0);
    },
    renderResult(result: ToolResultLike, { isPartial }: { isPartial: boolean }, theme: ThemeLike) {
      if (isPartial) return new Text(theme.fg("warning", "Running srcwalk..."), 0, 0);
      const text = result.content[0]?.type === "text" ? (result.content[0].text ?? "") : "";
      return new Text(text.split("\n")[0] ?? text, 0, 0);
    },
  });

  // Cast: ExtensionAPI type lacks on() — provided at runtime by Pi.
  const piEvents = pi as unknown as { on(event: string, handler: (event: any) => any): void };

  piEvents.on("before_agent_start", async (event: { systemPrompt: string }) => {
    const startIdx = event.systemPrompt.indexOf(SENTINEL_START);
    const endIdx = event.systemPrompt.indexOf(SENTINEL_END);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      return {
        systemPrompt:
          event.systemPrompt.slice(0, startIdx) +
          event.systemPrompt.slice(endIdx + SENTINEL_END.length),
      };
    }
    return { systemPrompt: event.systemPrompt };
  });
}

interface ThemeLike {
  fg(role: string, text: string): string;
  bold(text: string): string;
}

interface ToolResultLike {
  content: Array<{ type: string; text?: string }>;
  details?: unknown;
}
