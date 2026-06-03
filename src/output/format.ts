import type { CommandResult, SearchResult } from "../domain/types.js";
import { commandDisplay } from "../router/intent.js";

function commandLine(result: CommandResult): string {
  const status = result.code === 0 ? "ok" : `code=${result.code}`;
  const matches = result.matchCount !== undefined ? `, matches=${result.matchCount}` : "";
  return `- [${status}, ${result.elapsedMs}ms${matches}] ${result.command.label}: ${commandDisplay(result.command)}`;
}

export function formatResult(result: SearchResult, verbose = false): string {
  const { plan, confidence } = result;
  const lines: string[] = [
    `# semantic-search ts: ${plan.query}`,
    `repo: ${plan.repo}`,
    `scope: ${plan.scope}`,
    `intent: ${plan.intent}; kind: ${plan.queryKind}; keywords: ${JSON.stringify(plan.keywords)}`,
    "",
    "## Retrieval confidence",
    "- source: semantic_search ranking; srcwalk evidence packets keep their own evidence confidence",
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
  if (result.notes.length) lines.push("## Notes", ...result.notes.map((note) => `- ${note}`), "");
  lines.push("## Best candidates");
  if (!result.candidates.length) lines.push("- none parsed");
  result.candidates.forEach((cand, idx) => {
    const symbol = cand.symbol ? ` \`${cand.symbol}\`` : "";
    lines.push(`${idx + 1}. \`${cand.target}\`${symbol} — score=${cand.score.toFixed(1)}, source=${cand.source}, kind=${cand.kind}`);
    if (verbose) lines.push(...cand.evidence.map((e) => `   - ${e}`));
  });
  lines.push("", "## Evidence expansion");
  if (!result.expansions.length) lines.push("- none");
  result.expansions.forEach((exp, idx) => {
    lines.push(`### Expansion ${idx + 1}: ${exp.command.label} (${exp.code === 0 ? "ok" : `code=${exp.code}`}, ${exp.elapsedMs}ms)`, "```text", exp.output.trim(), "```", "");
  });
  return lines.join("\n");
}
