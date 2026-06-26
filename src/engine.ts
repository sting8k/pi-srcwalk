import path from "node:path";
import type { Candidate, CommandResult, DetailLevel, SearchResult, SrcwalkCommand } from "./domain/types.js";
import { bm25Search, shouldRunBm25 } from "./index/bm25.js";
import { buildPlan, domainKeywords, makeCmd, strongSymbolAnchors, validateScope } from "./router/intent.js";
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

const COMMAND_CONCURRENCY = 4;

async function runCommandBatch(repo: string, commands: SrcwalkCommand[], signal?: AbortSignal): Promise<CommandResult[]> {
  if (!commands.length) return [];
  const results = new Array<CommandResult>(commands.length);
  let next = 0;
  const worker = async () => {
    while (next < commands.length) {
      const index = next;
      next += 1;
      results[index] = await runCommand(repo, commands[index]!, signal);
    }
  };
  await Promise.all(Array.from({ length: Math.min(COMMAND_CONCURRENCY, commands.length) }, worker));
  return results;
}

async function expandCandidate(repo: string, cand: Candidate, scope: string, signal?: AbortSignal): Promise<{ cand: Candidate; exp: CommandResult; didDeps: boolean }> {
  if (cand.source === "file-deps" || cand.commandLabel === "file-deps") {
    return { cand, exp: await runCommand(repo, depsCmd(candidateFile(cand), "3500"), signal), didDeps: true };
  }
  let exp = await runCommand(repo, candidateToContextCmd(cand, scope), signal);
  if (exp.code !== 0) exp = await runCommand(repo, candidateToShowCmd(cand), signal);
  return { cand, exp, didDeps: false };
}

function dedupeCommands(commands: SrcwalkCommand[]): SrcwalkCommand[] {
  const seen = new Set<string>();
  const out: SrcwalkCommand[] = [];
  for (const command of commands) {
    const key = `${command.label}\u0000${command.args.join("\u0000")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(command);
  }
  return out;
}

function srcwalkCommandsForPlan(plan: ReturnType<typeof buildPlan>, bm25Candidates: Candidate[]): SrcwalkCommand[] {
  const hintCommands = plan.commands.filter((c) => c.label.startsWith("hint-"));
  const regularCommands = plan.commands.filter((c) => !c.label.startsWith("hint-"));
  if (!bm25Candidates.length) return plan.commands;
  if (["general", "definition", "test", "related"].includes(plan.intent)) {
    const exactSymbols = regularCommands.filter((c) => c.label.startsWith("symbol-exact"));
    if (exactSymbols.length) return dedupeCommands([...hintCommands, ...exactSymbols.slice(0, 3)]);
    return dedupeCommands([...hintCommands, ...regularCommands.filter((c) => c.label.startsWith("symbol-") && c.label !== "text-any").slice(0, 1)]);
  }
  return dedupeCommands([...hintCommands, ...regularCommands]);
}

function extraFusionCommands(plan: ReturnType<typeof buildPlan>): SrcwalkCommand[] {
  if (["explicit_target", "file", "file_deps", "overview", "symbol"].includes(plan.queryKind)) return [];
  if (!["general", "definition", "test", "related"].includes(plan.intent)) return [];
  const commands: SrcwalkCommand[] = [];
  for (const kw of domainKeywords(plan).slice(0, 3)) {
    const low = kw.toLowerCase();
    if (strongSymbolAnchors([kw], 1).length) {
      commands.push(makeCmd(`fusion-symbol-exact-${low}`, ["discover", kw, "--as", "symbol", "--scope", plan.scope, "--limit", "8", "--budget", "2200"], "broad-query exact symbol fusion", "discover"));
    }
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

  for (const result of await runCommandBatch(repo, commands.slice(0, commandBudget), options.signal)) {
    const command = result.command;
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
    const expanded = await Promise.all(top.slice(0, contextLimit).map((cand) => expandCandidate(repo, cand, plan.scope, options.signal)));
    for (const { cand, exp, didDeps: expandedDeps } of expanded) {
      didDeps = didDeps || expandedDeps;
      expansions.push(exp);
      if (!cand.symbol) cand.symbol = parseSymbolFromContext(exp.output);
    }

    const primary = top[0]!;
    const symbol = fallbackSymbol(plan, primary);
    const followups: SrcwalkCommand[] = [];
    if (plan.shouldTraceCallers && symbol) followups.push(traceCmd("callers", symbol, plan.scope));
    if (plan.shouldTraceCallees && symbol) followups.push(traceCmd("callees", symbol, plan.scope));
    if (plan.shouldGetDeps && !didDeps) followups.push(depsCmd(candidateFile(primary)));
    if (plan.shouldAssess && symbol) followups.push(assessCmd(symbol, plan.scope));
    if (detail === "deep" && !plan.shouldGetDeps) followups.push(depsCmd(candidateFile(primary)));
    expansions.push(...await runCommandBatch(repo, followups, options.signal));
  }

  if (!expansions.length && commandResults.length) {
    const lastGood = commandResults.find((r) => r.code === 0 && r.output.trim()) ?? commandResults.at(-1)!;
    expansions.push(lastGood);
  }

  return { plan, commandResults, candidates: top, expansions, notes, confidence, cache };
}
