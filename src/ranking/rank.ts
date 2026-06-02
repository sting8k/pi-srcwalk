import path from "node:path";
import type { Candidate, QueryPlan } from "../domain/types.js";
import { CODE_EXTS, DOC_EXTS } from "../router/constants.js";
import { domainKeywords, strongSymbolAnchors } from "../router/intent.js";
import { candidateFile } from "../srcwalk/parse.js";

const RRF_K = 60;
const RRF_SCALE = 1500;

function isTestTarget(target: string): boolean {
  return /(?:^|[\\/_.-])(test|tests|spec|fixture)s?(?:[\\/_.-]|$)/i.test(target);
}

function isExplanationQuery(plan: QueryPlan): boolean {
  return ["general", "definition", "related"].includes(plan.intent) && /\b(how|work|works|implementation|implemented|calculate|calculation|manage|flow)\b/i.test(plan.query);
}

export function exactSymbolAnchorMatches(plan: QueryPlan, cand: Candidate): string[] {
  const anchors = strongSymbolAnchors(domainKeywords(plan));
  if (!anchors.length) return [];
  const symbol = cand.symbol?.toLowerCase();
  const target = cand.target.toLowerCase();
  return anchors.filter((anchor) => {
    const low = anchor.toLowerCase();
    return symbol === low || target.includes(low);
  });
}

export function cloneCandidate(c: Candidate): Candidate {
  return { ...c, evidence: [...c.evidence] };
}

export function dedupeRanked(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const cand of candidates) {
    if (seen.has(cand.target)) continue;
    seen.add(cand.target);
    out.push(cand);
  }
  return out;
}

export function scoreCandidates(candidates: Candidate[], plan: QueryPlan): Candidate[] {
  const kws = domainKeywords(plan).map((k) => k.toLowerCase());
  for (const cand of candidates) {
    const target = cand.target.toLowerCase();
    const basename = path.basename(candidateFile(cand)).toLowerCase();
    if (["definition", "grouped-definition", "exact-context"].includes(cand.source)) cand.score += 25;
    const exactAnchors = exactSymbolAnchorMatches(plan, cand);
    if (exactAnchors.length && (["definition", "grouped-definition"].includes(cand.source) || cand.commandLabel.startsWith("symbol-exact"))) {
      cand.score += 95 + exactAnchors.length * 10;
      cand.evidence.push(`boost: exact symbol anchor ${exactAnchors.join(",")}`);
    }
    if (["ts-bm25", "ts-bm25-prf"].includes(cand.source)) cand.score += 15;
    if (cand.source === "file-discover") {
      if (kws.some((kw) => basename.includes(kw))) {
        cand.score += 55;
        cand.evidence.push("boost: filename matches query keyword");
      } else if (kws.some((kw) => target.includes(kw))) {
        cand.score += 30;
        cand.evidence.push("boost: path matches query keyword");
      }
    }
    if (kws.some((kw) => target.includes(kw) || (cand.symbol ?? "").toLowerCase().includes(kw))) cand.score += 12;
    const testTarget = isTestTarget(target);
    if (plan.intent === "test" && testTarget) cand.score += 20;
    if (plan.intent !== "test" && testTarget) {
      const penalty = isExplanationQuery(plan) ? 36 : 8;
      cand.score -= penalty;
      cand.evidence.push(`penalty: non-test query matched test-like path (-${penalty})`);
    }
    if (["general", "definition"].includes(plan.intent) && ["rank", "ranking", "score", "scoring"].some((kw) => kws.includes(kw)) && /rank|score|search\/rank/.test(target)) {
      cand.score += 20;
      cand.evidence.push("boost: ranking/scoring path");
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

export function rrfFuse(rankLists: Array<[string, Candidate[], number]>): Candidate[] {
  const scores = new Map<string, number>();
  const reps = new Map<string, Candidate>();
  const labels = new Map<string, string[]>();
  for (const [label, candidates, weight] of rankLists) {
    const seen = new Set<string>();
    candidates.forEach((cand, index) => {
      if (seen.has(cand.target)) return;
      seen.add(cand.target);
      scores.set(cand.target, (scores.get(cand.target) ?? 0) + weight / (RRF_K + index + 1));
      (labels.get(cand.target) ?? labels.set(cand.target, []).get(cand.target)!).push(`${label}@${index + 1}`);
      const existing = reps.get(cand.target);
      if (!existing) reps.set(cand.target, cloneCandidate(cand));
      else {
        if (!existing.symbol && cand.symbol) existing.symbol = cand.symbol;
        if (existing.kind === "unknown" && cand.kind !== "unknown") existing.kind = cand.kind;
        existing.evidence.push(...cand.evidence.filter((e) => !existing.evidence.includes(e)));
      }
    });
  }
  return [...reps.entries()].map(([target, cand]) => {
    const raw = scores.get(target) ?? 0;
    cand.score = Math.max(cand.score, 0) + raw * RRF_SCALE;
    cand.source = "rrf-fusion";
    cand.evidence.push(`ts rrf raw=${raw.toFixed(5)} ranks=${(labels.get(target) ?? []).join(",")}`);
    return cand;
  }).sort((a, b) => b.score - a.score);
}

export function isDocFile(file: string): boolean {
  return DOC_EXTS.has(path.extname(file.toLowerCase()));
}

export function isCodeFile(file: string): boolean {
  return CODE_EXTS.has(path.extname(file.toLowerCase()));
}

export function sameModule(pathA: string, pathB: string): boolean {
  const a = path.dirname(pathA);
  const b = path.dirname(pathB);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export function bm25HasStrongCluster(plan: QueryPlan, candidates: Candidate[]): [boolean, string] {
  if (candidates.length < 2) return [false, "not enough BM25 candidates"];
  const top = candidates.slice(0, 3);
  const topFile = candidateFile(top[0]!);
  const sameFileCount = top.filter((c) => candidateFile(c) === topFile).length;
  const sameDirCount = top.filter((c) => sameModule(candidateFile(c), topFile)).length;
  const gap = top[0]!.score - (top[1]?.score ?? 0);
  const pathText = top.map((c) => c.target.toLowerCase()).join(" ");
  const kwHits = domainKeywords(plan).filter((kw) => pathText.includes(kw.toLowerCase())).length;
  if (plan.intent !== "test" && isExplanationQuery(plan) && isTestTarget(topFile)) {
    return [false, `BM25 cluster ignored: explanation query top cluster is test-like path ${topFile}`];
  }
  if (sameFileCount >= 2 && kwHits >= 1) return [true, `BM25 cluster: ${sameFileCount}/${top.length} top candidates in ${topFile} with keyword path hit`];
  if (sameDirCount >= 3 && gap >= 2 && kwHits >= 1) return [true, `BM25 module cluster: ${sameDirCount}/${top.length} top candidates near ${path.dirname(topFile)}`];
  return [false, "BM25 cluster not strong"];
}
