import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { INDEX_EXTS } from "../router/constants.js";

const SKIP_DIRS = new Set([
  ".git", ".hg", ".svn", ".idea", ".vscode", ".vs", "node_modules", "target", "bin", "obj", "build", "dist", "out",
  ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".gradle", ".next", ".nuxt", "coverage", "vendor",
  ".pi", "lab/reports",
]);
const SKIP_FILENAMES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock", "composer.lock", "poetry.lock", "Pipfile.lock", "harness.db"]);
const MAX_FILE_BYTES = 512_000;
const DEFAULT_MAX_WALK_ENTRIES = 100_000;

export interface IterFilesResult {
  files: string[];
  totalBytes: number;
  visitedEntries: number;
  walkCapped: boolean;
  notes: string[];
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function maxBm25WalkEntries(): number {
  return positiveIntEnv("PI_SRCWALK_BM25_MAX_WALK_ENTRIES", DEFAULT_MAX_WALK_ENTRIES);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("file iteration aborted");
}

export async function iterFilesDetailed(repo: string, scope: string, signal?: AbortSignal): Promise<IterFilesResult> {
  throwIfAborted(signal);
  const root = path.resolve(repo, scope === "." ? "" : scope);
  const rootStat = await stat(root).catch(() => undefined);
  if (!rootStat) return { files: [], totalBytes: 0, visitedEntries: 0, walkCapped: false, notes: [] };
  if (rootStat.isFile()) {
    if (rootStat.size > MAX_FILE_BYTES) return { files: [], totalBytes: 0, visitedEntries: 1, walkCapped: false, notes: [] };
    return { files: [root], totalBytes: rootStat.size, visitedEntries: 1, walkCapped: false, notes: [] };
  }

  const files: string[] = [];
  const notes: string[] = [];
  let totalBytes = 0;
  let visitedEntries = 0;
  let walkCapped = false;
  const maxWalkEntries = maxBm25WalkEntries();

  function onEntry(): boolean {
    if (visitedEntries >= maxWalkEntries) {
      if (!walkCapped) notes.push(`BM25 walk entry cap reached (${maxWalkEntries}); remaining paths skipped`);
      walkCapped = true;
      return false;
    }
    visitedEntries += 1;
    return true;
  }

  async function walk(dir: string): Promise<boolean> {
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
        if (!(await walk(full))) return false;
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_FILENAMES.has(entry.name)) continue;
      if (!INDEX_EXTS.has(path.extname(entry.name))) continue;
      const s = await stat(full).catch(() => undefined);
      if (!s || s.size > MAX_FILE_BYTES) continue;
      files.push(full);
      totalBytes += s.size;
    }
    return true;
  }

  await walk(root);
  throwIfAborted(signal);
  return { files: files.sort(), totalBytes, visitedEntries, walkCapped, notes };
}

export async function iterFiles(repo: string, scope: string, signal?: AbortSignal): Promise<string[]> {
  return (await iterFilesDetailed(repo, scope, signal)).files;
}
