import { readFile, stat } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { iterFiles } from "../index/files.js";
import { validateScope } from "../router/intent.js";

export type SemanticGrepBackend = "trigram-index" | "full-scan" | "invalid-regex";

export interface ExecuteSemanticGrepOptions {
  pattern: string;
  repo?: string;
  scope?: string;
  glob?: string;
  literal?: boolean;
  regex?: boolean;
  ignoreCase?: boolean;
  context?: number;
  maxResults?: number;
  signal?: AbortSignal;
}

export interface SemanticGrepMatch {
  path: string;
  line: number;
  text: string;
  before: Array<{ line: number; text: string }>;
  after: Array<{ line: number; text: string }>;
}

export interface SemanticGrepResult {
  repo: string;
  scope: string;
  pattern: string;
  glob?: string;
  literal: boolean;
  ignoreCase: boolean;
  backend: SemanticGrepBackend;
  anchors: string[];
  notes: string[];
  matches: SemanticGrepMatch[];
  stats: {
    cacheHit: boolean;
    indexedFiles: number;
    candidateFiles: number;
    searchedFiles: number;
    matchedFiles: number;
    totalMatches: number;
    truncated: boolean;
    buildMs: number;
    queryMs: number;
    sizeBytes: number;
    cacheLocation: string;
  };
  error?: string;
}

interface IndexedFile {
  rel: string;
  text: string;
  lines: string[];
}

interface GrepIndex {
  repo: string;
  scope: string;
  glob?: string;
  fingerprint: string;
  files: IndexedFile[];
  postings: Map<string, Set<number>>;
  sizeBytes: number;
  cacheLocation: string;
}

const MAX_CONTEXT_LINES = 5;
const DEFAULT_MAX_RESULTS = 100;
const MAX_MAX_RESULTS = 500;
const MAX_CACHE_ENTRIES = 4;
const grepCache = new Map<string, GrepIndex>();

function normalizeRel(repo: string, file: string): string {
  return path.relative(repo, file).split(path.sep).join("/");
}

function cacheKey(repo: string, scope: string, glob?: string): string {
  return crypto.createHash("sha256").update(`${path.resolve(repo)}\n${scope}\n${glob ?? ""}\nsemantic-grep-v1`).digest("hex").slice(0, 20);
}

async function fingerprintFiles(repo: string, files: string[]): Promise<string> {
  const h = crypto.createHash("sha256");
  for (const file of files) {
    const s = await stat(file).catch(() => undefined);
    if (!s) continue;
    h.update(normalizeRel(repo, file)).update("\0").update(String(s.size)).update("\0").update(String(s.mtimeMs)).update("\n");
  }
  return h.digest("hex");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob: string): RegExp {
  let out = "^";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i]!;
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else {
      out += escapeRegExp(ch);
    }
  }
  out += "$";
  return new RegExp(out);
}

function matchesGlob(rel: string, glob?: string): boolean {
  if (!glob?.trim()) return true;
  const pattern = glob.trim();
  const re = globToRegExp(pattern);
  if (re.test(rel)) return true;
  if (!pattern.includes("/")) return re.test(path.basename(rel));
  return false;
}

function runeTrigrams(value: string): string[] {
  const runes = Array.from(value);
  if (runes.length < 3) return [];
  const grams = new Set<string>();
  for (let i = 0; i <= runes.length - 3; i += 1) grams.add(runes.slice(i, i + 3).join(""));
  return [...grams];
}

function addPostings(postings: Map<string, Set<number>>, text: string, fileId: number): void {
  for (const gram of runeTrigrams(text.toLowerCase())) {
    let ids = postings.get(gram);
    if (!ids) {
      ids = new Set<number>();
      postings.set(gram, ids);
    }
    ids.add(fileId);
  }
}

async function candidateFiles(repo: string, scope: string, glob?: string): Promise<string[]> {
  const files = await iterFiles(repo, scope);
  return files.filter((file) => matchesGlob(normalizeRel(repo, file), glob));
}

function touchCache(key: string, index: GrepIndex): void {
  grepCache.delete(key);
  grepCache.set(key, index);
  while (grepCache.size > MAX_CACHE_ENTRIES) {
    const oldest = grepCache.keys().next().value as string | undefined;
    if (!oldest) break;
    grepCache.delete(oldest);
  }
}

async function buildOrLoadGrepIndex(repo: string, scope: string, glob: string | undefined, signal?: AbortSignal): Promise<{ index: GrepIndex; cacheHit: boolean; buildMs: number }> {
  const started = performance.now();
  const key = cacheKey(repo, scope, glob);
  const files = await candidateFiles(repo, scope, glob);
  const fingerprint = await fingerprintFiles(repo, files);
  const cached = grepCache.get(key);
  if (cached?.fingerprint === fingerprint) {
    touchCache(key, cached);
    return { index: cached, cacheHit: true, buildMs: Math.round(performance.now() - started) };
  }

  const indexedFiles: IndexedFile[] = [];
  const postings = new Map<string, Set<number>>();
  let sizeBytes = 0;
  for (const file of files) {
    if (signal?.aborted) throw new Error("semantic_grep aborted");
    const text = await readFile(file, "utf8").catch(() => undefined);
    if (text === undefined) continue;
    const rel = normalizeRel(repo, file);
    const id = indexedFiles.length;
    indexedFiles.push({ rel, text, lines: text.split(/\r?\n/) });
    sizeBytes += Buffer.byteLength(text, "utf8") + rel.length;
    addPostings(postings, text, id);
    addPostings(postings, rel, id);
  }

  const index: GrepIndex = {
    repo,
    scope,
    glob,
    fingerprint,
    files: indexedFiles,
    postings,
    sizeBytes,
    cacheLocation: `memory:${key}`,
  };
  touchCache(key, index);
  return { index, cacheHit: false, buildMs: Math.round(performance.now() - started) };
}

function cleanAnchor(anchor: string): string {
  return anchor.trim();
}

function extractRegexAnchors(pattern: string): { anchors: string[]; safe: boolean; reason?: string } {
  const anchors: string[] = [];
  let current = "";
  let safe = true;
  let reason: string | undefined;

  function flush(): void {
    const anchor = cleanAnchor(current);
    if (anchor.length >= 3) anchors.push(anchor);
    current = "";
  }

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i]!;
    if (ch === "\\") {
      const next = pattern[i + 1];
      if (next && /[.*+?^${}()|[\]\\]/.test(next)) {
        current += next;
        i += 1;
        continue;
      }
      safe = false;
      reason = "regex contains escape classes/backrefs; using full scan";
      flush();
      if (next) i += 1;
      continue;
    }
    if (ch === ".") {
      flush();
      if (pattern[i + 1] === "*") i += 1;
      continue;
    }
    if (ch === "*") {
      safe = false;
      reason = "regex contains a quantifier outside simple .* wildcard; using full scan";
      flush();
      continue;
    }
    if (/[[\]{}()+?|^$]/.test(ch)) {
      safe = false;
      reason = "regex contains grouping, alternation, character classes, anchors, or optional quantifiers; using full scan";
      flush();
      continue;
    }
    current += ch;
  }
  flush();

  return { anchors: [...new Set(anchors)], safe, reason };
}

function anchorsFor(pattern: string, literal: boolean): { anchors: string[]; canPrune: boolean; reason?: string } {
  if (literal) {
    const anchor = cleanAnchor(pattern);
    return { anchors: anchor.length >= 3 ? [anchor] : [], canPrune: anchor.length >= 3, reason: anchor.length >= 3 ? undefined : "literal shorter than 3 runes; using full scan" };
  }
  const parsed = extractRegexAnchors(pattern);
  const longAnchors = parsed.anchors.filter((anchor) => Array.from(anchor).length >= 3);
  if (!parsed.safe) return { anchors: longAnchors, canPrune: false, reason: parsed.reason };
  if (!longAnchors.length) return { anchors: [], canPrune: false, reason: "regex has no literal anchor of at least 3 runes; using full scan" };
  return { anchors: longAnchors, canPrune: true };
}

function candidateIdsForAnchors(index: GrepIndex, anchors: string[]): number[] {
  const requiredGrams = [...new Set(anchors.flatMap((anchor) => runeTrigrams(anchor.toLowerCase())))];
  if (!requiredGrams.length) return index.files.map((_, id) => id);
  const grams = requiredGrams
    .map((gram) => ({ gram, ids: index.postings.get(gram) }))
    .sort((a, b) => (a.ids?.size ?? 0) - (b.ids?.size ?? 0));
  if (!grams[0]?.ids?.size) return [];
  const candidates = new Set<number>(grams[0].ids);
  for (const { ids } of grams.slice(1)) {
    if (!ids?.size) return [];
    for (const id of [...candidates]) {
      if (!ids.has(id)) candidates.delete(id);
    }
    if (!candidates.size) break;
  }
  return [...candidates].sort((a, b) => index.files[a]!.rel.localeCompare(index.files[b]!.rel));
}

function lineMatches(line: string, pattern: string, literal: boolean, ignoreCase: boolean, regex?: RegExp): boolean {
  if (literal) {
    return ignoreCase ? line.toLowerCase().includes(pattern.toLowerCase()) : line.includes(pattern);
  }
  return Boolean(regex?.test(line));
}

function contextBefore(lines: string[], idx: number, count: number): Array<{ line: number; text: string }> {
  const start = Math.max(0, idx - count);
  const out: Array<{ line: number; text: string }> = [];
  for (let i = start; i < idx; i += 1) out.push({ line: i + 1, text: lines[i] ?? "" });
  return out;
}

function contextAfter(lines: string[], idx: number, count: number): Array<{ line: number; text: string }> {
  const end = Math.min(lines.length, idx + count + 1);
  const out: Array<{ line: number; text: string }> = [];
  for (let i = idx + 1; i < end; i += 1) out.push({ line: i + 1, text: lines[i] ?? "" });
  return out;
}

export async function executeSemanticGrep(options: ExecuteSemanticGrepOptions): Promise<SemanticGrepResult> {
  const queryStarted = performance.now();
  const repo = path.resolve(options.repo ?? process.cwd());
  const scope = validateScope(options.scope ?? ".");
  const pattern = options.pattern;
  const literal = options.regex ? false : Boolean(options.literal);
  const ignoreCase = Boolean(options.ignoreCase);
  const context = Math.max(0, Math.min(Math.floor(options.context ?? 0), MAX_CONTEXT_LINES));
  const maxResults = Math.max(1, Math.min(Math.floor(options.maxResults ?? DEFAULT_MAX_RESULTS), MAX_MAX_RESULTS));
  const notes: string[] = [];

  const { index, cacheHit, buildMs } = await buildOrLoadGrepIndex(repo, scope, options.glob, options.signal);
  const anchorPlan = anchorsFor(pattern, literal);
  const backend: SemanticGrepBackend = anchorPlan.canPrune ? "trigram-index" : "full-scan";
  if (anchorPlan.reason) notes.push(anchorPlan.reason);

  let regex: RegExp | undefined;
  if (!literal) {
    try {
      regex = new RegExp(pattern, ignoreCase ? "i" : "");
    } catch (error) {
      return {
        repo,
        scope,
        pattern,
        glob: options.glob,
        literal,
        ignoreCase,
        backend: "invalid-regex",
        anchors: anchorPlan.anchors,
        notes,
        matches: [],
        error: error instanceof Error ? error.message : String(error),
        stats: {
          cacheHit,
          indexedFiles: index.files.length,
          candidateFiles: 0,
          searchedFiles: 0,
          matchedFiles: 0,
          totalMatches: 0,
          truncated: false,
          buildMs,
          queryMs: Math.round(performance.now() - queryStarted),
          sizeBytes: index.sizeBytes,
          cacheLocation: index.cacheLocation,
        },
      };
    }
  }

  const candidateIds = backend === "trigram-index" ? candidateIdsForAnchors(index, anchorPlan.anchors) : index.files.map((_, id) => id);
  const matches: SemanticGrepMatch[] = [];
  const matchedFiles = new Set<string>();
  let totalMatches = 0;
  let searchedFiles = 0;
  let truncated = false;

  for (const fileId of candidateIds) {
    if (options.signal?.aborted) throw new Error("semantic_grep aborted");
    const file = index.files[fileId];
    if (!file) continue;
    searchedFiles += 1;
    let fileMatched = false;
    for (let i = 0; i < file.lines.length; i += 1) {
      const line = file.lines[i] ?? "";
      if (!lineMatches(line, pattern, literal, ignoreCase, regex)) continue;
      totalMatches += 1;
      fileMatched = true;
      if (matches.length < maxResults) {
        matches.push({
          path: file.rel,
          line: i + 1,
          text: line,
          before: contextBefore(file.lines, i, context),
          after: contextAfter(file.lines, i, context),
        });
      } else {
        truncated = true;
      }
    }
    if (fileMatched) matchedFiles.add(file.rel);
  }

  return {
    repo,
    scope,
    pattern,
    glob: options.glob,
    literal,
    ignoreCase,
    backend,
    anchors: anchorPlan.anchors,
    notes,
    matches,
    stats: {
      cacheHit,
      indexedFiles: index.files.length,
      candidateFiles: candidateIds.length,
      searchedFiles,
      matchedFiles: matchedFiles.size,
      totalMatches,
      truncated,
      buildMs,
      queryMs: Math.round(performance.now() - queryStarted),
      sizeBytes: index.sizeBytes,
      cacheLocation: index.cacheLocation,
    },
  };
}

function groupMatches(matches: SemanticGrepMatch[]): Array<{ path: string; matches: SemanticGrepMatch[] }> {
  const groups = new Map<string, SemanticGrepMatch[]>();
  const order: string[] = [];
  for (const match of matches) {
    const existing = groups.get(match.path);
    if (existing) {
      existing.push(match);
      continue;
    }
    groups.set(match.path, [match]);
    order.push(match.path);
  }
  return order.map((matchPath) => ({ path: matchPath, matches: groups.get(matchPath) ?? [] }));
}

function matchLines(match: SemanticGrepMatch, withContext: boolean): string[] {
  if (!withContext) return [`${match.line}| ${match.text}`];
  const lines: string[] = [];
  for (const ctx of match.before) lines.push(` ${ctx.line}| ${ctx.text}`);
  lines.push(`>${match.line}| ${match.text}`);
  for (const ctx of match.after) lines.push(` ${ctx.line}| ${ctx.text}`);
  return lines;
}

export function formatSemanticGrepResult(result: SemanticGrepResult): string {
  const lines: string[] = [
    `# semantic-grep ts: ${result.pattern}`,
    `repo: ${result.repo}`,
    `scope: ${result.scope}`,
  ];
  if (result.glob) lines.push(`glob: ${result.glob}`);
  lines.push(
    `mode: ${result.literal ? "literal" : "regex"}; ignore_case: ${result.ignoreCase}`,
    `backend: ${result.backend}`,
    `anchors: ${result.anchors.length ? JSON.stringify(result.anchors) : "none"}`,
    "",
    "## Search stats",
    `- cache_hit: ${result.stats.cacheHit}; cache_location: ${result.stats.cacheLocation}`,
    `- indexed_files: ${result.stats.indexedFiles}; candidate_files: ${result.stats.candidateFiles}; searched_files: ${result.stats.searchedFiles}`,
    `- matched_files: ${result.stats.matchedFiles}; total_matches: ${result.stats.totalMatches}; shown_matches: ${result.matches.length}; truncated: ${result.stats.truncated}`,
    `- build_ms: ${result.stats.buildMs}; query_ms: ${result.stats.queryMs}; estimated_mem_mb: ${(result.stats.sizeBytes / (1024 * 1024)).toFixed(2)}`,
    "",
  );
  if (result.error) lines.push("## Error", `- ${result.error}`, "");
  if (result.notes.length) lines.push("## Notes", ...result.notes.map((note) => `- ${note}`), "");
  lines.push("## Matches by file");
  if (!result.matches.length) {
    lines.push("- none");
  } else {
    const withContext = result.matches.some((match) => match.before.length || match.after.length);
    for (const group of groupMatches(result.matches)) {
      lines.push(`### ${group.path} — ${group.matches.length} shown`, "```text");
      group.matches.forEach((match, idx) => {
        lines.push(...matchLines(match, withContext));
        if (withContext && idx < group.matches.length - 1) lines.push("");
      });
      lines.push("```", "");
    }
  }
  return lines.join("\n");
}
