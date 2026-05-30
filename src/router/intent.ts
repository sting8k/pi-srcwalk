import { existsSync } from "node:fs";
import path from "node:path";
import type { DetailLevel, Intent, QueryPlan, SrcwalkCommand } from "../domain/types.js";
import { INTENT_TERMS, STOP_WORDS, WEAK_KEYWORDS } from "./constants.js";

const FILE_EXT_RE = /[\w./-]+\.(?:rs|go|cs|ts|tsx|js|jsx|py|java|kt|swift|cpp|c|h|md|toml|yaml|yml|json)$/;
const TARGET_RE = /(?<target>[\w./-]+\.\w+:(?<line>\d+)(?:-(?<end>\d+))?)/;

export function detectIntent(query: string): Intent {
  const q = query.toLowerCase();
  if (["overview", "architecture", "structure", "map", "what is in", "list files", "module"].some((p) => q.includes(p))) return "overview";
  if (["who calls", "who uses", "callers", "used by", "usage of", "where used", "where is it used"].some((p) => q.includes(p))) return "callers";
  if (["what does", "callee", "callees", "call flow", "downstream", "what happens inside"].some((p) => q.includes(p))) return "callees";
  if (["deps", "dependencies", "imports", "imported by", "what imports", "what does it import"].some((p) => q.includes(p))) return "deps";
  if (["impact", "blast radius", "safe to change", "changing"].some((p) => q.includes(p))) return "impact";
  if (["where is", "defined", "definition", "implementation", "implemented", "where can i find"].some((p) => q.includes(p))) return "definition";
  if (["test", "tests", "spec", "example", "fixture"].some((p) => q.includes(p))) return "test";
  if (["similar", "related", "like this", "nearby"].some((p) => q.includes(p))) return "related";
  return "general";
}

export function extractKeywords(query: string): string[] {
  const rawTokens = query.replace(/[`'"?!,;:()[\]{}]/g, " ").match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const expanded: string[] = [];
  for (const token of rawTokens) {
    const low = token.toLowerCase();
    if (STOP_WORDS.has(low) || WEAK_KEYWORDS.has(low) || low.length <= 2) continue;
    expanded.push(token);
    if (low !== token) expanded.push(low);
    if (low.endsWith("ing") && low.length > 5) expanded.push(low.slice(0, -3));
    if (low.endsWith("es") && low.length > 4) expanded.push(low.slice(0, -2));
    if (low.endsWith("s") && low.length > 4) expanded.push(low.slice(0, -1));
    if (low.endsWith("ication") && low.length > 8) expanded.push(low.slice(0, 4));
  }
  const dedup: string[] = [];
  const seen = new Set<string>();
  for (const kw of expanded) {
    const key = kw.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(kw);
    }
  }
  return dedup.sort((a, b) => (b.length - a.length) || Number(/[A-Z]/.test(b)) - Number(/[A-Z]/.test(a))).slice(0, 5);
}

export function domainKeywords(plan: Pick<QueryPlan, "keywords">): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const kw of plan.keywords) {
    const low = kw.toLowerCase();
    if (INTENT_TERMS.has(low) || STOP_WORDS.has(low) || WEAK_KEYWORDS.has(low) || low.length <= 2) continue;
    if (!seen.has(low)) {
      seen.add(low);
      out.push(kw);
    }
  }
  return out;
}

export function isFilePath(query: string): boolean {
  const q = query.trim().replace(/^['`]|['`]$/g, "");
  return q.includes("/") || FILE_EXT_RE.test(q);
}

export function isSymbolLike(query: string): boolean {
  const q = query.trim().replace(/^['`]|['`]$/g, "");
  if (!q || /\s/.test(q) || q.includes("/")) return false;
  if (/[a-z][A-Z]|[A-Z][a-z]/.test(q)) return true;
  if (/^[a-z_][a-z0-9_]*$/.test(q) && q.includes("_")) return true;
  if (/^[A-Z_][A-Z0-9_]*$/.test(q) && q.includes("_")) return true;
  if (q.includes("::") || q.includes("->") || q.includes(".")) return true;
  return false;
}

export function extractTarget(query: string): string | undefined {
  return query.match(TARGET_RE)?.groups?.target;
}

export function strongestSymbol(query: string, keywords: string[]): string {
  const explicit = (query.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).filter((t) => !STOP_WORDS.has(t.toLowerCase()) && !WEAK_KEYWORDS.has(t.toLowerCase()));
  const symbolish = explicit.filter((t) => /[A-Z_]|[a-z][A-Z]/.test(t));
  if (symbolish.length) return symbolish[symbolish.length - 1]!;
  return keywords[0] ?? explicit[explicit.length - 1] ?? query.trim().split(/\s+/).at(-1) ?? query;
}

export function makeCmd(label: string, parts: string[], purpose: string, parseAs: SrcwalkCommand["parseAs"] = "discover"): SrcwalkCommand {
  return { label, args: ["srcwalk", ...parts], purpose, parseAs };
}

export function commandDisplay(command: SrcwalkCommand): string {
  return command.args.map((arg) => (/^[\w./:=*-]+$/.test(arg) ? arg : JSON.stringify(arg))).join(" ");
}

export function buildPlan(query: string, repo: string, scope = ".", maxResults = 3, detail: DetailLevel = "normal"): QueryPlan {
  const intent = detectIntent(query);
  let keywords = extractKeywords(query);
  const commands: SrcwalkCommand[] = [];
  const shouldTraceCallers = intent === "callers" || intent === "impact";
  const shouldTraceCallees = intent === "callees";
  const shouldGetDeps = intent === "deps" || intent === "impact";
  const shouldAssess = intent === "impact";

  const base = (queryKind: QueryPlan["queryKind"], chosenScope = scope): QueryPlan => ({
    query, repo, scope: chosenScope, intent, queryKind, keywords, commands, maxResults, detail,
    shouldTraceCallers, shouldTraceCallees, shouldGetDeps, shouldAssess,
  });

  const target = extractTarget(query);
  if (target) {
    commands.push(makeCmd("target-context", ["context", target, "--scope", scope, "--budget", "3500"], "exact target context", "context"));
    return base("explicit_target");
  }

  if (intent === "overview") {
    const pathTokens = query.split(/\s+/).filter((t) => t.includes("/"));
    const overviewScope = pathTokens.at(-1)?.replace(/^['`]|['`]$/g, "") ?? scope;
    commands.push(makeCmd("overview", ["overview", "--scope", overviewScope, "--symbols"], "module/project overview", "overview"));
    return base("overview", overviewScope);
  }

  if (isFilePath(query)) {
    const fileOrPath = query.trim().replace(/^['`]|['`]$/g, "").match(FILE_EXT_RE)?.[0] ?? query.trim().replace(/^['`]|['`]$/g, "");
    if (intent === "deps") {
      commands.push(makeCmd("file-deps", ["deps", fileOrPath, "--budget", "3500"], "exact file deps", "deps"));
      return base("file_deps");
    }
    commands.push(makeCmd("file-show", ["show", fileOrPath, "--budget", "3500"], "exact file read", "show"));
    commands.push(makeCmd("file-discover", ["discover", fileOrPath, "--as", "file", "--scope", scope, "--limit", "8", "--budget", "2500"], "file discovery fallback", "discover"));
    return base("file");
  }

  const preliminaryPlan = { keywords };
  const kws = domainKeywords(preliminaryPlan);
  if (kws.length) keywords = kws.slice(0, 5);
  const symbol = intent === "definition" && keywords.length ? keywords[0]! : strongestSymbol(query, keywords);

  if (["callers", "callees", "deps", "impact", "definition"].includes(intent)) {
    commands.push(makeCmd("symbol-exact", ["discover", symbol, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "3000"], "intent symbol lookup", "discover"));
    commands.push(makeCmd("symbol-lower", ["discover", symbol.toLowerCase(), "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case fallback", "discover"));
    commands.push(makeCmd("symbol-glob", ["discover", `*${symbol.toLowerCase()}*`, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case/glob fallback", "discover"));
    if (keywords.length) commands.push(makeCmd("text-any", ["discover", keywords.slice(0, 4).join(","), "--match", "any", "--as", "text", "--scope", scope, "--limit", "10", "--budget", "3000"], "text fallback", "discover"));
    return base("intent_symbol");
  }

  if (intent === "test") {
    const testScope = existsSync(path.join(repo, "tests")) ? "tests" : scope;
    if (keywords.length) {
      commands.push(makeCmd("test-text", ["discover", keywords.slice(0, 4).join(","), "--match", "any", "--as", "text", "--scope", testScope, "--limit", "12", "--budget", "3000"], "test/example text lookup", "discover"));
      commands.push(makeCmd("test-symbol", ["discover", `*${keywords[0]}*`, "--as", "symbol", "--scope", testScope, "--limit", "12", "--budget", "2500"], "test/example symbol lookup", "discover"));
    }
    return base("test", testScope);
  }

  if (isSymbolLike(query)) {
    const q = query.trim().replace(/^['`]|['`]$/g, "");
    keywords = [q];
    commands.push(makeCmd("symbol-exact", ["discover", q, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "3000"], "exact symbol lookup", "discover"));
    commands.push(makeCmd("symbol-lower", ["discover", q.toLowerCase(), "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case fallback", "discover"));
    commands.push(makeCmd("symbol-glob", ["discover", `*${q.toLowerCase()}*`, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "glob fallback", "discover"));
    commands.push(makeCmd("symbol-text", ["discover", q, "--as", "text", "--scope", scope, "--limit", "10", "--budget", "2500"], "text fallback", "discover"));
    return base("symbol");
  }

  if (keywords.length) {
    commands.push(makeCmd("text-any", ["discover", keywords.slice(0, 4).join(","), "--match", "any", "--as", "text", "--scope", scope, "--limit", "12", "--budget", "3000"], "natural language text lookup", "discover"));
    commands.push(makeCmd("symbol-glob", ["discover", `*${keywords[0]!.toLowerCase()}*`, "--as", "symbol", "--scope", scope, "--limit", "12", "--budget", "2500"], "symbol fallback for strongest keyword", "discover"));
  }
  commands.push(makeCmd("overview-fallback", ["overview", "--scope", scope, "--symbols"], "last-resort orientation", "overview"));
  return base("general");
}

export function validateScope(scope: string): string {
  const normalized = scope.trim() || ".";
  if (path.isAbsolute(normalized) || normalized.split(/[\\/]+/).includes("..")) {
    throw new Error(`Invalid scope: ${scope}. Scope must be relative to the current repo.`);
  }
  return normalized;
}
