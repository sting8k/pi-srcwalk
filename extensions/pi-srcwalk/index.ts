import type { AgentToolUpdateCallback, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { planBatch, runBatch, MAX_BATCH_COMMANDS } from "../../src/batch.js";

// === stale tools-rules cleanup (pre-1.3 legacy) ===
// Old pi-srcwalk versions injected a semantic_* contract block into the
// system prompt between these sentinels. The new extension no longer injects
// anything; it only removes the stale block so agents do not call tools that
// no longer exist.
const SENTINEL_START = "<!-- pi-srcwalk:tools-rules:start -->";
const SENTINEL_END = "<!-- pi-srcwalk:tools-rules:end -->";

const SrcwalkParams = Type.Object({
  args: Type.Union([
    Type.String({
      description:
        "Full srcwalk command line, e.g. \"context executeSearch --scope src\" or \"discover buildOrLoadIndex --expand\". " +
        "Do not prefix with 'srcwalk'. Run \"guide\" for the embedded usage guide.",
    }),
    Type.Array(Type.String(), {
      description:
        `Batch of up to ${MAX_BATCH_COMMANDS} independent srcwalk command lines, run concurrently and returned in order. ` +
        "Each element is one full command line. Use this instead of shell chaining.",
    }),
  ]),
});

interface SrcwalkCommandDetails {
  command: string;
  exitCode: number;
  elapsedMs: number;
  binaryNotFound: boolean;
}

interface SrcwalkDetails {
  commands: SrcwalkCommandDetails[];
  totalElapsedMs: number;
}

const BINARY_NOT_FOUND_MSG =
  "[srcwalk] binary not found on PATH — install with `npm install -g srcwalk` or run via `npx srcwalk`.";

/** Wrap one command's raw output with exit/ENOENT prefixes. */
function describeResult(output: string, exitCode: number, binaryNotFound: boolean, showNotice: boolean): string {
  let text = output;
  if (binaryNotFound) {
    if (showNotice) text = `${BINARY_NOT_FOUND_MSG}\n\n${text}`;
  } else if (exitCode !== 0) {
    text = `[srcwalk exit ${exitCode}]\n${text}`;
  }
  return text;
}

export default function piSrcwalkExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "srcwalk",
    label: "Srcwalk",
    description:
      "Run the srcwalk CLI directly: structural code intelligence (context, trace, deps, discover, overview, review, compare, assess, show, guide). " +
      "Use this tool instead of bash for code-structure reads. " +
      "Output is bounded by srcwalk's own --budget (default 6000 tokens); no tool-side cap. " +
      "No shell: shell metacharacters are rejected, and multiple commands are passed as an array (batch).",
    promptSnippet: "Run srcwalk CLI for code structure",
    promptGuidelines: [
      "Always prefer the srcwalk tool over bash grep/rg/cat/find/tree for code reads and navigation; start with \"guide\" when unsure.",
    ],
    parameters: SrcwalkParams,
    prepareArguments(args: unknown) {
      const input = (args ?? {}) as Record<string, unknown>;
      if (Array.isArray(input.args)) {
        return { args: input.args.filter((a): a is string => typeof a === "string") };
      }
      return { args: typeof input.args === "string" ? input.args : "" };
    },
    async execute(_toolCallId: string, params: { args: string | string[] }, signal: AbortSignal | undefined, onUpdate: AgentToolUpdateCallback | undefined, ctx: { cwd: string }) {
      const planned = planBatch(params.args);
      if ("error" in planned) {
        return {
          content: [{ type: "text", text: `[srcwalk] ${planned.error}` }],
          details: { commands: [], totalElapsedMs: 0 } satisfies SrcwalkDetails,
        };
      }

      const isBatch = planned.commands.length > 1;
      const preview = isBatch
        ? `${planned.commands.length} commands`
        : planned.commands[0]!.raw;
      onUpdate?.({ content: [{ type: "text", text: `Running srcwalk ${preview}...` }], details: undefined });

      const batch = await runBatch(ctx.cwd, planned.commands, signal);

      let noticeShown = false;
      const text = batch.results
        .map(({ raw, result }) => {
          const showNotice = !noticeShown;
          if (result.binaryNotFound) noticeShown = true;
          const block = describeResult(result.output, result.exitCode, result.binaryNotFound, showNotice);
          return isBatch ? `--- $ srcwalk ${raw} ---\n${block}` : block;
        })
        .join("\n\n");

      const details: SrcwalkDetails = {
        commands: batch.results.map(({ raw, result }) => ({
          command: raw,
          exitCode: result.exitCode,
          elapsedMs: result.elapsedMs,
          binaryNotFound: result.binaryNotFound,
        })),
        totalElapsedMs: batch.totalElapsedMs,
      };
      return { content: [{ type: "text", text }], details };
    },
    renderCall(args: { args?: string | string[] }, theme: ThemeLike) {
      const label = Array.isArray(args.args) ? `[${args.args.length} commands] ${args.args.join(" · ")}` : (args.args ?? "");
      return new Text(theme.fg("toolTitle", theme.bold("srcwalk ")) + theme.fg("accent", label), 0, 0);
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
    let prompt = event.systemPrompt;
    // Remove every stale block (loop in case multiple legacy installs left
    // more than one), leaving the rest of the prompt untouched.
    while (true) {
      const startIdx = prompt.indexOf(SENTINEL_START);
      const endIdx = prompt.indexOf(SENTINEL_END);
      if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) break;
      prompt = prompt.slice(0, startIdx) + prompt.slice(endIdx + SENTINEL_END.length);
    }
    return { systemPrompt: prompt };
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
