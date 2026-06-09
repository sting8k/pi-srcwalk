import path from "node:path";
import type { Candidate, QueryPlan } from "../domain/types.js";
import { CODE_EXTS, DOC_EXTS, LANG_EXTS } from "../router/constants.js";
import { domainKeywords, strongSymbolAnchors } from "../router/intent.js";
import { tokenize } from "../index/tokenize.js";
import { candidateFile } from "../srcwalk/parse.js";

const RRF_K = 60;
const RRF_SCALE = 1500;

function isTestTarget(target: string): boolean {
  return /(?:^|[\\/_.-])(test|tests|spec|fixture)s?(?:[\\/_.-]|$)/i.test(target);
}

function isExplanationQuery(plan: QueryPlan): boolean {
  return ["general", "definition", "related"].includes(plan.intent) && /\b(how|work|works|implementation|implemented|calculate|calculation|manage|flow)\b/i.test(plan.query);
}

function isGeneratedOrVendor(file: string): boolean {
  return /(?:^|[\\/_.-])(node_modules|vendor|generated|dist|build|target|coverage)(?:[\\/_.-]|$)|\.generated\./i.test(file);
}

function queryTerms(plan: QueryPlan): string[] {
  const terms = tokenize(domainKeywords(plan).join(" "));
  if (terms.length) return [...new Set(terms)];
  return domainKeywords(plan).map((k) => k.toLowerCase());
}

function pathTerms(file: string): Set<string> {
  return new Set(tokenize(file.replace(/[\\/]/g, " ")));
}

function symbolTerms(symbol: string | undefined): Set<string> {
  return new Set(tokenize(symbol ?? ""));
}

function langMatches(file: string, lang: string): boolean {
  const exts = LANG_EXTS[lang.toLowerCase()];
  return Boolean(exts?.includes(path.extname(file.toLowerCase())));
}

function fileHintMatches(file: string, hint: string): boolean {
  const lowFile = file.toLowerCase();
  const lowHint = hint.toLowerCase().trim().replace(/^['`"]|['`"]$/g, "");
  if (!lowHint) return false;
  if (lowFile.includes(lowHint)) return true;
  return path.basename(lowFile) === path.basename(lowHint);
}

export function exactSymbolAnchorMatches(plan: QueryPlan, cand: Candidate): string[] {
  const anchors = strongSymbolAnchors(domainKeywords(plan));
  if (!anchors.length) return [];
  const symbol = cand.symbol?.toLowerCase();
  const target = cand.target.toLowerCase();
  return anchors.filter((anchor) => {
    const low = anchor.toLowerCase();
    return symbol === low || target.includes(low);
  });
}

export function cloneCandidate(c: Candidate): Candidate {
  return { ...c, evidence: [...c.evidence] };
}

export function dedupeRanked(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const cand of candidates) {
    if (seen.has(cand.target)) continue;
    seen.add(cand.target);
    out.push(cand);
  }
  return out;
}

export function scoreCandidates(candidates: Candidate[], plan: QueryPlan): Candidate[] {
  const kws = queryTerms(plan);
  const ir = plan.queryIR;
  for (const cand of candidates) {
    const file = candidateFile(cand);
    const target = cand.target.toLowerCase();
    const basename = path.basename(file).toLowerCase();
    const stem = path.parse(file).name.toLowerCase();
    const symbol = (cand.symbol ?? "").toLowerCase();
    const pterms = pathTerms(file);
    const sterms = symbolTerms(cand.symbol);

    if (["definition", "grouped-definition", "exact-context"].includes(cand.source)) cand.score += 25;

    const exactAnchors = exactSymbolAnchorMatches(plan, cand);
    if (exactAnchors.length && (["definition", "grouped-definition"].includes(cand.source) || cand.commandLabel.startsWith("symbol-exact"))) {
      cand.score += 95 + exactAnchors.length * 10;
      cand.evidence.push(`boost: exact symbol anchor ${exactAnchors.join(",")}`);
    }

    if (["ts-bm25", "ts-bm25-prf"].includes(cand.source)) cand.score += 15;
    if (cand.source === "file-discover") {
      if (kws.some((kw) => basename.includes(kw))) {
        cand.score += 55;
        cand.evidence.push("boost: filename matches query keyword");
      } else if (kws.some((kw) => target.includes(kw))) {
        cand.score += 30;
        cand.evidence.push("boost: path matches query keyword");
      }
    }

    if (kws.some((kw) => target.includes(kw) || symbol.includes(kw))) cand.score += 12;

    const symbolHits = kws.filter((kw) => sterms.has(kw) || (symbol && symbol.includes(kw)));
    if (symbolHits.length) {
      const boost = Math.min(42, 16 * symbolHits.length + (["definition", "grouped-definition"].includes(cand.source) ? 12 : 0));
      cand.score += boost;
      cand.evidence.push(`boost: symbol token hit ${symbolHits.slice(0, 4).join(",")} (+${boost.toFixed(0)})`);
    }

    const basenameHits = kws.filter((kw) => basename.includes(kw) || stem.includes(kw));
    if (basenameHits.length) {
      const boost = Math.min(54, 22 + 12 * basenameHits.length);
      cand.score += boost;
      cand.evidence.push(`boost: basename hit ${basenameHits.slice(0, 4).join(",")} (+${boost.toFixed(0)})`);
    }

    const pathHits = kws.filter((kw) => pterms.has(kw));
    if (pathHits.length) {
      const coverage = pathHits.length / Math.max(1, kws.length);
      const boost = Math.min(44, 8 * pathHits.length + 18 * coverage);
      cand.score += boost;
      cand.evidence.push(`boost: path token coverage ${pathHits.length}/${kws.length} (+${boost.toFixed(0)})`);
    }

    const boundaryHits = kws.filter((kw) => new RegExp(`(?<![A-Za-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`).test(target));
    if (boundaryHits.length) {
      const boost = Math.min(24, 6 * boundaryHits.length);
      cand.score += boost;
      cand.evidence.push(`boost: word-boundary path hit ${boundaryHits.slice(0, 4).join(",")} (+${boost.toFixed(0)})`);
    }

    if (["definition", "grouped-definition"].includes(cand.source)) {
      cand.score += 18;
      cand.evidence.push("boost: structural definition source (+18)");
    } else if (["exact-context", "next-context"].includes(cand.source)) {
      cand.score += 10;
      cand.evidence.push("boost: structural context source (+10)");
    } else if (["sqlite-fts", "sqlite-fts-prf", "ts-bm25", "ts-bm25-prf", "bm25", "bm25-prf"].includes(cand.source)) {
      cand.score += 10;
      cand.evidence.push("boost: lexical retriever candidate (+10)");
    }

    const testTarget = isTestTarget(target);
    if (plan.intent === "test" && testTarget) cand.score += 20;
    if (plan.intent !== "test" && testTarget) {
      const penalty = isExplanationQuery(plan) ? 36 : 8;
      cand.score -= penalty;
      cand.evidence.push(`penalty: non-test query matched test-like path (-${penalty})`);
    }

    if (ir) {
      const fileHits = ir.fileFilters.filter((hint) => fileHintMatches(file, hint));
      if (fileHits.length) {
        const boost = 72 + 12 * Math.min(2, fileHits.length - 1);
        cand.score += boost;
        cand.evidence.push(`boost: file/path hint matched ${fileHits.slice(0, 2).join(",")} (+${boost.toFixed(0)})`);
      } else if (ir.fileFilters.length) {
        cand.score -= 18;
        cand.evidence.push("penalty: missed file/path hint (-18)");
      }

      const excludedFileHits = ir.excludeFileFilters.filter((hint) => fileHintMatches(file, hint));
      if (excludedFileHits.length) {
        const penalty = 240 + 40 * Math.min(2, excludedFileHits.length - 1);
        cand.score -= penalty;
        cand.evidence.push(`penalty: file/path exclusion matched ${excludedFileHits.slice(0, 2).join(",")} (-${penalty.toFixed(0)})`);
      }

      const symbolHitsHint = ir.symbols.filter((hint) => hint.toLowerCase() === symbol || target.includes(hint.toLowerCase()));
      if (symbolHitsHint.length) {
        const boost = 78 + (["definition", "grouped-definition", "exact-context"].includes(cand.source) ? 24 : 0);
        cand.score += boost;
        cand.evidence.push(`boost: sym hint matched ${symbolHitsHint.slice(0, 2).join(",")} (+${boost.toFixed(0)})`);
      } else if (ir.symbols.length) {
        cand.score -= 12;
        cand.evidence.push("penalty: missed sym hint (-12)");
      }

      const excludedSymbolHits = ir.excludeSymbols.filter((hint) => hint.toLowerCase() === symbol || target.includes(hint.toLowerCase()));
      if (excludedSymbolHits.length) {
        const penalty = 240 + (["definition", "grouped-definition", "exact-context"].includes(cand.source) ? 40 : 0);
        cand.score -= penalty;
        cand.evidence.push(`penalty: sym exclusion matched ${excludedSymbolHits.slice(0, 2).join(",")} (-${penalty.toFixed(0)})`);
      }

      if (ir.lang) {
        if (langMatches(file, ir.lang)) {
          cand.score += 24;
          cand.evidence.push(`boost: lang hint matched ${ir.lang} (+24)`);
        } else if (LANG_EXTS[ir.lang]) {
          cand.score -= 8;
          cand.evidence.push(`penalty: missed lang hint ${ir.lang} (-8)`);
        }
      }

      const excludedLangHits = ir.excludeLangs.filter((hint) => langMatches(file, hint));
      if (excludedLangHits.length) {
        const penalty = 120 * Math.min(2, excludedLangHits.length);
        cand.score -= penalty;
        cand.evidence.push(`penalty: lang exclusion matched ${excludedLangHits.slice(0, 2).join(",")} (-${penalty.toFixed(0)})`);
      }

      if (ir.includeTests && testTarget) {
        cand.score += 38;
        cand.evidence.push("boost: test hint matched test-like path (+38)");
      } else if (ir.includeTests && !testTarget) {
        cand.score -= 10;
        cand.evidence.push("penalty: test hint with non-test path (-10)");
      }
      if (ir.excludeTests && testTarget) {
        cand.score -= 60;
        cand.evidence.push("penalty: -test excluded test-like path (-60)");
      }

      const contentHits = tokenize(ir.contentTerms.join(" ")).filter((t) => target.includes(t) || symbol.includes(t));
      if (contentHits.length) {
        const boost = Math.min(30, 10 * contentHits.length);
        cand.score += boost;
        cand.evidence.push(`boost: content hint path/symbol hit ${contentHits.slice(0, 3).join(",")} (+${boost.toFixed(0)})`);
      }
      const excludedContentHits = tokenize(ir.excludeContentTerms.join(" ")).filter((t) => target.includes(t) || symbol.includes(t));
      if (excludedContentHits.length) {
        const penalty = Math.min(120, 40 * excludedContentHits.length);
        cand.score -= penalty;
        cand.evidence.push(`penalty: content exclusion path/symbol hit ${excludedContentHits.slice(0, 3).join(",")} (-${penalty.toFixed(0)})`);
      }
    }

    if (["general", "definition", "related"].includes(plan.intent) && ["rank", "ranking", "score", "scoring"].some((kw) => kws.includes(kw)) && /rank|score|search\/rank/.test(target)) {
      cand.score += 20;
      cand.evidence.push("boost: ranking/scoring path");
    }

    if (["general", "definition", "related"].includes(plan.intent)) {
      if (isCodeFile(file)) {
        cand.score += 8;
        cand.evidence.push("boost: code file for code-intent query (+8)");
      } else if (isDocFile(file)) {
        cand.score -= 10;
        cand.evidence.push("penalty: doc file for code-intent query (-10)");
      }
    }
    if (isGeneratedOrVendor(file)) {
      cand.score -= 38;
      cand.evidence.push("penalty: generated/vendor/build-like path (-38)");
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

export function rrfFuse(rankLists: Array<[string, Candidate[], number]>): Candidate[] {
  const scores = new Map<string, number>();
  const reps = new Map<string, Candidate>();
  const labels = new Map<string, string[]>();
  for (const [label, candidates, weight] of rankLists) {
    const seen = new Set<string>();
    candidates.forEach((cand, index) => {
      if (seen.has(cand.target)) return;
      seen.add(cand.target);
      scores.set(cand.target, (scores.get(cand.target) ?? 0) + weight / (RRF_K + index + 1));
      (labels.get(cand.target) ?? labels.set(cand.target, []).get(cand.target)!).push(`${label}@${index + 1}`);
      const existing = reps.get(cand.target);
      if (!existing) reps.set(cand.target, cloneCandidate(cand));
      else {
        if (!existing.symbol && cand.symbol) existing.symbol = cand.symbol;
        if (existing.kind === "unknown" && cand.kind !== "unknown") existing.kind = cand.kind;
        existing.evidence.push(...cand.evidence.filter((e) => !existing.evidence.includes(e)));
      }
    });
  }
  return [...reps.entries()].map(([target, cand]) => {
    const raw = scores.get(target) ?? 0;
    cand.score = Math.max(cand.score, 0) + raw * RRF_SCALE;
    cand.source = "rrf-fusion";
    cand.evidence.push(`ts rrf raw=${raw.toFixed(5)} ranks=${(labels.get(target) ?? []).join(",")}`);
    return cand;
  }).sort((a, b) => b.score - a.score);
}

export function isDocFile(file: string): boolean {
  return DOC_EXTS.has(path.extname(file.toLowerCase()));
}

export function isCodeFile(file: string): boolean {
  return CODE_EXTS.has(path.extname(file.toLowerCase()));
}

export function sameModule(pathA: string, pathB: string): boolean {
  const a = path.dirname(pathA);
  const b = path.dirname(pathB);
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export function bm25HasStrongCluster(plan: QueryPlan, candidates: Candidate[]): [boolean, string] {
  if (candidates.length < 2) return [false, "not enough BM25 candidates"];
  const top = candidates.slice(0, 3);
  const topFile = candidateFile(top[0]!);
  const sameFileCount = top.filter((c) => candidateFile(c) === topFile).length;
  const sameDirCount = top.filter((c) => sameModule(candidateFile(c), topFile)).length;
  const gap = top[0]!.score - (top[1]?.score ?? 0);
  const pathText = top.map((c) => c.target.toLowerCase()).join(" ");
  const kwHits = domainKeywords(plan).filter((kw) => pathText.includes(kw.toLowerCase())).length;
  if (plan.intent !== "test" && isExplanationQuery(plan) && isTestTarget(topFile)) {
    return [false, `BM25 cluster ignored: explanation query top cluster is test-like path ${topFile}`];
  }
  if (sameFileCount >= 2 && kwHits >= 1) return [true, `BM25 cluster: ${sameFileCount}/${top.length} top candidates in ${topFile} with keyword path hit`];
  if (sameDirCount >= 3 && gap >= 2 && kwHits >= 1) return [true, `BM25 module cluster: ${sameDirCount}/${top.length} top candidates near ${path.dirname(topFile)}`];
  return [false, "BM25 cluster not strong"];
}
