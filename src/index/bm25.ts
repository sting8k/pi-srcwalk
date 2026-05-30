import path from "node:path";
import type { Candidate, CommandResult, LexicalIndex, QueryPlan, SrcwalkCommand } from "../domain/types.js";
import { STOP_WORDS, WEAK_KEYWORDS } from "../router/constants.js";
import { buildOrLoadIndex } from "./cache.js";
import { tokenize } from "./tokenize.js";

const FIRST_PASS_K = 12;
const PRF_DOCS = 5;
const PRF_TERMS = 5;

function idf(index: LexicalIndex, term: string): number {
  const n = index.chunks.length;
  const df = index.docFreq[term] ?? 0;
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

function score(index: LexicalIndex, queryTokens: string[], topK: number): Array<[number, number]> {
  if (!index.chunks.length || !queryTokens.length) return [];
  const q = new Map<string, number>();
  for (const token of queryTokens) q.set(token, (q.get(token) ?? 0) + 1);
  const scores = new Map<number, number>();
  const k1 = 1.5;
  const b = 0.75;
  for (const [term, qWeight] of q) {
    const posting = index.postings[term];
    if (!posting) continue;
    const termIdf = idf(index, term);
    for (const [idx, freq] of posting) {
      const dl = index.docLens[idx] || 1;
      const denom = freq + k1 * (1 - b + b * dl / (index.avgdl || 1));
      scores.set(idx, (scores.get(idx) ?? 0) + qWeight * termIdf * (freq * (k1 + 1)) / denom);
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK);
}

function feedbackTerms(index: LexicalIndex, top: Array<[number, number]>, queryTokens: string[]): string[] {
  const querySet = new Set(queryTokens);
  const weights = new Map<string, number>();
  for (const [idx] of top.slice(0, PRF_DOCS)) {
    const counts = new Map<string, number>();
    for (const term of index.chunks[idx]?.tokens ?? []) counts.set(term, (counts.get(term) ?? 0) + 1);
    for (const [term, tf] of counts) {
      if (querySet.has(term) || STOP_WORDS.has(term) || WEAK_KEYWORDS.has(term) || term.length <= 2) continue;
      weights.set(term, (weights.get(term) ?? 0) + tf * idf(index, term));
    }
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, PRF_TERMS).map(([term]) => term);
}

export function shouldRunBm25(plan: QueryPlan): boolean {
  if (["explicit_target", "file", "file_deps", "overview", "symbol"].includes(plan.queryKind)) return false;
  return ["general", "definition", "test", "related"].includes(plan.intent);
}

export async function bm25Search(repo: string, scope: string, query: string, maxResults: number): Promise<{ result: CommandResult; candidates: Candidate[]; notes: string[]; index: LexicalIndex }> {
  const started = performance.now();
  const index = await buildOrLoadIndex(repo, scope);
  const queryTokens = tokenize(query);
  const first = score(index, queryTokens, FIRST_PASS_K);
  const derived = feedbackTerms(index, first, queryTokens);
  const finalTokens = [...queryTokens, ...derived];
  const final = score(index, finalTokens, maxResults);
  const elapsedMs = Math.round(performance.now() - started);
  index.stats.queryMs = elapsedMs;

  const lines = [
    `TS BM25/PRF retrieval scope=${scope}`,
    `cache_dir=${index.stats.cacheDir}`,
    `cache_hit=${index.stats.cacheHit} chunks=${index.stats.chunks} files=${index.stats.files} cache_size_mb=${(index.stats.sizeBytes / (1024 * 1024)).toFixed(2)}`,
    `cache_prepare_ms=${index.stats.buildMs} query_ms=${elapsedMs}`,
    `query_tokens=${JSON.stringify(queryTokens)}`,
    `derived_terms=${JSON.stringify(derived)}`,
  ];
  const candidates: Candidate[] = [];
  final.forEach(([idx, rawScore], rank) => {
    const chunk = index.chunks[idx]!;
    const target = `${chunk.path}:${chunk.start}-${chunk.end}`;
    const lowerPath = chunk.path.toLowerCase();
    const basename = path.basename(chunk.path).toLowerCase();
    const uniqueQueryTokens = [...new Set(queryTokens)];
    const pathHits = uniqueQueryTokens.filter((tok) => lowerPath.includes(tok)).length;
    const basenameHits = uniqueQueryTokens.filter((tok) => basename.includes(tok)).length;
    const scaled = 95 - (rank + 1) * 4 + pathHits * 12 + basenameHits * 8;
    candidates.push({
      target,
      source: derived.length ? "ts-bm25-prf" : "ts-bm25",
      commandLabel: "ts-bm25-prf",
      kind: "chunk",
      score: scaled,
      evidence: [`ts-bm25 rank=${rank + 1} raw_score=${rawScore.toFixed(3)} path_hits=${pathHits} basename_hits=${basenameHits} terms=${finalTokens.slice(0, 12).join(",")}`],
    });
    lines.push(`${rank + 1}. ${target} score=${rawScore.toFixed(3)} preview=${chunk.text.trim().replace(/\s+/g, " ").slice(0, 180)}`);
  });
  const command: SrcwalkCommand = { label: "ts-bm25-prf", args: ["pi-srcwalk", "bm25", query, "--scope", scope], purpose: "TypeScript BM25 + repo-derived expansion", parseAs: "bm25" };
  const result: CommandResult = { command, output: lines.join("\n"), code: final.length ? 0 : 2, elapsedMs };
  const notes = final.length ? [`TS cache ${index.stats.cacheHit ? "hit" : "built"} for scope \`${scope}\`: ${index.stats.chunks} chunks, ${(index.stats.sizeBytes / (1024 * 1024)).toFixed(2)}MB under ${index.stats.cacheDir}, prepare ${index.stats.buildMs}ms, query ${elapsedMs}ms.`] : ["TS BM25/PRF produced no candidates; falling back to srcwalk strategies."];
  return { result, candidates, notes, index };
}
