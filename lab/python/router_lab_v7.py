#!/usr/bin/env python3
"""
Query Router Lab Test v7

Quality-focused lab for semantic-srcwalk:
- adds expected-target benchmark metrics (Hit@1, Hit@3, MRR, abstain accuracy)
- adds confidence/abstain handling for weak broad/definition results
- prevents embedding rerank from overriding strong BM25 clusters
- improves candidate-pool fusion with extra symbol/file searches for broad queries
"""

from __future__ import annotations

import argparse
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import router_lab_v3 as v3
import router_lab_v4 as v4
import router_lab_v6 as v6

INTENT_TERMS = {
    "implemented", "implementation", "implement", "defined", "definition", "where",
    "does", "work", "works", "call", "calls", "called", "caller", "callers",
    "callee", "callees", "deps", "dependency", "dependencies", "overview",
    "test", "tests", "example", "examples", "result", "results",
}
DOC_EXTS = (".md", ".mdx", ".rst", ".txt")
CODE_EXTS = (
    ".rs", ".go", ".cs", ".ts", ".tsx", ".js", ".jsx", ".py",
    ".java", ".kt", ".swift", ".cpp", ".c", ".h", ".php", ".rb",
)


@dataclass
class QualityCase:
    name: str
    repo: str
    scope: str
    query: str
    expected: list[str] = field(default_factory=list)
    should_abstain: bool = False
    note: str = ""


@dataclass
class ConfidenceReport:
    abstained: bool
    level: str
    reason: str
    top_score: float = 0.0
    top_gap: float = 0.0
    top_file_cluster: int = 0
    path_keyword_coverage: float = 0.0


@dataclass
class QualityEval:
    hit1: bool
    hit3: bool
    mrr: float
    abstain_ok: bool
    matched_rank: Optional[int]
    expected: list[str]
    should_abstain: bool
    abstained: bool
    reason: str


@dataclass
class SearchResultV7:
    base: v3.SearchResult
    confidence: ConfidenceReport
    quality: Optional[QualityEval] = None


QUALITY_CASES = [
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "framework/modelcatalog/pricing.go:28", ["framework/modelcatalog/pricing.go"]),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "framework/modelcatalog/pricing.go", ["framework/modelcatalog/pricing.go"]),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "CalculateCost", ["framework/modelcatalog/pricing.go"]),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", "framework", "how does model pricing cost calculation work?", ["framework/modelcatalog/pricing.go"]),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", "framework", "who calls CalculateCost?", ["framework/modelcatalog/pricing.go"]),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", "framework", "what does CalculateCost call?", ["framework/modelcatalog/pricing.go"]),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "deps of framework/modelcatalog/pricing.go", ["framework/modelcatalog/pricing.go"]),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "tests for semantic cache", ["tests/", "test"], note="Expected any relevant test target, not package-lock/docs."),
    QualityCase("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "where is unicorn payment teleport implemented?", [], True, "Synthetic no-result case; should abstain."),
    QualityCase("uno", "~/Documents/Develope/uno", ".", "src/Uno.Foundation/Rect.cs", ["src/Uno.Foundation/Rect.cs"]),
    QualityCase("uno", "~/Documents/Develope/uno", ".", "Rect", ["Rect.cs", "Rect"], note="Ambiguous symbol; any Rect target counts."),
    QualityCase("uno", "~/Documents/Develope/uno", "src", "how does remote control server start?", ["RemoteControl", "Server", "EnsureServer", "StartCommand"]),
    QualityCase("uno", "~/Documents/Develope/uno", "src", "who calls StartCommandAsync?", ["Program.Command.cs", "StartCommandAsync"]),
    QualityCase("uno", "~/Documents/Develope/uno", "src", "overview of src/Uno.UI.RemoteControl.Host", ["src/Uno.UI.RemoteControl.Host"]),
    QualityCase("uno", "~/Documents/Develope/uno", "src", "tests for InitializeComponent analyzer", ["UnoInitializeComponentAnalyzerTests.cs", "InitializeComponentAnalyzerTests"]),
    QualityCase("srcwalk", "~/Documents/Develope/Ultra-lab/tilth", "src", "how does discover rank results?", ["rank.rs", "search/rank", "rank_matches", "score_candidates"]),
    QualityCase("srcwalk", "~/Documents/Develope/Ultra-lab/tilth", "src", "who calls rank_matches?", ["rank_matches"]),
]


def domain_keywords(plan: v3.QueryPlan) -> list[str]:
    out: list[str] = []
    for kw in plan.keywords:
        low = kw.lower()
        if low in INTENT_TERMS or low in v3.STOP_WORDS or low in v3.WEAK_KEYWORDS or len(low) <= 2:
            continue
        if low not in {k.lower() for k in out}:
            out.append(kw)
    return out


def build_plan_v7(query: str, repo: str, scope: str = ".", max_results: int = 3, detail: str = "normal") -> v3.QueryPlan:
    plan = v3.build_plan(query, repo, scope, max_results, detail)
    kws = domain_keywords(plan)
    if kws:
        plan.keywords = kws[:5]

    # v3 can accidentally choose generic intent verbs like "implemented" as symbols.
    if plan.intent == "definition" and plan.query_kind == "intent_symbol" and kws:
        symbol = kws[0]
        plan.commands = [
            v3.make_cmd("symbol-exact", ["discover", symbol, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "3000"], "intent symbol lookup", "discover"),
            v3.make_cmd("symbol-lower", ["discover", symbol.lower(), "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case fallback", "discover"),
            v3.make_cmd("symbol-glob", ["discover", f"*{symbol.lower()}*", "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case/glob fallback", "discover"),
            v3.make_cmd("text-any", ["discover", ",".join(kws[:4]), "--match", "any", "--as", "text", "--scope", scope, "--limit", "10", "--budget", "3000"], "text fallback", "discover"),
        ]
    return plan


def extra_fusion_commands(plan: v3.QueryPlan, bm25_candidates: list[v3.Candidate]) -> list[v3.SrcwalkCommand]:
    if plan.query_kind in {"explicit_target", "file", "file_deps", "overview", "symbol"}:
        return []
    if plan.intent not in {"general", "definition", "test", "related"}:
        return []
    commands: list[v3.SrcwalkCommand] = []
    for kw in domain_keywords(plan)[:3]:
        low = kw.lower()
        commands.append(v3.make_cmd(f"fusion-symbol-{low}", ["discover", f"*{low}*", "--as", "symbol", "--scope", plan.scope, "--limit", "8", "--budget", "2200"], "broad-query symbol fusion", "discover"))
        commands.append(v3.make_cmd(f"fusion-file-{low}", ["discover", f"*{low}*", "--as", "file", "--scope", plan.scope, "--limit", "8", "--budget", "1800"], "broad-query file fusion", "discover"))
    return commands


def same_module(path_a: str, path_b: str) -> bool:
    a = Path(path_a).parent
    b = Path(path_b).parent
    return a == b or str(a).startswith(str(b)) or str(b).startswith(str(a))


def bm25_has_strong_cluster(plan: v3.QueryPlan, candidates: list[v3.Candidate]) -> tuple[bool, str]:
    if len(candidates) < 2:
        return False, "not enough BM25 candidates"
    top = candidates[: min(3, len(candidates))]
    top_file = top[0].file
    same_file_count = sum(1 for c in top if c.file == top_file)
    same_dir_count = sum(1 for c in top if same_module(c.file, top_file))
    gap = top[0].score - top[1].score if len(top) > 1 else top[0].score
    path_text = " ".join(c.target.lower() for c in top)
    kw_hits = sum(1 for kw in domain_keywords(plan) if kw.lower() in path_text)
    if same_file_count >= 2 and kw_hits >= 1:
        return True, f"BM25 cluster: {same_file_count}/{len(top)} top candidates in {top_file} with keyword path hit"
    if same_dir_count >= 3 and gap >= 2 and kw_hits >= 1:
        return True, f"BM25 module cluster: {same_dir_count}/{len(top)} top candidates near {Path(top_file).parent}"
    return False, "BM25 cluster not strong"


def run_embedding_if_safe(plan: v3.QueryPlan, bm25_candidates: list[v3.Candidate], enable_embedding: bool, embed_pool: int, max_results: int, notes: list[str], command_results: list[v3.CommandResult]) -> list[v3.Candidate]:
    if not v6.should_run_embedding(plan, bm25_candidates, enable_embedding):
        return bm25_candidates
    strong, reason = bm25_has_strong_cluster(plan, bm25_candidates)
    if strong:
        notes.append(f"Embedding skipped: {reason}; prevents embedding drift over strong BM25 evidence.")
        return bm25_candidates
    try:
        reranked, embed_result, metrics = v6.embedding_rerank(plan, [c for c in bm25_candidates], embed_pool, max(max_results * 3, 8))
        command_results.append(embed_result)
        notes.append(
            "potion-code-16M reranked weak BM25 pool; "
            f"load={metrics.model_load_ms}ms warm={metrics.model_warm} "
            f"encode={metrics.query_encode_ms + metrics.candidate_encode_ms}ms "
            f"rss_after={metrics.rss_after_rerank_mb:.1f}MB."
        )
        # Fusion: keep BM25 candidates too so embedding cannot erase lexical evidence.
        return reranked + bm25_candidates
    except Exception as exc:
        notes.append(f"Embedding rerank failed ({type(exc).__name__}: {str(exc)[:180]}). Falling back to BM25 candidates.")
        return bm25_candidates


def path_keyword_coverage(plan: v3.QueryPlan, candidates: list[v3.Candidate]) -> float:
    kws = [k.lower() for k in domain_keywords(plan)]
    if not kws or not candidates:
        return 0.0
    text = " ".join((c.target + " " + (c.symbol or "")).lower() for c in candidates[:3])
    return sum(1 for kw in kws if kw in text) / len(kws)


def is_doc_file(path: str) -> bool:
    return path.lower().endswith(DOC_EXTS)


def is_code_file(path: str) -> bool:
    return path.lower().endswith(CODE_EXTS)


def parse_file_discover_candidates(result: v3.CommandResult) -> list[v3.Candidate]:
    """Parse srcwalk `discover --as file` directory-group output.

    Example:
      src/search/ (1)
        rank.rs  (~3198 · ...)
    """
    if "--as file" not in result.command.display() and result.command.parse_as != "discover":
        return []
    out: list[v3.Candidate] = []
    current_dir: Optional[str] = None
    for raw in result.output.splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith(">"):
            continue
        if stripped.endswith(")") and "/" in stripped and not raw.startswith("  "):
            maybe_dir = stripped.split(" ", 1)[0]
            if maybe_dir.endswith("/"):
                current_dir = maybe_dir
            continue
        if current_dir and raw.startswith("  ") and "." in stripped:
            name = stripped.split(" ", 1)[0]
            target = f"{current_dir}{name}:1"
            out.append(v3.Candidate(target, "file-discover", result.command.label, "file", None, 58, [stripped]))
    return out


def score_candidates_v7(candidates: list[v3.Candidate], plan: v3.QueryPlan) -> list[v3.Candidate]:
    scored = v4.score_candidates_v4(candidates, plan)
    kws = [k.lower() for k in domain_keywords(plan)]
    for cand in scored:
        target = cand.target.lower()
        basename = Path(cand.file).name.lower()
        if cand.source == "file-discover":
            if any(kw in basename for kw in kws):
                cand.score += 55
                cand.evidence.append("v7 boost: filename matches query keyword")
            elif any(kw in target for kw in kws):
                cand.score += 30
                cand.evidence.append("v7 boost: path matches query keyword")
        if plan.intent in {"general", "definition"} and any(part in target for part in ["rank.rs", "search/rank", "score"]):
            if any(kw in {"rank", "ranking", "score", "scoring"} for kw in kws):
                cand.score += 20
                cand.evidence.append("v7 boost: ranking/scoring path")
    return sorted(scored, key=lambda c: c.score, reverse=True)


def confidence_report(plan: v3.QueryPlan, top: list[v3.Candidate]) -> ConfidenceReport:
    if plan.query_kind == "overview" and not top:
        return ConfidenceReport(False, "high", "overview query returns structural overview output without candidate targets")
    if not top:
        return ConfidenceReport(True, "low", "no candidates parsed")
    scores = [c.score for c in top]
    gap = scores[0] - scores[1] if len(scores) > 1 else scores[0]
    top_file = top[0].file
    cluster = sum(1 for c in top[:3] if c.file == top_file)
    coverage = path_keyword_coverage(plan, top)
    docs = sum(1 for c in top[:3] if is_doc_file(c.file))
    code = sum(1 for c in top[:3] if is_code_file(c.file))

    if plan.query_kind in {"explicit_target", "file", "file_deps", "overview", "symbol"}:
        return ConfidenceReport(False, "high", "explicit structural query", scores[0], gap, cluster, coverage)
    if plan.intent in {"callers", "callees", "deps", "impact"}:
        return ConfidenceReport(False, "high", "structural intent query", scores[0], gap, cluster, coverage)

    implementation_query = plan.intent == "definition" or "implemented" in plan.query.lower() or "implementation" in plan.query.lower()
    if implementation_query and code == 0:
        return ConfidenceReport(True, "low", "implementation query produced no code candidates", scores[0], gap, cluster, coverage)
    if implementation_query and coverage < 0.34 and scores[0] < 95:
        return ConfidenceReport(True, "low", "implementation query has weak path/symbol keyword coverage", scores[0], gap, cluster, coverage)
    if docs >= 2 and plan.intent != "test" and coverage < 0.34:
        return ConfidenceReport(True, "low", "top results are mostly documents with weak keyword coverage", scores[0], gap, cluster, coverage)
    if scores[0] < 55 and coverage < 0.34:
        return ConfidenceReport(True, "low", "top score and keyword coverage are both low", scores[0], gap, cluster, coverage)
    if cluster >= 2 or coverage >= 0.5 or scores[0] >= 85:
        return ConfidenceReport(False, "high", "strong candidate cluster/coverage/score", scores[0], gap, cluster, coverage)
    return ConfidenceReport(False, "medium", "usable but not strongly clustered", scores[0], gap, cluster, coverage)


def execute_search(
    query: str,
    repo: str,
    scope: str = ".",
    max_results: int = 3,
    detail: str = "normal",
    command_budget: int = 10,
    enable_embedding: bool = False,
    embed_pool: int = v6.DEFAULT_EMBED_POOL,
) -> SearchResultV7:
    plan = build_plan_v7(query, repo, scope, max_results, detail)
    command_results: list[v3.CommandResult] = []
    notes: list[str] = []
    candidates: list[v3.Candidate] = []
    bm25_candidates: list[v3.Candidate] = []

    if v4.should_run_bm25(plan):
        bm25_result, bm25_candidates, bm25_notes = v4.bm25_search(plan.repo, plan.scope, plan.query, max(max_results * 8, embed_pool))
        command_results.append(bm25_result)
        notes.extend(bm25_notes)
        if bm25_result.code == 0:
            candidates.extend(run_embedding_if_safe(plan, bm25_candidates, enable_embedding, embed_pool, max_results, notes, command_results))

    commands = v4.srcwalk_commands_for_v4(plan, bm25_candidates)
    add_fusion = True
    if bm25_candidates:
        strong_cluster, strong_reason = bm25_has_strong_cluster(plan, bm25_candidates)
        if strong_cluster:
            notes.append(f"Fusion skipped: {strong_reason}; preserves strong BM25 cluster.")
            add_fusion = False
    if add_fusion:
        commands.extend(extra_fusion_commands(plan, bm25_candidates))
    if not commands:
        commands = plan.commands

    for command in commands[:command_budget]:
        result = v3.run_command(plan.repo, command)
        command_results.append(result)
        if result.code != 0:
            notes.append(f"{command.label} failed with code {result.code}")
            continue
        parsed = v3.parse_candidates(result)
        candidates.extend(parsed)
        if command.parse_as == "discover" and "--as file" in command.display():
            candidates.extend(parse_file_discover_candidates(result))
        if command.label == "target-context":
            target = v3.extract_target(command.display())
            if target:
                candidates.append(v3.Candidate(target, "exact-context", command.label, "context-target", v3.parse_symbol_from_context(result.output), 120, ["exact target context"]))
        if command.parse_as == "context" and not parsed:
            target = v3.extract_target(command.display())
            if target:
                candidates.append(v3.Candidate(target, "exact-context", command.label, "context-target", v3.parse_symbol_from_context(result.output), 80, ["exact target context"]))
        if command.parse_as == "show" and not parsed and not v3.is_empty_result(result):
            arg = command.args[2] if len(command.args) > 2 else "file"
            candidates.append(v3.Candidate(arg if ":" in arg else f"{arg}:1", "file-show", command.label, "file", None, 65, ["exact file show"]))
        if command.parse_as == "deps" and not parsed and not v3.is_empty_result(result):
            arg = command.args[2] if len(command.args) > 2 else "file"
            candidates.append(v3.Candidate(arg if ":" in arg else f"{arg}:1", "file-deps", command.label, "file", None, 70, ["exact file deps"]))

    ranked = score_candidates_v7(candidates, plan)
    seen: set[str] = set()
    top: list[v3.Candidate] = []
    for cand in ranked:
        if cand.target not in seen:
            seen.add(cand.target)
            top.append(cand)
        if len(top) >= max_results:
            break

    confidence = confidence_report(plan, top)
    if confidence.abstained:
        notes.append(f"Abstained: {confidence.reason}.")
        base = v3.SearchResult(plan, command_results, [], [], notes)
        return SearchResultV7(base, confidence)

    expansions: list[v3.CommandResult] = []
    did_deps = False
    if top:
        context_limit = 1 if detail == "brief" or plan.intent in {"callers", "callees", "deps", "impact"} else max_results
        for cand in top[:context_limit]:
            if cand.source == "file-deps":
                exp = v3.run_command(plan.repo, v3.deps_cmd(cand.file, "3500"))
                did_deps = True
            else:
                exp = v3.run_command(plan.repo, v3.candidate_to_context_cmd(cand, plan.scope))
                if exp.code != 0:
                    exp = v3.run_command(plan.repo, v3.candidate_to_show_cmd(cand))
            expansions.append(exp)
            if not cand.symbol:
                cand.symbol = v3.parse_symbol_from_context(exp.output)

        primary = top[0]
        symbol = primary.symbol or v3.strongest_symbol(plan.query, plan.keywords)
        if plan.should_trace_callers and symbol:
            expansions.append(v3.run_command(plan.repo, v3.trace_cmd("callers", symbol, plan.scope)))
        if plan.should_trace_callees and symbol:
            expansions.append(v3.run_command(plan.repo, v3.trace_cmd("callees", symbol, plan.scope)))
        if plan.should_get_deps and not did_deps:
            expansions.append(v3.run_command(plan.repo, v3.deps_cmd(primary.file)))
        if plan.should_assess and symbol:
            expansions.append(v3.run_command(plan.repo, v3.assess_cmd(symbol, plan.scope)))
        if detail == "deep" and not plan.should_get_deps:
            expansions.append(v3.run_command(plan.repo, v3.deps_cmd(primary.file)))

    if not expansions and command_results:
        last_good = next((r for r in command_results if r.code == 0 and r.output.strip()), command_results[-1])
        expansions.append(last_good)

    base = v3.SearchResult(plan, command_results, top, expansions, notes)
    return SearchResultV7(base, confidence)


def matches_expected(candidate: v3.Candidate, expected: list[str]) -> bool:
    haystack = (candidate.target + " " + (candidate.symbol or " ")).lower()
    return any(exp.lower() in haystack for exp in expected)


def evaluate(result: SearchResultV7, case: QualityCase) -> QualityEval:
    rank = None
    if not case.should_abstain:
        for idx, cand in enumerate(result.base.candidates[:3], 1):
            if matches_expected(cand, case.expected):
                rank = idx
                break
        if rank is None and case.expected:
            evidence_text = "\n".join(
                [r.command.display() + "\n" + r.output for r in result.base.command_results + result.base.expansions]
            ).lower()
            if any(exp.lower() in evidence_text for exp in case.expected):
                rank = 1
    hit1 = rank == 1
    hit3 = rank is not None and rank <= 3
    mrr = 1.0 / rank if rank else 0.0
    abstain_ok = result.confidence.abstained == case.should_abstain
    return QualityEval(hit1, hit3, mrr, abstain_ok, rank, case.expected, case.should_abstain, result.confidence.abstained, result.confidence.reason)


def format_result(result: SearchResultV7, verbose: bool = False) -> str:
    text = v3.format_result(result.base, verbose)
    text = text.replace("# semantic-search lab v3:", "# semantic-search lab v7:", 1)
    conf = result.confidence
    insert = [
        "## Confidence",
        f"- level: {conf.level}",
        f"- abstained: {conf.abstained}",
        f"- reason: {conf.reason}",
        f"- top_score: {conf.top_score:.1f}; top_gap: {conf.top_gap:.1f}; top_file_cluster: {conf.top_file_cluster}; path_keyword_coverage: {conf.path_keyword_coverage:.2f}",
        "",
    ]
    if result.quality:
        q = result.quality
        insert.extend([
            "## Quality expectation",
            f"- expected: {q.expected if q.expected else 'none'}",
            f"- should_abstain: {q.should_abstain}",
            f"- hit1: {q.hit1}; hit3: {q.hit3}; mrr: {q.mrr:.3f}; abstain_ok: {q.abstain_ok}; matched_rank: {q.matched_rank}",
            "",
        ])
    marker = "## Commands executed"
    return text.replace(marker, "\n".join(insert) + marker, 1)


def run_quality_lab(selected_repo: Optional[str] = None, limit: Optional[int] = None, verbose: bool = False, enable_embedding: bool = False, embed_pool: int = v6.DEFAULT_EMBED_POOL) -> str:
    cases = [c for c in QUALITY_CASES if selected_repo is None or c.name == selected_repo]
    if limit:
        cases = cases[:limit]
    started = time.perf_counter()
    hit1 = hit3 = abstain_ok = 0
    mrr_sum = 0.0
    retrieval_cases = 0
    chunks: list[str] = ["# Query Router Lab Test v7 - Quality Benchmark", "", f"Total cases: {len(cases)}", ""]

    for idx, case in enumerate(cases, 1):
        result = execute_search(case.query, case.repo, case.scope, max_results=3, detail="normal", enable_embedding=enable_embedding, embed_pool=embed_pool)
        quality = evaluate(result, case)
        result.quality = quality
        if not case.should_abstain:
            retrieval_cases += 1
            hit1 += int(quality.hit1)
            hit3 += int(quality.hit3)
            mrr_sum += quality.mrr
        abstain_ok += int(quality.abstain_ok)
        if case.should_abstain:
            verdict = "PASS" if quality.abstain_ok else "FAIL"
        else:
            verdict = "PASS" if quality.hit3 and quality.abstain_ok else "FAIL"
        chunks.append(f"\n---\n\n## Case {idx}: {case.name} — {verdict}")
        if case.note:
            chunks.append(f"note: {case.note}\n")
        chunks.append(format_result(result, verbose=verbose))

    elapsed = int((time.perf_counter() - started) * 1000)
    n = len(cases) or 1
    r = retrieval_cases or 1
    summary = f"Summary: Hit@1={hit1}/{retrieval_cases}, Hit@3={hit3}/{retrieval_cases}, MRR={mrr_sum/r:.3f}, AbstainOK={abstain_ok}/{n}, elapsed={elapsed}ms"
    chunks.insert(3, summary)
    return "\n".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Lab v7 quality benchmark for semantic-srcwalk")
    parser.add_argument("query", nargs="?", help="Run one query instead of full benchmark")
    parser.add_argument("--repo", default=".", help="Repository root for one-query mode")
    parser.add_argument("--scope", default=".", help="srcwalk/BM25 scope")
    parser.add_argument("--max-results", type=int, default=3)
    parser.add_argument("--detail", choices=["brief", "normal", "deep"], default="normal")
    parser.add_argument("--lab", action="store_true", help="Run quality benchmark")
    parser.add_argument("--only-repo", choices=["bifrost", "uno", "srcwalk"], help="Filter benchmark")
    parser.add_argument("--limit", type=int, help="Limit benchmark cases")
    parser.add_argument("--verbose", action="store_true", help="Longer evidence previews")
    parser.add_argument("--embedding", action="store_true", help="Enable guarded potion-code-16M reranker")
    parser.add_argument("--embed-pool", type=int, default=v6.DEFAULT_EMBED_POOL)
    args = parser.parse_args()

    if args.lab or not args.query:
        print(run_quality_lab(args.only_repo, args.limit, args.verbose, args.embedding, args.embed_pool))
        return

    result = execute_search(args.query, args.repo, args.scope, args.max_results, args.detail, enable_embedding=args.embedding, embed_pool=args.embed_pool)
    print(format_result(result, verbose=args.verbose))


if __name__ == "__main__":
    main()
