import { existsSync } from "node:fs";
import path from "node:path";
import type { DetailLevel, Intent, QueryIR, QueryPlan, SrcwalkCommand } from "../domain/types.js";
import { tokenize } from "../index/tokenize.js";
import { INTENT_TERMS, STOP_WORDS, WEAK_KEYWORDS } from "./constants.js";

const FILE_EXT_RE = /[\w./-]+\.(?:rs|go|cs|ts|tsx|js|jsx|py|java|kt|swift|cpp|c|h|md|toml|yaml|yml|json)$/;
const TARGET_RE = /(?<target>[\w./-]+\.\w+:(?<line>\d+)(?:-(?<end>\d+))?)/;
const HINT_RE = /(?<testflag>-test\b)|(?<neg>-)?(?<key>file|path|sym|symbol|lang|content|test):(?<value>"[^"]*"|'[^']*'|`[^`]*`|\S*)/gi;

function uniqueStrings(items: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const trimmed = item.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function cleanHintValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if (first === last && ['"', "'", "`"].includes(first)) return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function slugLabel(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^\w./-]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "query";
}

function dedupeCommands(commands: SrcwalkCommand[]): SrcwalkCommand[] {
  const seen = new Set<string>();
  const out: SrcwalkCommand[] = [];
  for (const command of commands) {
    const key = `${command.label}\u0000${command.args.join("\u0000")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(command);
  }
  return out;
}

export function parseQueryIR(query: string): QueryIR {
  const symbols: string[] = [];
  const excludeSymbols: string[] = [];
  const fileFilters: string[] = [];
  const excludeFileFilters: string[] = [];
  const contentTerms: string[] = [];
  const excludeContentTerms: string[] = [];
  let lang: string | undefined;
  const excludeLangs: string[] = [];
  let includeTests = false;
  let excludeTests = false;
  const removeSpans: Array<[number, number]> = [];

  for (const match of query.matchAll(HINT_RE)) {
    const span = match.index;
    if (span !== undefined) removeSpans.push([span, span + match[0].length]);
    if (match.groups?.testflag) {
      excludeTests = true;
      continue;
    }
    const key = (match.groups?.key ?? "").toLowerCase();
    const negated = Boolean(match.groups?.neg);
    const value = cleanHintValue(match.groups?.value ?? "");

    if ((key === "sym" || key === "symbol") && value) {
      (negated ? excludeSymbols : symbols).push(value);
    } else if ((key === "file" || key === "path") && value) {
      (negated ? excludeFileFilters : fileFilters).push(value);
    } else if (key === "content" && value) {
      (negated ? excludeContentTerms : contentTerms).push(value);
    } else if (key === "lang" && value) {
      if (negated) excludeLangs.push(value.toLowerCase());
      else lang = value.toLowerCase();
    } else if (key === "test") {
      const low = value.toLowerCase();
      if (negated || ["0", "false", "no", "off"].includes(low)) excludeTests = true;
      else includeTests = true;
    }
  }

  const chars = [...query];
  for (const [start, end] of removeSpans) {
    for (let i = start; i < end; i += 1) chars[i] = " ";
  }
  const base = chars.join("").split(/\s+/).filter(Boolean).join(" ");

  const cleanParts = [base, ...symbols, ...contentTerms];
  if (!base && !symbols.length && !contentTerms.length && fileFilters.length) cleanParts.push(...fileFilters);
  const hasNegatedSearchHints = Boolean(excludeSymbols.length || excludeFileFilters.length || excludeContentTerms.length || excludeLangs.length);
  const cleanQuery = cleanParts.filter(Boolean).join(" ").trim() || (hasNegatedSearchHints ? "" : query);
  const terms = uniqueStrings(tokenize([cleanQuery, ...symbols, ...contentTerms].join(" ")));

  return {
    rawQuery: query,
    cleanQuery,
    terms,
    symbols: uniqueStrings(symbols),
    excludeSymbols: uniqueStrings(excludeSymbols),
    fileFilters: uniqueStrings(fileFilters),
    excludeFileFilters: uniqueStrings(excludeFileFilters),
    contentTerms: uniqueStrings(contentTerms),
    excludeContentTerms: uniqueStrings(excludeContentTerms),
    lang,
    excludeLangs: uniqueStrings(excludeLangs),
    includeTests,
    excludeTests,
    hasHints: Boolean(symbols.length || excludeSymbols.length || fileFilters.length || excludeFileFilters.length || contentTerms.length || excludeContentTerms.length || lang || excludeLangs.length || includeTests || excludeTests),
  };
}

export function describeQueryIR(ir: QueryIR): string {
  const parts = [`clean=${JSON.stringify(ir.cleanQuery)}`];
  if (ir.symbols.length) parts.push(`symbols=${JSON.stringify(ir.symbols)}`);
  if (ir.excludeSymbols.length) parts.push(`exclude_symbols=${JSON.stringify(ir.excludeSymbols)}`);
  if (ir.fileFilters.length) parts.push(`files=${JSON.stringify(ir.fileFilters)}`);
  if (ir.excludeFileFilters.length) parts.push(`exclude_files=${JSON.stringify(ir.excludeFileFilters)}`);
  if (ir.contentTerms.length) parts.push(`content=${JSON.stringify(ir.contentTerms)}`);
  if (ir.excludeContentTerms.length) parts.push(`exclude_content=${JSON.stringify(ir.excludeContentTerms)}`);
  if (ir.lang) parts.push(`lang=${ir.lang}`);
  if (ir.excludeLangs.length) parts.push(`exclude_langs=${JSON.stringify(ir.excludeLangs)}`);
  if (ir.includeTests) parts.push("include_tests=true");
  if (ir.excludeTests) parts.push("exclude_tests=true");
  return parts.join("; ");
}

export function detectIntent(query: string): Intent {
  const q = query.toLowerCase();
  if (["overview", "architecture", "structure", "map", "what is in", "list files"].some((p) => q.includes(p))) return "overview";
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
  if (/^[A-Z_][A-Z0-9_]*$/.test(q) && q.includes("_") ) return true;
  if (q.includes("::") || q.includes("->") || q.includes(".")) return true;
  return false;
}

export function strongSymbolAnchors(tokens: string[], limit = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const cleaned = token.trim().replace(/^['`]|['`]$/g, "");
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key) || !isSymbolLike(cleaned)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
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

function hintCommandsForPlan(ir: QueryIR, plan: QueryPlan): SrcwalkCommand[] {
  const commands: SrcwalkCommand[] = [];
  const limit = String(Math.max(10, plan.maxResults * 2));
  for (const symbol of ir.symbols.slice(0, 3)) {
    const slug = slugLabel(symbol);
    commands.push(makeCmd(`hint-symbol-exact-${slug}`, ["discover", symbol, "--as", "symbol", "--scope", plan.scope, "--limit", limit, "--budget", "3000"], "structured sym: exact lookup", "discover"));
    commands.push(makeCmd(`hint-symbol-text-${slug}`, ["discover", symbol, "--as", "text", "--scope", plan.scope, "--limit", limit, "--budget", "2500"], "structured sym: text fallback", "discover"));
  }
  for (const fileFilter of ir.fileFilters.slice(0, 3)) {
    const slug = slugLabel(fileFilter);
    commands.push(makeCmd(`hint-file-${slug}`, ["discover", fileFilter, "--as", "file", "--scope", plan.scope, "--limit", limit, "--budget", "2500"], "structured file/path lookup", "discover"));
  }
  for (const content of ir.contentTerms.slice(0, 2)) {
    const slug = slugLabel(content);
    commands.push(makeCmd(`hint-content-${slug}`, ["discover", content, "--match", "any", "--as", "text", "--scope", plan.scope, "--limit", limit, "--budget", "3000"], "structured content lookup", "discover"));
  }
  return commands;
}

function attachHints(plan: QueryPlan, ir: QueryIR): QueryPlan {
  if (!ir.hasHints) return plan;
  const hintKeywords = [...ir.symbols, ...ir.contentTerms];
  for (const fileFilter of ir.fileFilters) {
    hintKeywords.push(...tokenize(path.basename(fileFilter).replace(/\./g, " ")));
  }
  if (hintKeywords.length) plan.keywords = uniqueStrings([...plan.keywords, ...hintKeywords]).slice(0, 8);
  const hintCommands = hintCommandsForPlan(ir, plan);
  if (hintCommands.length) plan.commands = dedupeCommands([...hintCommands, ...plan.commands]);
  return plan;
}

export function buildPlan(query: string, repo: string, scope = ".", maxResults = 3, detail: DetailLevel = "normal"): QueryPlan {
  const queryIR = parseQueryIR(query);
  const routingQuery = queryIR.hasHints ? queryIR.cleanQuery : query;
  const intent = detectIntent(routingQuery);
  let keywords = extractKeywords(routingQuery);
  const commands: SrcwalkCommand[] = [];
  const shouldTraceCallers = intent === "callers" || intent === "impact";
  const shouldTraceCallees = intent === "callees";
  const shouldGetDeps = intent === "deps" || intent === "impact";
  const shouldAssess = intent === "impact";

  const base = (queryKind: QueryPlan["queryKind"], chosenScope = scope): QueryPlan => attachHints({
    query: routingQuery,
    rawQuery: query,
    queryIR: queryIR.hasHints ? queryIR : undefined,
    repo,
    scope: chosenScope,
    intent,
    queryKind,
    keywords,
    commands,
    maxResults,
    detail,
    shouldTraceCallers,
    shouldTraceCallees,
    shouldGetDeps,
    shouldAssess,
  }, queryIR);

  const target = extractTarget(routingQuery);
  if (target) {
    commands.push(makeCmd("target-context", ["context", target, "--scope", scope, "--budget", "3500"], "exact target context", "context"));
    return base("explicit_target");
  }

  if (intent === "overview") {
    const pathTokens = routingQuery.split(/\s+/).filter((t) => t.includes("/"));
    const overviewScope = pathTokens.at(-1)?.replace(/^['`]|['`]$/g, "") ?? scope;
    commands.push(makeCmd("overview", ["overview", "--scope", overviewScope, "--symbols"], "module/project overview", "overview"));
    return base("overview", overviewScope);
  }

  if (isFilePath(routingQuery)) {
    const fileOrPath = routingQuery.trim().replace(/^['`]|['`]$/g, "").match(FILE_EXT_RE)?.[0] ?? routingQuery.trim().replace(/^['`]|['`]$/g, "");
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
  const symbol = intent === "definition" && keywords.length ? keywords[0]! : strongestSymbol(routingQuery, keywords);

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

  if (isSymbolLike(routingQuery)) {
    const q = routingQuery.trim().replace(/^['`]|['`]$/g, "");
    keywords = [q];
    commands.push(makeCmd("symbol-exact", ["discover", q, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "3000"], "exact symbol lookup", "discover"));
    commands.push(makeCmd("symbol-lower", ["discover", q.toLowerCase(), "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case fallback", "discover"));
    commands.push(makeCmd("symbol-glob", ["discover", `*${q.toLowerCase()}*`, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "glob fallback", "discover"));
    commands.push(makeCmd("symbol-text", ["discover", q, "--as", "text", "--scope", scope, "--limit", "10", "--budget", "2500"], "text fallback", "discover"));
    return base("symbol");
  }

  if (keywords.length) {
    const anchors = strongSymbolAnchors(keywords);
    for (const anchor of anchors) {
      commands.push(makeCmd(`symbol-exact-${anchor.toLowerCase()}`, ["discover", anchor, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "3000"], "exact symbol anchor lookup", "discover"));
    }
    commands.push(makeCmd("text-any", ["discover", keywords.slice(0, 4).join(","), "--match", "any", "--as", "text", "--scope", scope, "--limit", "12", "--budget", "3000"], "natural language text lookup", "discover"));
    commands.push(makeCmd("symbol-glob", ["discover", `*${keywords[0]!.toLowerCase()}*`, "--as", "symbol", "--scope", scope, "--limit", "12", "--budget", "2500"], "symbol fallback for strongest keyword", "discover"));
  }
  commands.push(makeCmd("overview-fallback", ["overview", "--scope", scope, "--symbols"], "last-resort orientation", "overview"));
  return base("general");
}

export function validateScope(scope: string): string {
  return scope.trim() || ".";
}
