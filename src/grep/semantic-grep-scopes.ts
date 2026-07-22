import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { INDEX_EXTS } from "../router/constants.js";

const SKIP_DIRS = new Set([
  ".git", ".hg", ".svn", ".idea", ".vscode", ".vs", "node_modules", "target", "bin", "obj", "build", "dist", "out",
  ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".gradle", ".next", ".nuxt", "coverage", "vendor",
  ".pi", "lab/reports",
]);
const SKIP_FILENAMES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "composer.lock", "poetry.lock", "Pipfile.lock", "harness.db"]);
export const MAX_SCOPES = 32;
export const DEFAULT_MAX_INDEXED_FILES = 10_000;
export const DEFAULT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_BYTES = 512_000;
export const DEFAULT_MAX_WALK_ENTRIES = 100_000;

export interface ResolvedScopeEntry {
  requested: string;
  resolved: string;
  real: string;
  kind: "dir" | "file";
  display: string;
}

export interface PrunedScopes {
  dirs: ResolvedScopeEntry[];
  files: ResolvedScopeEntry[];
  canonicalKeys: string[];
  notes: string[];
}

export interface CollectedGrepFiles {
  files: string[];
  overflowFiles: string[];
  notes: string[];
  eligibleFiles: number;
  indexedBytes: number;
  overflowBytes: number;
  visitedEntries: number;
  walkCapped: boolean;
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function maxIndexedFiles(): number {
  return positiveIntEnv("PI_SRCWALK_GREP_MAX_INDEXED_FILES", DEFAULT_MAX_INDEXED_FILES);
}

export function maxIndexedBytes(): number {
  return positiveIntEnv("PI_SRCWALK_GREP_MAX_INDEX_MB", Math.floor(DEFAULT_MAX_TOTAL_BYTES / (1024 * 1024))) * 1024 * 1024;
}

export function maxWalkEntries(): number {
  return positiveIntEnv("PI_SRCWALK_GREP_MAX_WALK_ENTRIES", DEFAULT_MAX_WALK_ENTRIES);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("semantic_grep aborted");
}

export function normalizeScopesInput(scopes?: string[]): string[] {
  if (!scopes?.length) return ["."];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of scopes) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length ? out : ["."];
}

export function isPathInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function displayPath(repo: string, absPath: string): string {
  const rel = path.relative(repo, absPath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return absPath;
  return rel.split(path.sep).join("/");
}

async function tryReal(absPath: string): Promise<string> {
  try {
    return await realpath(absPath);
  } catch {
    return absPath;
  }
}

export async function resolveAndPruneScopes(repo: string, scopes: string[]): Promise<PrunedScopes> {
  const notes: string[] = [];
  const repoResolved = path.resolve(repo);
  if (scopes.length > MAX_SCOPES) {
    notes.push(`received ${scopes.length} scopes; only the first ${MAX_SCOPES} were considered`);
    scopes = scopes.slice(0, MAX_SCOPES);
  }

  const resolvedDirs: ResolvedScopeEntry[] = [];
  const resolvedFiles: ResolvedScopeEntry[] = [];
  const seenRealDirs = new Set<string>();
  const seenRealFiles = new Set<string>();

  for (const requested of scopes) {
    const resolved = path.isAbsolute(requested) ? path.resolve(requested) : path.resolve(repoResolved, requested);
    const st = await stat(resolved).catch(() => undefined);
    if (!st) {
      notes.push(`missing scope skipped: ${requested}`);
      continue;
    }
    const real = await tryReal(resolved);
    const display = displayPath(repoResolved, resolved);
    if (st.isDirectory()) {
      if (seenRealDirs.has(real)) {
        notes.push(`duplicate dir scope pruned: ${requested}`);
        continue;
      }
      seenRealDirs.add(real);
      resolvedDirs.push({ requested, resolved, real, kind: "dir", display });
      continue;
    }
    if (st.isFile()) {
      if (seenRealFiles.has(real)) {
        notes.push(`duplicate file scope pruned: ${requested}`);
        continue;
      }
      seenRealFiles.add(real);
      resolvedFiles.push({ requested, resolved, real, kind: "file", display });
      continue;
    }
    notes.push(`unsupported scope skipped: ${requested}`);
  }

  const sortedDirs = [...resolvedDirs].sort((a, b) => a.real.length - b.real.length);
  const keptDirs: ResolvedScopeEntry[] = [];
  for (const dir of sortedDirs) {
    if (keptDirs.some((parent) => isPathInside(parent.real, dir.real))) {
      notes.push(`nested dir scope pruned under parent: ${dir.requested}`);
      continue;
    }
    keptDirs.push(dir);
  }

  const keptFiles: ResolvedScopeEntry[] = [];
  for (const file of resolvedFiles) {
    if (keptDirs.some((dir) => isPathInside(dir.real, file.real))) {
      notes.push(`file scope covered by dir and pruned: ${file.requested}`);
      continue;
    }
    keptFiles.push(file);
  }

  const canonicalKeys = [...keptDirs.map((d) => d.real), ...keptFiles.map((f) => f.real)].sort();
  return { dirs: keptDirs, files: keptFiles, canonicalKeys, notes };
}

async function walkDir(
  repo: string,
  dir: string,
  signal: AbortSignal | undefined,
  onFile: (file: string, size: number) => Promise<boolean>,
  onEntry: () => boolean,
): Promise<boolean> {
  throwIfAborted(signal);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  throwIfAborted(signal);
  for (const entry of entries) {
    throwIfAborted(signal);
    if (!onEntry()) return false;
    const full = path.join(dir, entry.name);
    const rel = path.relative(repo, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(rel)) continue;
      if (!(await walkDir(repo, full, signal, onFile, onEntry))) return false;
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILENAMES.has(entry.name)) continue;
    if (!INDEX_EXTS.has(path.extname(entry.name))) continue;
    const s = await stat(full).catch(() => undefined);
    if (!s || s.size > MAX_FILE_BYTES) continue;
    if (!(await onFile(full, s.size))) return false;
  }
  return true;
}

async function filePasses(absFile: string): Promise<boolean> {
  const name = path.basename(absFile);
  if (SKIP_FILENAMES.has(name)) return false;
  if (!INDEX_EXTS.has(path.extname(name))) return false;
  const s = await stat(absFile).catch(() => undefined);
  return Boolean(s?.isFile() && s.size <= MAX_FILE_BYTES);
}

export async function collectCandidateFiles(
  repo: string,
  pruned: PrunedScopes,
  glob: string | undefined,
  matchesGlob: (rel: string, glob?: string) => boolean,
  normalizeRel: (repo: string, file: string) => string,
  signal?: AbortSignal,
): Promise<CollectedGrepFiles> {
  const notes: string[] = [];
  const indexedByReal = new Map<string, string>();
  const overflowByReal = new Map<string, string>();
  let indexedBytes = 0;
  let overflowBytes = 0;
  let eligibleFiles = 0;
  let visitedEntries = 0;
  let walkCapped = false;
  let overflowNoted = false;
  const indexedFileCap = maxIndexedFiles();
  const indexedByteCap = maxIndexedBytes();
  const walkCap = maxWalkEntries();

  function noteOverflow(reason: string): void {
    if (!overflowNoted) notes.push(`${reason}; remaining eligible files will be stream-verified`);
    overflowNoted = true;
  }

  function onEntry(): boolean {
    if (visitedEntries >= walkCap) {
      if (!walkCapped) notes.push(`walk entry cap reached (${walkCap}); remaining paths skipped; coverage is incomplete`);
      walkCapped = true;
      return false;
    }
    visitedEntries += 1;
    return true;
  }

  async function addFile(file: string, size: number): Promise<boolean> {
    throwIfAborted(signal);
    const real = await tryReal(file);
    if (indexedByReal.has(real) || overflowByReal.has(real)) return true;
    if (!matchesGlob(normalizeRel(repo, file), glob)) return true;
    eligibleFiles += 1;
    if (indexedByReal.size >= indexedFileCap) {
      overflowByReal.set(real, file);
      overflowBytes += size;
      noteOverflow(`indexed file cap reached (${indexedFileCap})`);
      return true;
    }
    if (indexedBytes + size > indexedByteCap) {
      overflowByReal.set(real, file);
      overflowBytes += size;
      noteOverflow(`indexed byte cap reached (${indexedByteCap} bytes)`);
      return true;
    }
    indexedByReal.set(real, file);
    indexedBytes += size;
    return true;
  }

  for (const dir of pruned.dirs) {
    throwIfAborted(signal);
    if (!(await walkDir(repo, dir.resolved, signal, addFile, onEntry))) break;
  }

  if (!walkCapped) {
    for (const fileEntry of pruned.files) {
      throwIfAborted(signal);
      if (!(await filePasses(fileEntry.resolved))) continue;
      if (!matchesGlob(normalizeRel(repo, fileEntry.resolved), glob)) continue;
      const s = await stat(fileEntry.resolved).catch(() => undefined);
      if (!s) continue;
      await addFile(fileEntry.resolved, s.size);
    }
  }

  return {
    files: [...indexedByReal.values()].sort(),
    overflowFiles: [...overflowByReal.values()].sort(),
    notes,
    eligibleFiles,
    indexedBytes,
    overflowBytes,
    visitedEntries,
    walkCapped,
  };
}

export function canonicalScopeDisplays(pruned: PrunedScopes): string[] {
  return [...pruned.dirs.map((d) => d.display), ...pruned.files.map((f) => f.display)].sort();
}
