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

export async function iterFiles(repo: string, scope: string): Promise<string[]> {
  const root = path.resolve(repo, scope === "." ? "" : scope);
  const rootStat = await stat(root).catch(() => undefined);
  if (!rootStat) return [];
  if (rootStat.isFile()) return [root];

  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(repo, full).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || SKIP_DIRS.has(rel)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_FILENAMES.has(entry.name)) continue;
      if (!INDEX_EXTS.has(path.extname(entry.name))) continue;
      const s = await stat(full).catch(() => undefined);
      if (!s || s.size > MAX_FILE_BYTES) continue;
      files.push(full);
    }
  }
  await walk(root);
  return files.sort();
}
