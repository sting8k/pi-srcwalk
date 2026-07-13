import type { Candidate, CommandResult, SearchResult } from "../domain/types.js";
import { commandDisplay, describeQueryIR } from "../router/intent.js";

function commandLine(result: CommandResult): string {
  const status = result.code === 0 ? "ok" : `code=${result.code}`;
  const matches = result.matchCount !== undefined ? `, matches=${result.matchCount}` : "";
  return `- [${status}, ${result.elapsedMs}ms${matches}] ${result.command.label}: ${commandDisplay(result.command)}`;
}

const INSPECT_FAILURE_OUTPUT_MAX_CHARS = 4000;

function boundedInspectOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length <= INSPECT_FAILURE_OUTPUT_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, INSPECT_FAILURE_OUTPUT_MAX_CHARS)}\n... (CLI output truncated)`;
}

export function formatInspectCommandResult(result: Pick<CommandResult, "code" | "output">): string[] {
  const output = result.code === 0 ? result.output.trim() : boundedInspectOutput(result.output);
  if (result.code !== 0) {
    const lines = [`(command failed code=${result.code})`];
    if (output) lines.push("```text", output, "```");
    return lines;
  }
  return [output || "(none)"];
}

function expansionTarget(label: string): string {
  const idx = label.indexOf(":");
  return idx >= 0 ? label.slice(idx + 1) : label;
}

function expansionGroupKey(result: CommandResult): string {
  if (result.command.parseAs === "trace") return result.command.label.split(":")[0] ?? result.command.label;
  return candidateFile(expansionTarget(result.command.label));
}

function expansionTitle(result: CommandResult): string {
  const label = result.command.label;
  const target = expansionTarget(label);
  switch (result.command.parseAs) {
    case "show": {
      const span = candidateSpan(target);
      return span !== target ? `show ${span}` : "show";
    }
    case "context": {
      const span = candidateSpan(target);
      return span !== target ? `context ${span}` : "context";
    }
    case "deps":
      return "deps";
    case "trace":
      return label.split(":")[0] ?? "trace";
    default:
      return label;
  }
}

function expansionSummary(result: CommandResult): string {
  const status = result.code === 0 ? "ok" : `code=${result.code}`;
  const preview = result.output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" | ");
  const trimmed = preview.length > 140 ? `${preview.slice(0, 137)}...` : preview;
  return `- [${status}, ${result.elapsedMs}ms] ${expansionTitle(result)}${trimmed ? ` — ${trimmed}` : ""}`;
}

function candidateFile(target: string): string {
  const idx = target.lastIndexOf(":");
  return idx > 0 ? target.slice(0, idx) : target;
}

function candidateSpan(target: string): string {
  const idx = target.lastIndexOf(":");
  return idx > 0 ? target.slice(idx + 1) : target;
}

function candidateLabel(candidate: Candidate): string {
  return candidate.symbol ?? candidate.kind;
}

function groupCandidates(candidates: Candidate[]): Array<{ file: string; candidates: Candidate[] }> {
  const groups = new Map<string, Candidate[]>();
  const order: string[] = [];
  for (const candidate of candidates) {
    const file = candidateFile(candidate.target);
    const existing = groups.get(file);
    if (existing) {
      existing.push(candidate);
      continue;
    }
    groups.set(file, [candidate]);
    order.push(file);
  }
  return order.map((file) => ({ file, candidates: groups.get(file) ?? [] }));
}

function groupExpansions(expansions: CommandResult[]): Array<{ group: string; expansions: CommandResult[] }> {
  const groups = new Map<string, CommandResult[]>();
  const order: string[] = [];
  for (const expansion of expansions) {
    const group = expansionGroupKey(expansion);
    const existing = groups.get(group);
    if (existing) {
      existing.push(expansion);
      continue;
    }
    groups.set(group, [expansion]);
    order.push(group);
  }
  return order.map((group) => ({ group, expansions: groups.get(group) ?? [] }));
}

function candidateLine(candidate: Candidate): string {
  const span = candidateSpan(candidate.target);
  const label = candidateLabel(candidate);
  return `${span}: ${label} — score=${candidate.score.toFixed(1)}, source=${candidate.source}, kind=${candidate.kind}`;
}

export function formatResult(result: SearchResult, verbose = false): string {
  const { plan, confidence } = result;
  const lines: string[] = [
    `# semantic-query ts: ${plan.rawQuery ?? plan.query}`,
    `repo: ${plan.repo}`,
    `scope: ${plan.scope}`,
    `intent: ${plan.intent}; kind: ${plan.queryKind}; keywords: ${JSON.stringify(plan.keywords)}`,
    "",
    "## Retrieval confidence",
    "- source: semantic_query ranking; srcwalk evidence packets keep their own evidence confidence",
    `- level: ${confidence.level}`,
    `- abstained: ${confidence.abstained}`,
    `- reason: ${confidence.reason}`,
    `- top_score: ${confidence.topScore.toFixed(1)}; top_gap: ${confidence.topGap.toFixed(1)}; top_file_cluster: ${confidence.topFileCluster}; path_keyword_coverage: ${confidence.pathKeywordCoverage.toFixed(2)}`,
    "",
  ];
  if (result.cache) {
    lines.push("## Cache", `- cache_kind: ${result.cache.cacheKind}`, `- cache_hit: ${result.cache.cacheHit}`, `- chunks: ${result.cache.chunks}; files: ${result.cache.files}; estimated_mem_mb: ${(result.cache.sizeBytes / (1024 * 1024)).toFixed(2)}`, `- cache_location: ${result.cache.cacheLocation}`, "");
  }
  lines.push("## Commands executed", ...result.commandResults.map(commandLine), "");
  const notes = plan.queryIR?.hasHints ? [`QueryIR: ${describeQueryIR(plan.queryIR)}`, ...result.notes] : result.notes;
  if (notes.length) lines.push("## Notes", ...notes.map((note) => `- ${note}`), "");
  lines.push("## Best candidate files");
  if (!result.candidates.length) {
    lines.push("- none parsed");
  } else {
    for (const group of groupCandidates(result.candidates)) {
      const best = Math.max(...group.candidates.map((candidate) => candidate.score));
      const hitWord = group.candidates.length === 1 ? "hit" : "hits";
      lines.push(`### ${group.file} — ${group.candidates.length} ${hitWord}, best=${best.toFixed(1)}`);
      for (const candidate of group.candidates) {
        lines.push(`[${result.candidates.indexOf(candidate) + 1}] ${candidateLine(candidate)}`);
        if (verbose) lines.push(...candidate.evidence.map((e) => `   - ${e}`));
      }
      lines.push("");
    }
  }
  lines.push("## Evidence expansion");
  if (!result.expansions.length) {
    lines.push("- none");
  } else if (plan.detail === "brief") {
    const groups = groupExpansions(result.expansions);
    lines.push(`- ${result.expansions.length} expansion(s) across ${groups.length} group(s)`);
  } else {
    for (const group of groupExpansions(result.expansions)) {
      lines.push(`### ${group.group} — ${group.expansions.length} expansion${group.expansions.length === 1 ? "" : "s"}`);
      if (plan.detail === "normal") {
        lines.push(...group.expansions.map(expansionSummary));
      } else {
        for (const expansion of group.expansions) {
          lines.push(`- [${expansion.code === 0 ? "ok" : `code=${expansion.code}`}, ${expansion.elapsedMs}ms] ${expansionTitle(expansion)}`);
          lines.push("```text", expansion.output.trim(), "```", "");
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
