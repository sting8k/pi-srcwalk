import path from "node:path";
import type { Candidate, ConfidenceReport, QueryPlan } from "../domain/types.js";
import { domainKeywords } from "../router/intent.js";
import { candidateFile } from "../srcwalk/parse.js";
import { isCodeFile, isDocFile } from "./rank.js";

export function pathKeywordCoverage(plan: QueryPlan, candidates: Candidate[]): number {
  const kws = domainKeywords(plan).map((k) => k.toLowerCase());
  if (!kws.length || !candidates.length) return 0;
  const text = candidates.slice(0, 3).map((c) => `${c.target} ${c.symbol ?? ""}`.toLowerCase()).join(" ");
  return kws.filter((kw) => text.includes(kw)).length / kws.length;
}

function hasDomainPathHit(plan: QueryPlan, candidates: Candidate[]): boolean {
  const kws = domainKeywords(plan).map((k) => k.toLowerCase());
  if (!kws.length) return false;
  const text = candidates.slice(0, 5).map((c) => `${c.target} ${c.symbol ?? ""}`.toLowerCase()).join(" ");
  return kws.some((kw) => text.includes(kw));
}

function isBroadNonStructuralQuery(plan: QueryPlan): boolean {
  return plan.queryKind === "general" && ["general", "definition", "related"].includes(plan.intent);
}

function moduleKey(file: string): string {
  return path.dirname(file);
}

function hasScopeSensitiveAmbiguity(plan: QueryPlan, top: Candidate[], gap: number, cluster: number, coverage: number): boolean {
  if (!isBroadNonStructuralQuery(plan) || top.length < 3) return false;
  if (cluster > 1 || gap > 8 || coverage >= 0.75) return false;
  const modules = new Set(top.slice(0, 3).map((c) => moduleKey(candidateFile(c))));
  return modules.size >= 3;
}

export function confidenceReport(plan: QueryPlan, top: Candidate[]): ConfidenceReport {
  if (plan.queryKind === "overview" && !top.length) return { abstained: false, level: "high", reason: "overview query returns structural overview output without candidate targets", topScore: 0, topGap: 0, topFileCluster: 0, pathKeywordCoverage: 0 };
  if (!top.length) return { abstained: true, level: "low", reason: "no candidates parsed", topScore: 0, topGap: 0, topFileCluster: 0, pathKeywordCoverage: 0 };
  const scores = top.map((c) => c.score);
  const gap = scores[0]! - (scores[1] ?? 0);
  const topFile = candidateFile(top[0]!);
  const cluster = top.slice(0, 3).filter((c) => candidateFile(c) === topFile).length;
  const coverage = pathKeywordCoverage(plan, top);
  const docs = top.slice(0, 3).filter((c) => isDocFile(candidateFile(c))).length;
  const code = top.slice(0, 3).filter((c) => isCodeFile(candidateFile(c))).length;

  if (["explicit_target", "file", "file_deps", "overview", "symbol"].includes(plan.queryKind)) return { abstained: false, level: "high", reason: "explicit structural query", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  if (["callers", "callees", "deps", "impact"].includes(plan.intent)) return { abstained: false, level: "high", reason: "structural intent query", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };

  const implementationQuery = plan.intent === "definition" || /implemented|implementation/i.test(plan.query);
  if (implementationQuery && code > 0 && coverage === 0 && !hasDomainPathHit(plan, top)) return { abstained: true, level: "low", reason: "implementation query has zero path/symbol keyword coverage after RRF", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  if (implementationQuery && code === 0) return { abstained: true, level: "low", reason: "implementation query produced no code candidates", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  if (implementationQuery && coverage < 0.34 && scores[0]! < 95) return { abstained: true, level: "low", reason: "implementation query has weak path/symbol keyword coverage", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  if (docs >= 2 && plan.intent !== "test" && coverage < 0.34) return { abstained: true, level: "low", reason: "top results are mostly documents with weak keyword coverage", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  if (scores[0]! < 55 && coverage < 0.34) return { abstained: true, level: "low", reason: "top score and keyword coverage are both low", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  if (hasScopeSensitiveAmbiguity(plan, top, gap, cluster, coverage)) return { abstained: false, level: "medium", reason: "scope-sensitive ambiguity: broad query has near-tied candidates across different modules; try a narrower scope or add a path/symbol anchor", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  if (cluster >= 2 || coverage >= 0.5 || scores[0]! >= 85) return { abstained: false, level: "high", reason: "strong candidate cluster/coverage/score", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
  return { abstained: false, level: "medium", reason: "usable but not strongly clustered", topScore: scores[0]!, topGap: gap, topFileCluster: cluster, pathKeywordCoverage: coverage };
}
