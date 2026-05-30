import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CacheStats, Chunk, LexicalIndex } from "../domain/types.js";
import { iterFiles } from "./files.js";
import { tokenize } from "./tokenize.js";

const CACHE_VERSION = "ts-cache-json-bm25-2026-05-30";
const CHUNK_LINES = 80;
const CHUNK_OVERLAP = 10;

interface Manifest {
  cacheVersion: string;
  repo: string;
  scope: string;
  fingerprint: string;
  files: number;
  chunks: number;
  createdAt: number;
  format: string;
}

interface DiskIndex {
  docFreq: Record<string, number>;
  docLens: number[];
  postings: Record<string, Array<[number, number]>>;
  avgdl: number;
}

export function cacheRoot(): string {
  return process.env.PI_SRCWALK_CACHE || path.join(os.tmpdir(), "pi-srcwalk-ts-cache");
}

function cacheKey(repo: string, scope: string): string {
  return createHash("sha256").update(`${path.resolve(repo)}\n${scope}\n${CACHE_VERSION}`).digest("hex").slice(0, 20);
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  async function walk(current: string): Promise<void> {
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(current, { withFileTypes: true }).catch(() => []));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) total += (await stat(full).catch(() => ({ size: 0 }))).size;
    }
  }
  await walk(dir);
  return total;
}

async function fingerprintFiles(repo: string, scope: string): Promise<{ fingerprint: string; files: string[] }> {
  const files = await iterFiles(repo, scope);
  const h = createHash("sha256");
  for (const file of files) {
    const s = await stat(file).catch(() => undefined);
    if (!s) continue;
    const rel = path.relative(repo, file).split(path.sep).join("/");
    h.update(rel).update("\0").update(String(s.size)).update("\0").update(String(s.mtimeMs)).update("\n");
  }
  return { fingerprint: h.digest("hex"), files };
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

async function loadChunks(file: string): Promise<Chunk[]> {
  const text = await readFile(file, "utf8");
  return text.split("\n").filter(Boolean).map((line) => JSON.parse(line) as Chunk);
}

async function writeAtomic(file: string, data: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, data, "utf8");
  await rename(tmp, file);
}

export async function buildOrLoadIndex(repoInput: string, scope: string): Promise<LexicalIndex> {
  const started = performance.now();
  const repo = path.resolve(repoInput);
  const dir = path.join(cacheRoot(), cacheKey(repo, scope));
  const manifestPath = path.join(dir, "manifest.json");
  const chunksPath = path.join(dir, "chunks.jsonl");
  const indexPath = path.join(dir, "index.json");
  const { fingerprint, files } = await fingerprintFiles(repo, scope);
  const manifest = await readJson<Manifest>(manifestPath);
  const disk = await readJson<DiskIndex>(indexPath);
  if (manifest?.fingerprint === fingerprint && manifest.cacheVersion === CACHE_VERSION && disk) {
    const chunks = await loadChunks(chunksPath).catch(() => undefined);
    if (chunks) {
      const buildMs = Math.round(performance.now() - started);
      return {
        chunks,
        docFreq: disk.docFreq,
        docLens: disk.docLens,
        postings: disk.postings,
        avgdl: disk.avgdl,
        stats: {
          cacheDir: dir,
          cacheHit: true,
          chunks: chunks.length,
          files: manifest.files,
          fingerprint,
          buildMs,
          queryMs: 0,
          sizeBytes: await dirSize(dir),
        },
      };
    }
  }

  const chunks: Chunk[] = [];
  const step = Math.max(1, CHUNK_LINES - CHUNK_OVERLAP);
  for (const file of files) {
    const rel = path.relative(repo, file).split(path.sep).join("/");
    const text = await readFile(file, "utf8").catch(() => undefined);
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    if (!lines.length) continue;
    const pathTokens = tokenize(rel.replaceAll("/", " "));
    for (let startLine = 0; startLine < lines.length; startLine += step) {
      const block = lines.slice(startLine, startLine + CHUNK_LINES);
      if (!block.length) continue;
      const chunkText = block.join("\n");
      const tokens = [...pathTokens, ...tokenize(chunkText)];
      if (tokens.length < 3) continue;
      chunks.push({ path: rel, start: startLine + 1, end: startLine + block.length, text: chunkText, tokens });
    }
  }

  const docFreq: Record<string, number> = Object.create(null) as Record<string, number>;
  const docLens: number[] = [];
  const postings: Record<string, Array<[number, number]>> = Object.create(null) as Record<string, Array<[number, number]>>;
  chunks.forEach((chunk, idx) => {
    docLens.push(chunk.tokens.length);
    const counts = new Map<string, number>();
    for (const token of chunk.tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    for (const [term, freq] of counts) {
      docFreq[term] = (Object.prototype.hasOwnProperty.call(docFreq, term) ? docFreq[term]! : 0) + 1;
      if (!Object.prototype.hasOwnProperty.call(postings, term)) postings[term] = [];
      postings[term]!.push([idx, freq]);
    }
  });
  const avgdl = docLens.length ? docLens.reduce((a, b) => a + b, 0) / docLens.length : 0;
  const buildMs = Math.round(performance.now() - started);
  await mkdir(dir, { recursive: true });
  await writeAtomic(chunksPath, chunks.map((chunk) => JSON.stringify(chunk)).join("\n") + (chunks.length ? "\n" : ""));
  await writeAtomic(indexPath, JSON.stringify({ docFreq, docLens, postings, avgdl } satisfies DiskIndex));
  await writeAtomic(manifestPath, JSON.stringify({ cacheVersion: CACHE_VERSION, repo, scope, fingerprint, files: files.length, chunks: chunks.length, createdAt: Math.floor(Date.now() / 1000), format: "json chunks + inverted bm25 postings" } satisfies Manifest, null, 2));

  return {
    chunks,
    docFreq,
    docLens,
    postings,
    avgdl,
    stats: {
      cacheDir: dir,
      cacheHit: false,
      chunks: chunks.length,
      files: files.length,
      fingerprint,
      buildMs,
      queryMs: 0,
      sizeBytes: await dirSize(dir),
    },
  };
}
