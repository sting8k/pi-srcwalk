#!/usr/bin/env node
import { executeSearch } from "./engine.js";
import { formatResult } from "./output/format.js";

function readArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : fallback;
}

const query = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!query) {
  console.error("Usage: node src/cli.ts <query> [--repo .] [--scope .] [--max-results 3] [--detail brief|normal|deep] [--verbose]");
  process.exit(2);
}
const result = await executeSearch({
  query,
  repo: readArg("--repo", process.cwd()),
  scope: readArg("--scope", "."),
  maxResults: Number(readArg("--max-results", "3")),
  detail: (readArg("--detail", "normal") as "brief" | "normal" | "deep"),
});
console.log(formatResult(result, process.argv.includes("--verbose")));
