import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Candidate, CommandResult, LexicalIndex, QueryPlan, SrcwalkCommand } from "../domain/types.js";
import { STOP_WORDS, WEAK_KEYWORDS } from "../router/constants.js";
import { buildOrLoadIndex, collectBm25Files } from "./cache.js";
import { tokenize } from "./tokenize.js";

const FIRST_PASS_K = 12;
const PRF_DOCS = 5;
const PRF_TERMS = 5;
const CHUNK_LINES = 80;
const CHUNK_OVERLAP = 10;
const PREVIEW_CHARS = 180;

interface HeapEntry<T> {
  item: T;
  score: number;
  order: number;
}

interface StreamingDocScore {
  path: string;
  start: number;
  end: number;
  preview: string;
  rawScore: number;
}

function worseThan<T>(a: HeapEntry<T>, b: HeapEntry<T>): boolean {
  return a.score < b.score || (a.score === b.score && a.order > b.order);
}

function betterThan<T>(a: HeapEntry<T>, b: HeapEntry<T>): boolean {
  return a.score > b.score || (a.score === b.score && a.order < b.order);
}

function siftUp<T>(heap: Array<HeapEntry<T>>, index: number): void {
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (!worseThan(heap[index]!, heap[parent]!)) break;
    [heap[index], heap[parent]] = [heap[parent]!, heap[index]!];
    index = parent;
  }
}

function siftDown<T>(heap: Array<HeapEntry<T>>, index: number): void {
  for (;;) {
    const left = index * 2 + 1;
    const right = left + 1;
    let worst = index;
    if (left < heap.length && worseThan(heap[left]!, heap[worst]!)) worst = left;
    if (right < heap.length && worseThan(heap[right]!, heap[worst]!)) worst = right;
    if (worst === index) return;
    [heap[index], heap[worst]] = [heap[worst]!, heap[index]!];
    index = worst;
  }
}

function topKByScore<T>(items: Iterable<T>, topK: number, scoreOf: (item: T) => number): T[] {
  if (topK <= 0) return [];
  const heap: Array<HeapEntry<T>> = [];
  let order = 0;
  for (const item of items) {
    const entry = { item, score: scoreOf(item), order };
    order += 1;
    if (heap.length < topK) {
      heap.push(entry);
      siftUp(heap, heap.length - 1);
    } else if (betterThan(entry, heap[0]!)) {
      heap[0] = entry;
      siftDown(heap, 0);
    }
  }
  return heap.sort((a, b) => b.score - a.score || a.order - b.order).map((entry) => entry.item);
}

function idf(index: LexicalIndex, termId: number): number {
  const n = index.chunkCount;
  const df = index.docFreq[termId] ?? 0;
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

function chunkPath(index: LexicalIndex, idx: number): string {
  return index.paths[index.chunkPathIds[idx] ?? 0] ?? "";
}

function preview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, PREVIEW_CHARS);
}

function score(index: LexicalIndex, queryTokens: string[], topK: number): Array<[number, number]> {
  if (!index.chunkCount || !queryTokens.length) return [];
  const q = new Map<number, number>();
  for (const token of queryTokens) {
    const termId = index.termIds.get(token);
    if (termId !== undefined) q.set(termId, (q.get(termId) ?? 0) + 1);
  }
  const scores = new Map<number, number>();
  const k1 = 1.5;
  const b = 0.75;
  for (const [termId, qWeight] of q) {
    const start = index.postings.offsets[termId] ?? 0;
    const end = index.postings.offsets[termId + 1] ?? start;
    if (start === end) continue;
    const termIdf = idf(index, termId);
    for (let cursor = start; cursor < end; cursor += 1) {
      const idx = index.postings.docs[cursor]!;
      const freq = index.postings.freqs[cursor]!;
      const dl = index.docLens[idx] || 1;
      const denom = freq + k1 * (1 - b + b * dl / (index.avgdl || 1));
      scores.set(idx, (scores.get(idx) ?? 0) + qWeight * termIdf * (freq * (k1 + 1)) / denom);
    }
  }
  return topKByScore(scores.entries(), topK, ([, value]) => value);
}

function feedbackTerms(index: LexicalIndex, top: Array<[number, number]>, queryTokens: string[]): string[] {
  const querySet = new Set(queryTokens);
  const weights = new Map<number, number>();
  for (const [idx] of top.slice(0, PRF_DOCS)) {
    const start = index.docTerms.offsets[idx] ?? 0;
    const end = index.docTerms.offsets[idx + 1] ?? start;
    for (let cursor = start; cursor < end; cursor += 1) {
      const termId = index.docTerms.termIds[cursor]!;
      const term = index.vocab[termId] ?? "";
      const tf = index.docTerms.freqs[cursor]!;
      if (querySet.has(term) || STOP_WORDS.has(term) || WEAK_KEYWORDS.has(term) || term.length <= 2) continue;
      weights.set(termId, (weights.get(termId) ?? 0) + tf * idf(index, termId));
    }
  }
  return topKByScore(weights.entries(), PRF_TERMS, ([, value]) => value).map(([termId]) => index.vocab[termId] ?? "").filter(Boolean);
}

async function streamingBm25(repo: string, scope: string, queryTokens: string[], maxResults: number): Promise<{ final: StreamingDocScore[]; notes: string[]; files: number; chunks: number; totalBytes: number; coverageCapped: boolean }> {
  const fileSet = await collectBm25Files(repo, scope);
  const queryWeights = new Map<string, number>();
  for (const token of queryTokens) queryWeights.set(token, (queryWeights.get(token) ?? 0) + 1);
  const querySet = new Set(queryWeights.keys());
  const docFreq = new Map<string, number>();
  let chunks = 0;
  let totalDocLen = 0;
  const step = Math.max(1, CHUNK_LINES - CHUNK_OVERLAP);

  for (const file of fileSet.files) {
    const rel = path.relative(repo, file).split(path.sep).join("/");
    const text = await readFile(file, "utf8").catch(() => undefined);
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    const pathTokens = tokenize(rel.replaceAll("/", " "));
    for (let startLine = 0; startLine < lines.length; startLine += step) {
      const block = lines.slice(startLine, startLine + CHUNK_LINES);
      if (!block.length) continue;
      const tokens = [...pathTokens, ...tokenize(block.join("\n"))];
      if (tokens.length < 3) continue;
      chunks += 1;
      totalDocLen += tokens.length;
      const present = new Set(tokens.filter((token) => querySet.has(token)));
      for (const token of present) docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  const avgdl = chunks ? totalDocLen / chunks : 0;
  const topHeap: Array<HeapEntry<StreamingDocScore>> = [];
  let order = 0;
  function offerTop(item: StreamingDocScore): void {
    const entry = { item, score: item.rawScore, order };
    order += 1;
    if (topHeap.length < maxResults) {
      topHeap.push(entry);
      siftUp(topHeap, topHeap.length - 1);
    } else if (betterThan(entry, topHeap[0]!)) {
      topHeap[0] = entry;
      siftDown(topHeap, 0);
    }
  }

  for (const file of fileSet.files) {
    const rel = path.relative(repo, file).split(path.sep).join("/");
    const text = await readFile(file, "utf8").catch(() => undefined);
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    const pathTokens = tokenize(rel.replaceAll("/", " "));
    for (let startLine = 0; startLine < lines.length; startLine += step) {
      const block = lines.slice(startLine, startLine + CHUNK_LINES);
      if (!block.length) continue;
      const chunkText = block.join("\n");
      const tokens = [...pathTokens, ...tokenize(chunkText)];
      if (tokens.length < 3) continue;
      const counts = new Map<string, number>();
      for (const token of tokens) if (querySet.has(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
      let rawScore = 0;
      for (const [token, freq] of counts) {
        const df = docFreq.get(token) ?? 0;
        if (!df) continue;
        const termIdf = Math.log(1 + (chunks - df + 0.5) / (df + 0.5));
        const dl = tokens.length || 1;
        const denom = freq + 1.5 * (1 - 0.75 + 0.75 * dl / (avgdl || 1));
        rawScore += (queryWeights.get(token) ?? 1) * termIdf * (freq * 2.5) / denom;
      }
      if (rawScore > 0) offerTop({ path: rel, start: startLine + 1, end: startLine + block.length, preview: preview(chunkText), rawScore });
    }
  }

  return {
    final: topHeap.sort((a, b) => b.score - a.score || a.order - b.order).map((entry) => entry.item),
    notes: [
      fileSet.walkCapped
        ? `TS BM25 streaming mode scanned ${fileSet.files.length} discovered files / ${chunks} chunks with incomplete coverage because the walk cap was reached; PRF disabled to stay memory bounded.`
        : `TS BM25 streaming mode scanned ${fileSet.files.length} files / ${chunks} chunks with full discovered-file coverage; PRF disabled to stay memory bounded.`,
      ...fileSet.notes,
    ],
    files: fileSet.files.length,
    chunks,
    totalBytes: fileSet.totalBytes,
    coverageCapped: fileSet.walkCapped,
  };
}

export function shouldRunBm25(plan: QueryPlan): boolean {
  if (["explicit_target", "file", "file_deps", "overview", "symbol"].includes(plan.queryKind)) return false;
  return ["general", "definition", "test", "related"].includes(plan.intent);
}

export async function bm25Search(repo: string, scope: string, query: string, maxResults: number): Promise<{ result: CommandResult; candidates: Candidate[]; notes: string[]; index: LexicalIndex }> {
  const started = performance.now();
  const index = await buildOrLoadIndex(repo, scope);
  const queryTokens = tokenize(query);
  if (index.stats.retrievalMode === "streaming") {
    const streaming = await streamingBm25(repo, scope, queryTokens, maxResults);
    const elapsedMs = Math.round(performance.now() - started);
    index.stats.queryMs = elapsedMs;
    index.stats.chunks = streaming.chunks;
    index.stats.files = streaming.files;
    index.stats.totalBytes = streaming.totalBytes;
    index.stats.coverageCapped = streaming.coverageCapped;
    const lines = [
      `TS BM25 streaming retrieval scope=${scope}`,
      `cache_location=${index.stats.cacheLocation}`,
      `cache_kind=${index.stats.cacheKind} cache_hit=false chunks=${streaming.chunks} files=${streaming.files} estimated_mem_mb=0.00 retrieval_mode=streaming`,
      `cache_prepare_ms=${index.stats.buildMs} query_ms=${elapsedMs}`,
      `query_tokens=${JSON.stringify(queryTokens)}`,
      `derived_terms=[]`,
    ];
    const candidates: Candidate[] = [];
    streaming.final.forEach((item, rank) => {
      const target = `${item.path}:${item.start}-${item.end}`;
      const lowerPath = item.path.toLowerCase();
      const basename = path.basename(item.path).toLowerCase();
      const uniqueQueryTokens = [...new Set(queryTokens)];
      const pathHits = uniqueQueryTokens.filter((tok) => lowerPath.includes(tok)).length;
      const basenameHits = uniqueQueryTokens.filter((tok) => basename.includes(tok)).length;
      const scaled = 95 - (rank + 1) * 4 + pathHits * 12 + basenameHits * 8;
      candidates.push({
        target,
        source: "ts-bm25-streaming",
        commandLabel: "ts-bm25-streaming",
        kind: "chunk",
        score: scaled,
        evidence: [`ts-bm25-streaming rank=${rank + 1} raw_score=${item.rawScore.toFixed(3)} path_hits=${pathHits} basename_hits=${basenameHits} terms=${queryTokens.slice(0, 12).join(",")}`],
      });
      lines.push(`${rank + 1}. ${target} score=${item.rawScore.toFixed(3)} preview=${item.preview}`);
    });
    const command: SrcwalkCommand = { label: "ts-bm25-streaming", args: ["pi-srcwalk", "bm25", query, "--scope", scope], purpose: "TypeScript streaming BM25 fallback", parseAs: "bm25" };
    const result: CommandResult = { command, output: lines.join("\n"), code: streaming.final.length ? 0 : 2, elapsedMs };
    const notes = streaming.final.length ? [...(index.stats.notes ?? []), ...streaming.notes] : ["TS BM25 streaming produced no candidates; falling back to srcwalk strategies.", ...(index.stats.notes ?? []), ...streaming.notes];
    return { result, candidates, notes, index };
  }

  const first = score(index, queryTokens, FIRST_PASS_K);
  const derived = feedbackTerms(index, first, queryTokens);
  const finalTokens = [...queryTokens, ...derived];
  const final = score(index, finalTokens, maxResults);
  const elapsedMs = Math.round(performance.now() - started);
  index.stats.queryMs = elapsedMs;

  const lines = [
    `TS BM25/PRF retrieval scope=${scope}`,
    `cache_location=${index.stats.cacheLocation}`,
    `cache_kind=${index.stats.cacheKind} cache_hit=${index.stats.cacheHit} chunks=${index.stats.chunks} files=${index.stats.files} estimated_mem_mb=${(index.stats.sizeBytes / (1024 * 1024)).toFixed(2)} retrieval_mode=${index.stats.retrievalMode ?? "indexed"}`,
    `cache_prepare_ms=${index.stats.buildMs} query_ms=${elapsedMs}`,
    `query_tokens=${JSON.stringify(queryTokens)}`,
    `derived_terms=${JSON.stringify(derived)}`,
  ];
  const candidates: Candidate[] = [];
  final.forEach(([idx, rawScore], rank) => {
    const chunkPathValue = chunkPath(index, idx);
    const target = `${chunkPathValue}:${index.chunkStarts[idx]}-${index.chunkEnds[idx]}`;
    const lowerPath = chunkPathValue.toLowerCase();
    const basename = path.basename(chunkPathValue).toLowerCase();
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
    lines.push(`${rank + 1}. ${target} score=${rawScore.toFixed(3)} preview=${index.chunkPreviews[idx] ?? ""}`);
  });
  const command: SrcwalkCommand = { label: "ts-bm25-prf", args: ["pi-srcwalk", "bm25", query, "--scope", scope], purpose: "TypeScript BM25 + repo-derived expansion", parseAs: "bm25" };
  const result: CommandResult = { command, output: lines.join("\n"), code: final.length ? 0 : 2, elapsedMs };
  const notes = final.length
    ? [`TS memory cache ${index.stats.cacheHit ? "hit" : index.stats.cacheLocation.startsWith("uncached:") ? "skipped" : "built"} for scope \`${scope}\`: ${index.stats.chunks} chunks, estimated ${(index.stats.sizeBytes / (1024 * 1024)).toFixed(2)}MB at ${index.stats.cacheLocation}, prepare ${index.stats.buildMs}ms, query ${elapsedMs}ms.`, ...(index.stats.notes ?? [])]
    : ["TS BM25/PRF produced no candidates; falling back to srcwalk strategies.", ...(index.stats.notes ?? [])];
  return { result, candidates, notes, index };
}
