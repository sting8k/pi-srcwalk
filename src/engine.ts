import path from "node:path";
import type { Candidate, DetailLevel, SearchResult, SrcwalkCommand } from "./domain/types.js";
import { bm25Search, shouldRunBm25 } from "./index/bm25.js";
import { buildPlan, domainKeywords, makeCmd, validateScope } from "./router/intent.js";
import { confidenceReport } from "./ranking/confidence.js";
import { bm25HasStrongCluster, cloneCandidate, dedupeRanked, rrfFuse, scoreCandidates } from "./ranking/rank.js";
import { assessCmd, candidateFile, candidateToContextCmd, candidateToShowCmd, depsCmd, fallbackSymbol, parseCandidates, parseFileDiscoverCandidates, parseSymbolFromContext, synthesizeCandidateFromCommand, traceCmd } from "./srcwalk/parse.js";
import { runCommand } from "./srcwalk/runner.js";

export interface ExecuteSearchOptions {
  query: string;
  repo?: string;
  scope?: string;
  maxResults?: number;
  detail?: DetailLevel;
  commandBudget?: number;
  signal?: AbortSignal;
}

function srcwalkCommandsForPlan(plan: ReturnType<typeof buildPlan>, bm25Candidates: Candidate[]): SrcwalkCommand[] {
  if (!bm25Candidates.length) return plan.commands;
  if (["general", "definition", "test", "related"].includes(plan.intent)) {
    return plan.commands.filter((c) => c.label.startsWith("symbol-") && c.label !== "text-any").slice(0, 1);
  }
  return plan.commands;
}

function extraFusionCommands(plan: ReturnType<typeof buildPlan>): SrcwalkCommand[] {
  if (["explicit_target", "file", "file_deps", "overview", "symbol"].includes(plan.queryKind)) return [];
  if (!["general", "definition", "test", "related"].includes(plan.intent)) return [];
  const commands: SrcwalkCommand[] = [];
  for (const kw of domainKeywords(plan).slice(0, 3)) {
    const low = kw.toLowerCase();
    commands.push(makeCmd(`fusion-symbol-${low}`, ["discover", `*${low}*`, "--as", "symbol", "--scope", plan.scope, "--limit", "8", "--budget", "2200"], "broad-query symbol fusion", "discover"));
    commands.push(makeCmd(`fusion-file-${low}`, ["discover", `*${low}*`, "--as", "file", "--scope", plan.scope, "--limit", "8", "--budget", "1800"], "broad-query file fusion", "discover"));
  }
  return commands;
}

export async function executeSearch(options: ExecuteSearchOptions): Promise<SearchResult> {
  const repo = path.resolve(options.repo ?? process.cwd());
  const scope = validateScope(options.scope ?? ".");
  const maxResults = Math.max(1, Math.min(options.maxResults ?? 3, 10));
  const detail = options.detail ?? "normal";
  const commandBudget = options.commandBudget ?? 10;
  const plan = buildPlan(options.query, repo, scope, maxResults, detail);
  const commandResults: SearchResult["commandResults"] = [];
  const expansions: SearchResult["expansions"] = [];
  const notes: string[] = [];
  let bm25Candidates: Candidate[] = [];
  let structuralCandidates: Candidate[] = [];
  let cache = undefined as SearchResult["cache"];

  if (shouldRunBm25(plan)) {
    const bm25 = await bm25Search(repo, plan.scope, plan.query, Math.max(maxResults * 12, 12));
    commandResults.push(bm25.result);
    notes.push(...bm25.notes);
    bm25Candidates = bm25.candidates;
    cache = bm25.index.stats;
  }

  let commands = srcwalkCommandsForPlan(plan, bm25Candidates);
  let addFusion = true;
  if (bm25Candidates.length) {
    const [strong, reason] = bm25HasStrongCluster(plan, bm25Candidates);
    if (strong) {
      notes.push(`Extra fusion skipped: ${reason}; preserves strong BM25 cluster.`);
      addFusion = false;
    }
  }
  if (addFusion) commands = [...commands, ...extraFusionCommands(plan)];
  if (!commands.length) commands = plan.commands;

  for (const command of commands.slice(0, commandBudget)) {
    const result = await runCommand(repo, command, options.signal);
    commandResults.push(result);
    if (result.code !== 0) {
      notes.push(`${command.label} failed with code ${result.code}`);
      continue;
    }
    const parsed = parseCandidates(result);
    structuralCandidates.push(...parsed);
    if (command.parseAs === "discover" && command.args.includes("file")) structuralCandidates.push(...parseFileDiscoverCandidates(result));
    structuralCandidates.push(...synthesizeCandidateFromCommand(result, plan));
  }

  if (plan.queryKind === "overview") {
    const confidence = confidenceReport(plan, []);
    const overviewExpansion = commandResults.find((r) => r.command.parseAs === "overview" && r.code === 0 && r.output.trim());
    if (overviewExpansion) expansions.push(overviewExpansion);
    else if (commandResults.length) expansions.push(commandResults.find((r) => r.code === 0 && r.output.trim()) ?? commandResults.at(-1)!);
    return { plan, commandResults, candidates: [], expansions, notes, confidence, cache };
  }

  const rankLists: Array<[string, Candidate[], number]> = [];
  if (bm25Candidates.length) rankLists.push(["bm25-prf", dedupeRanked(scoreCandidates(bm25Candidates.map(cloneCandidate), plan)), 1.0]);
  if (structuralCandidates.length) rankLists.push(["srcwalk", dedupeRanked(scoreCandidates(structuralCandidates.map(cloneCandidate), plan)), 1.25]);
  const ranked = rankLists.length >= 2 ? rrfFuse(rankLists) : scoreCandidates([...bm25Candidates, ...structuralCandidates], plan);
  if (rankLists.length >= 2) notes.push(`TS RRF fused ranks: ${rankLists.map(([label, cands]) => `${label}(${cands.length})`).join(", ")}`);

  const seen = new Set<string>();
  const top: Candidate[] = [];
  for (const cand of ranked) {
    if (seen.has(cand.target)) continue;
    seen.add(cand.target);
    top.push(cand);
    if (top.length >= maxResults) break;
  }

  const confidence = confidenceReport(plan, top);
  if (confidence.abstained) {
    notes.push(`Abstained: ${confidence.reason}.`);
    return { plan, commandResults, candidates: [], expansions: [], notes, confidence, cache };
  }

  let didDeps = false;
  if (top.length) {
    const contextLimit = detail === "brief" || ["callers", "callees", "deps", "impact"].includes(plan.intent) ? 1 : maxResults;
    for (const cand of top.slice(0, contextLimit)) {
      let exp;
      if (cand.source === "file-deps" || cand.commandLabel === "file-deps") {
        exp = await runCommand(repo, depsCmd(candidateFile(cand), "3500"), options.signal);
        didDeps = true;
      } else {
        exp = await runCommand(repo, candidateToContextCmd(cand, plan.scope), options.signal);
        if (exp.code !== 0) exp = await runCommand(repo, candidateToShowCmd(cand), options.signal);
      }
      expansions.push(exp);
      if (!cand.symbol) cand.symbol = parseSymbolFromContext(exp.output);
    }

    const primary = top[0]!;
    const symbol = fallbackSymbol(plan, primary);
    if (plan.shouldTraceCallers && symbol) expansions.push(await runCommand(repo, traceCmd("callers", symbol, plan.scope), options.signal));
    if (plan.shouldTraceCallees && symbol) expansions.push(await runCommand(repo, traceCmd("callees", symbol, plan.scope), options.signal));
    if (plan.shouldGetDeps && !didDeps) expansions.push(await runCommand(repo, depsCmd(candidateFile(primary)), options.signal));
    if (plan.shouldAssess && symbol) expansions.push(await runCommand(repo, assessCmd(symbol, plan.scope), options.signal));
    if (detail === "deep" && !plan.shouldGetDeps) expansions.push(await runCommand(repo, depsCmd(candidateFile(primary)), options.signal));
  }

  if (!expansions.length && commandResults.length) {
    const lastGood = commandResults.find((r) => r.code === 0 && r.output.trim()) ?? commandResults.at(-1)!;
    expansions.push(lastGood);
  }

  return { plan, commandResults, candidates: top, expansions, notes, confidence, cache };
}
