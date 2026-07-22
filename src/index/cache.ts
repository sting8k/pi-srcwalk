import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { LexicalIndex } from "../domain/types.js";
import { iterFilesDetailed, type IterFilesResult } from "./files.js";
import { tokenize } from "./tokenize.js";
import { runSingleFlight, runWithRepoBuildQueue } from "../cache/build-coordinator.js";

const CACHE_VERSION = "ts-memory-compact-bm25-2026-06-03";
const CHUNK_LINES = 80;
const CHUNK_OVERLAP = 10;
const PREVIEW_CHARS = 180;
const DEFAULT_MAX_MEMORY_CACHE_ENTRIES = 4;
const DEFAULT_MAX_MEMORY_CACHE_MB = 512;
const DEFAULT_MAX_INDEXED_FILES = 10_000;
const DEFAULT_MAX_INDEX_MB = 25;
const FINGERPRINT_TTL_MS = 1_000;

interface MemoryEntry {
  fingerprint: string;
  index: LexicalIndex;
  lastAccess: number;
  sizeBytes: number;
}

interface FingerprintEntry {
  fingerprint: string;
  fileSet: IterFilesResult;
  cachedAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();
const fingerprintCache = new Map<string, FingerprintEntry>();
const indexBuilds = new Map<string, Promise<LexicalIndex>>();

export function cacheRoot(): string {
  return "memory";
}

function cacheKey(repo: string, scope: string): string {
  return createHash("sha256").update(`${path.resolve(repo)}\n${scope}\n${CACHE_VERSION}`).digest("hex").slice(0, 20);
}

async function fingerprintFiles(repo: string, scope: string, key: string, allowCached: boolean): Promise<{ fingerprint: string; fileSet: IterFilesResult }> {
  const now = Date.now();
  const cached = fingerprintCache.get(key);
  if (allowCached && cached && now - cached.cachedAt <= FINGERPRINT_TTL_MS) return { fingerprint: cached.fingerprint, fileSet: cached.fileSet };

  const fileSet = await iterFilesDetailed(repo, scope);
  const h = createHash("sha256");
  for (const file of fileSet.files) {
    const s = await stat(file).catch(() => undefined);
    if (!s) continue;
    const rel = path.relative(repo, file).split(path.sep).join("/");
    h.update(rel).update("\0").update(String(s.size)).update("\0").update(String(s.mtimeMs)).update("\n");
  }
  const result = { fingerprint: h.digest("hex"), fileSet };
  fingerprintCache.set(key, { ...result, cachedAt: Date.now() });
  return result;
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

function maxMemoryEntries(): number {
  return positiveIntEnv("PI_SRCWALK_MEMORY_CACHE_ENTRIES", DEFAULT_MAX_MEMORY_CACHE_ENTRIES);
}

function maxMemoryBytes(): number {
  return positiveIntEnv("PI_SRCWALK_MEMORY_CACHE_MAX_MB", DEFAULT_MAX_MEMORY_CACHE_MB) * 1024 * 1024;
}

export function maxBm25IndexedFiles(): number {
  return positiveIntEnv("PI_SRCWALK_BM25_MAX_INDEXED_FILES", DEFAULT_MAX_INDEXED_FILES);
}

export function maxBm25IndexBytes(): number {
  return positiveIntEnv("PI_SRCWALK_BM25_MAX_INDEX_MB", DEFAULT_MAX_INDEX_MB) * 1024 * 1024;
}

export function shouldUseStreamingBm25(fileSet: IterFilesResult): boolean {
  return fileSet.walkCapped || fileSet.files.length > maxBm25IndexedFiles() || fileSet.totalBytes > maxBm25IndexBytes();
}

export async function collectBm25Files(repo: string, scope: string, signal?: AbortSignal): Promise<IterFilesResult> {
  return iterFilesDetailed(path.resolve(repo), scope, signal);
}

function stringBytes(value: string): number {
  return value.length * 2;
}

function estimateIndexSize(index: LexicalIndex): number {
  let bytes = 0;
  bytes += index.chunkPathIds.byteLength + index.chunkStarts.byteLength + index.chunkEnds.byteLength;
  bytes += index.docFreq.byteLength + index.docLens.byteLength;
  bytes += index.postings.offsets.byteLength + index.postings.docs.byteLength + index.postings.freqs.byteLength;
  bytes += index.docTerms.offsets.byteLength + index.docTerms.termIds.byteLength + index.docTerms.freqs.byteLength;
  bytes += index.paths.reduce((sum, value) => sum + stringBytes(value), 0);
  bytes += index.chunkPreviews.reduce((sum, value) => sum + stringBytes(value), 0);
  bytes += index.vocab.reduce((sum, value) => sum + stringBytes(value), 0);
  bytes += index.termIds.size * 32;
  return bytes;
}

function pruneMemoryCache(protectedKey: string): void {
  const maxEntries = maxMemoryEntries();
  const maxBytes = maxMemoryBytes();
  let totalBytes = [...memoryCache.values()].reduce((sum, entry) => sum + entry.sizeBytes, 0);

  while (memoryCache.size > maxEntries || totalBytes > maxBytes) {
    const evictable = [...memoryCache.entries()]
      .filter(([key]) => key !== protectedKey || memoryCache.size > 1)
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)[0];
    if (!evictable) break;
    memoryCache.delete(evictable[0]);
    fingerprintCache.delete(evictable[0]);
    totalBytes -= evictable[1].sizeBytes;
  }
}

function touchMemoryEntry(key: string, entry: MemoryEntry): void {
  entry.lastAccess = Date.now();
  memoryCache.delete(key);
  memoryCache.set(key, entry);
}

function pathIdFor(paths: string[], pathIds: Map<string, number>, rel: string): number {
  const existing = pathIds.get(rel);
  if (existing !== undefined) return existing;
  const next = paths.length;
  paths.push(rel);
  pathIds.set(rel, next);
  return next;
}

function termIdFor(vocab: string[], termIds: Map<string, number>, term: string): number {
  const existing = termIds.get(term);
  if (existing !== undefined) return existing;
  const next = vocab.length;
  vocab.push(term);
  termIds.set(term, next);
  return next;
}

function toUint16(value: number): number {
  return Math.min(value, 0xffff);
}

function preview(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, PREVIEW_CHARS);
}

function buildPostings(vocabSize: number, postingsByTerm: Map<number, Array<[number, number]>>) {
  const offsets = new Uint32Array(vocabSize + 1);
  let total = 0;
  for (let termId = 0; termId < vocabSize; termId += 1) {
    offsets[termId] = total;
    total += postingsByTerm.get(termId)?.length ?? 0;
  }
  offsets[vocabSize] = total;

  const docs = new Uint32Array(total);
  const freqs = new Uint16Array(total);
  const docFreq = new Uint32Array(vocabSize);
  let cursor = 0;
  for (let termId = 0; termId < vocabSize; termId += 1) {
    const postings = postingsByTerm.get(termId) ?? [];
    docFreq[termId] = postings.length;
    for (const [doc, freq] of postings) {
      docs[cursor] = doc;
      freqs[cursor] = toUint16(freq);
      cursor += 1;
    }
  }
  return { docFreq, postings: { offsets, docs, freqs } };
}

function buildDocTerms(offsetsRaw: number[], termIdsRaw: number[], freqsRaw: number[]) {
  return {
    offsets: Uint32Array.from(offsetsRaw),
    termIds: Uint32Array.from(termIdsRaw),
    freqs: Uint16Array.from(freqsRaw.map(toUint16)),
  };
}

function streamingMarkerIndex(location: string, fingerprint: string, fileSet: IterFilesResult, buildMs: number): LexicalIndex {
  const notes = [
    `BM25 index acceleration budget exceeded; using streaming retrieval for ${fileSet.files.length} discovered files`,
    ...fileSet.notes,
  ];
  return {
    chunkCount: 0,
    paths: [],
    chunkPathIds: new Uint32Array(),
    chunkStarts: new Uint32Array(),
    chunkEnds: new Uint32Array(),
    chunkPreviews: [],
    vocab: [],
    termIds: new Map<string, number>(),
    docFreq: new Uint32Array(),
    docLens: new Uint32Array(),
    postings: { offsets: new Uint32Array(), docs: new Uint32Array(), freqs: new Uint16Array() },
    docTerms: { offsets: new Uint32Array(), termIds: new Uint32Array(), freqs: new Uint16Array() },
    avgdl: 0,
    stats: {
      cacheKind: "memory",
      cacheLocation: `streaming:${location}`,
      cacheHit: false,
      chunks: 0,
      files: fileSet.files.length,
      fingerprint,
      buildMs,
      queryMs: 0,
      sizeBytes: 0,
      retrievalMode: "streaming",
      coverageCapped: fileSet.walkCapped,
      eligibleFiles: fileSet.files.length,
      totalBytes: fileSet.totalBytes,
      notes,
    },
  };
}

export async function buildOrLoadIndex(repoInput: string, scope: string): Promise<LexicalIndex> {
  const repo = path.resolve(repoInput);
  const key = cacheKey(repo, scope);
  return runSingleFlight(indexBuilds, key, () => runWithRepoBuildQueue(repo, () => buildOrLoadIndexUncoordinated(repo, scope, key)));
}

async function buildOrLoadIndexUncoordinated(repo: string, scope: string, key: string): Promise<LexicalIndex> {
  const started = performance.now();
  const location = `memory:${key}`;
  const cached = memoryCache.get(key);
  const { fingerprint, fileSet } = await fingerprintFiles(repo, scope, key, Boolean(cached));
  const files = fileSet.files;
  if (cached?.fingerprint === fingerprint) {
    touchMemoryEntry(key, cached);
    const buildMs = Math.round(performance.now() - started);
    cached.index.stats = { ...cached.index.stats, cacheHit: true, files: files.length, fingerprint, buildMs, queryMs: 0 };
    return cached.index;
  }
  if (cached) memoryCache.delete(key);
  if (shouldUseStreamingBm25(fileSet)) return streamingMarkerIndex(key, fingerprint, fileSet, Math.round(performance.now() - started));

  const paths: string[] = [];
  const pathIds = new Map<string, number>();
  const chunkPathIdsRaw: number[] = [];
  const chunkStartsRaw: number[] = [];
  const chunkEndsRaw: number[] = [];
  const chunkPreviews: string[] = [];
  const vocab: string[] = [];
  const termIds = new Map<string, number>();
  const docLensRaw: number[] = [];
  const postingsByTerm = new Map<number, Array<[number, number]>>();
  const docTermOffsetsRaw: number[] = [0];
  const docTermIdsRaw: number[] = [];
  const docTermFreqsRaw: number[] = [];
  const step = Math.max(1, CHUNK_LINES - CHUNK_OVERLAP);

  for (const file of files) {
    const rel = path.relative(repo, file).split(path.sep).join("/");
    const text = await readFile(file, "utf8").catch(() => undefined);
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    if (!lines.length) continue;
    const pathTokens = tokenize(rel.replaceAll("/", " "));
    const pathId = pathIdFor(paths, pathIds, rel);
    for (let startLine = 0; startLine < lines.length; startLine += step) {
      const block = lines.slice(startLine, startLine + CHUNK_LINES);
      if (!block.length) continue;
      const chunkText = block.join("\n");
      const tokens = [...pathTokens, ...tokenize(chunkText)];
      if (tokens.length < 3) continue;

      const counts = new Map<number, number>();
      for (const token of tokens) {
        const termId = termIdFor(vocab, termIds, token);
        counts.set(termId, (counts.get(termId) ?? 0) + 1);
      }

      const docId = chunkPathIdsRaw.length;
      chunkPathIdsRaw.push(pathId);
      chunkStartsRaw.push(startLine + 1);
      chunkEndsRaw.push(startLine + block.length);
      chunkPreviews.push(preview(chunkText));
      docLensRaw.push(tokens.length);

      const sortedTerms = [...counts.entries()].sort((a, b) => a[0] - b[0]);
      for (const [termId, freq] of sortedTerms) {
        if (!postingsByTerm.has(termId)) postingsByTerm.set(termId, []);
        postingsByTerm.get(termId)!.push([docId, freq]);
        docTermIdsRaw.push(termId);
        docTermFreqsRaw.push(freq);
      }
      docTermOffsetsRaw.push(docTermIdsRaw.length);
    }
  }

  const docLens = Uint32Array.from(docLensRaw);
  const { docFreq, postings } = buildPostings(vocab.length, postingsByTerm);
  const docTerms = buildDocTerms(docTermOffsetsRaw, docTermIdsRaw, docTermFreqsRaw);
  const avgdl = docLens.length ? docLensRaw.reduce((a, b) => a + b, 0) / docLens.length : 0;
  const buildMs = Math.round(performance.now() - started);
  const index: LexicalIndex = {
    chunkCount: chunkPathIdsRaw.length,
    paths,
    chunkPathIds: Uint32Array.from(chunkPathIdsRaw),
    chunkStarts: Uint32Array.from(chunkStartsRaw),
    chunkEnds: Uint32Array.from(chunkEndsRaw),
    chunkPreviews,
    vocab,
    termIds,
    docFreq,
    docLens,
    postings,
    docTerms,
    avgdl,
    stats: {
      cacheKind: "memory",
      cacheLocation: location,
      cacheHit: false,
      chunks: chunkPathIdsRaw.length,
      files: files.length,
      fingerprint,
      buildMs,
      queryMs: 0,
      sizeBytes: 0,
      retrievalMode: "indexed",
      coverageCapped: fileSet.walkCapped,
      eligibleFiles: files.length,
      totalBytes: fileSet.totalBytes,
      notes: fileSet.notes,
    },
  };
  index.stats.sizeBytes = estimateIndexSize(index);

  if (index.stats.sizeBytes <= maxMemoryBytes()) {
    const entry: MemoryEntry = { fingerprint, index, lastAccess: Date.now(), sizeBytes: index.stats.sizeBytes };
    memoryCache.set(key, entry);
    pruneMemoryCache(key);
  } else {
    index.stats.cacheLocation = `uncached:${key}`;
    index.stats.notes = [...(index.stats.notes ?? []), `BM25 index estimate ${(index.stats.sizeBytes / (1024 * 1024)).toFixed(2)}MB exceeded retained cache budget; result was not cached`];
  }
  return index;
}
