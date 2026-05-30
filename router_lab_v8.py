#!/usr/bin/env python3
"""
Query Router Lab Test v8

RRF-focused lab for semantic-srcwalk:
- keeps srcwalk router/evidence expansion as the product shape
- fuses BM25/PRF rank, srcwalk structural rank, and optional embedding rank with RRF
- keeps v7 confidence/abstain and tightens implementation-query abstention
- keeps guarded embedding so semantic rerank cannot override strong lexical/structural evidence
"""

from __future__ import annotations

import argparse
import time
from collections import defaultdict
from dataclasses import replace
from pathlib import Path
from typing import Optional

import router_lab_v3 as v3
import router_lab_v4 as v4
import router_lab_v6 as v6
import router_lab_v7 as v7

RRF_K = 60
RRF_SCALE = 1500.0


GHIDRA_CASES = [
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", ".", "Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774", ["DecompInterface.java"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", ".", "Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java", ["DecompInterface.java"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", ".", "DecompInterface", ["DecompInterface.java", "DecompInterface"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", "Ghidra/Features/Decompiler", "how does decompile function work?", ["decompile", "Decompiler", "DecompInterface"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", "Ghidra/Features/Decompiler", "who calls decompileFunction?", ["decompileFunction"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", ".", "deps of Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java", ["DecompInterface.java"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", ".", "ProgramDB", ["ProgramDB"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", "Ghidra/Framework", "how does program database manage memory and symbols?", ["ProgramDB", "database", "symbol"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", "Ghidra/Features/Decompiler", "overview of Ghidra/Features/Decompiler", ["Ghidra/Features/Decompiler"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", "Ghidra/Features/Decompiler", "tests for decompiler interface", ["test", "Decompiler", "DecompInterface"]),
    v7.QualityCase("ghidra", "~/Documents/Develope/ghidra", "Ghidra/Features/Decompiler", "where is unicorn quantum teleport patching implemented?", [], True, "Synthetic no-result case; should abstain."),
]

QUALITY_CASES = v7.QUALITY_CASES + GHIDRA_CASES


def clone_candidate(c: v3.Candidate) -> v3.Candidate:
    return v3.Candidate(c.target, c.source, c.command_label, c.kind, c.symbol, c.score, list(c.evidence))


def dedupe_ranked(candidates: list[v3.Candidate]) -> list[v3.Candidate]:
    seen: set[str] = set()
    out: list[v3.Candidate] = []
    for cand in candidates:
        if cand.target in seen:
            continue
        seen.add(cand.target)
        out.append(cand)
    return out


def has_domain_path_hit(plan: v3.QueryPlan, candidates: list[v3.Candidate]) -> bool:
    kws = [k.lower() for k in v7.domain_keywords(plan)]
    if not kws:
        return False
    text = " ".join((c.target + " " + (c.symbol or "")).lower() for c in candidates[:5])
    return any(kw in text for kw in kws)


def rrf_fuse(rank_lists: list[tuple[str, list[v3.Candidate], float]], plan: v3.QueryPlan) -> list[v3.Candidate]:
    """Fuse ranked candidates without making any single retriever authoritative.

    RRF is intentionally used only for candidate ordering. The final answer still expands
    evidence via srcwalk context/trace/deps.
    """
    scores: dict[str, float] = defaultdict(float)
    reps: dict[str, v3.Candidate] = {}
    labels: dict[str, list[str]] = defaultdict(list)

    for label, candidates, weight in rank_lists:
        seen_in_list: set[str] = set()
        for rank, cand in enumerate(candidates, 1):
            if cand.target in seen_in_list:
                continue
            seen_in_list.add(cand.target)
            scores[cand.target] += weight / (RRF_K + rank)
            labels[cand.target].append(f"{label}@{rank}")
            if cand.target not in reps:
                reps[cand.target] = clone_candidate(cand)
            else:
                rep = reps[cand.target]
                if not rep.symbol and cand.symbol:
                    rep.symbol = cand.symbol
                if rep.kind == "unknown" and cand.kind != "unknown":
                    rep.kind = cand.kind
                rep.evidence.extend(e for e in cand.evidence if e not in rep.evidence)

    fused: list[v3.Candidate] = []
    for target, cand in reps.items():
        raw = scores[target]
        base = max(cand.score, 0.0)
        cand.score = base + raw * RRF_SCALE
        cand.source = "rrf-fusion"
        cand.evidence.append(f"v8 rrf raw={raw:.5f} ranks={','.join(labels[target])}")
        fused.append(cand)
    return sorted(fused, key=lambda c: c.score, reverse=True)


def run_embedding_rank_if_safe(
    plan: v3.QueryPlan,
    bm25_candidates: list[v3.Candidate],
    enable_embedding: bool,
    embed_pool: int,
    max_results: int,
    notes: list[str],
    command_results: list[v3.CommandResult],
) -> list[v3.Candidate]:
    if not v6.should_run_embedding(plan, bm25_candidates, enable_embedding):
        return []
    strong, reason = v7.bm25_has_strong_cluster(plan, bm25_candidates)
    if strong:
        notes.append(f"Embedding skipped: {reason}; RRF keeps strong BM25 evidence authoritative.")
        return []
    try:
        pool = [clone_candidate(c) for c in bm25_candidates]
        reranked, embed_result, metrics = v6.embedding_rerank(plan, pool, embed_pool, max(max_results * 4, 10))
        command_results.append(embed_result)
        notes.append(
            "potion-code-16M produced optional embedding rank for RRF; "
            f"load={metrics.model_load_ms}ms warm={metrics.model_warm} "
            f"encode={metrics.query_encode_ms + metrics.candidate_encode_ms}ms "
            f"rss_after={metrics.rss_after_rerank_mb:.1f}MB."
        )
        return reranked
    except Exception as exc:
        notes.append(f"Embedding rank failed ({type(exc).__name__}: {str(exc)[:180]}). Falling back to BM25/srcwalk ranks.")
        return []


def confidence_report_v8(plan: v3.QueryPlan, top: list[v3.Candidate]) -> v7.ConfidenceReport:
    if not top:
        return v7.confidence_report(plan, top)
    implementation_query = plan.intent == "definition" or "implemented" in plan.query.lower() or "implementation" in plan.query.lower()
    coverage = v7.path_keyword_coverage(plan, top)
    code = sum(1 for c in top[:3] if v7.is_code_file(c.file))
    # Ghidra exposed this failure mode: a fake implementation query can form a same-file
    # BM25 cluster even though no domain keyword appears in path/symbol evidence.
    if implementation_query and code > 0 and coverage == 0.0 and not has_domain_path_hit(plan, top):
        scores = [c.score for c in top]
        gap = scores[0] - scores[1] if len(scores) > 1 else scores[0]
        cluster = sum(1 for c in top[:3] if c.file == top[0].file)
        return v7.ConfidenceReport(True, "low", "implementation query has zero path/symbol keyword coverage after RRF", scores[0], gap, cluster, coverage)
    return v7.confidence_report(plan, top)


def execute_search(
    query: str,
    repo: str,
    scope: str = ".",
    max_results: int = 3,
    detail: str = "normal",
    command_budget: int = 10,
    enable_embedding: bool = False,
    embed_pool: int = v6.DEFAULT_EMBED_POOL,
) -> v7.SearchResultV7:
    plan = v7.build_plan_v7(query, repo, scope, max_results, detail)
    command_results: list[v3.CommandResult] = []
    notes: list[str] = []
    bm25_candidates: list[v3.Candidate] = []
    structural_candidates: list[v3.Candidate] = []
    embedding_candidates: list[v3.Candidate] = []

    if v4.should_run_bm25(plan):
        bm25_result, bm25_candidates, bm25_notes = v4.bm25_search(plan.repo, plan.scope, plan.query, max(max_results * 12, embed_pool))
        command_results.append(bm25_result)
        notes.extend(bm25_notes)
        if bm25_result.code == 0:
            embedding_candidates = run_embedding_rank_if_safe(plan, bm25_candidates, enable_embedding, embed_pool, max_results, notes, command_results)

    commands = v4.srcwalk_commands_for_v4(plan, bm25_candidates)
    add_fusion = True
    if bm25_candidates:
        strong_cluster, strong_reason = v7.bm25_has_strong_cluster(plan, bm25_candidates)
        if strong_cluster:
            notes.append(f"Extra fusion skipped: {strong_reason}; preserves strong BM25 cluster.")
            add_fusion = False
    if add_fusion:
        commands.extend(v7.extra_fusion_commands(plan, bm25_candidates))
    if not commands:
        commands = plan.commands

    for command in commands[:command_budget]:
        result = v3.run_command(plan.repo, command)
        command_results.append(result)
        if result.code != 0:
            notes.append(f"{command.label} failed with code {result.code}")
            continue
        parsed = v3.parse_candidates(result)
        structural_candidates.extend(parsed)
        if command.parse_as == "discover" and "--as file" in command.display():
            structural_candidates.extend(v7.parse_file_discover_candidates(result))
        if command.label == "target-context":
            target = v3.extract_target(command.display())
            if target:
                structural_candidates.append(v3.Candidate(target, "exact-context", command.label, "context-target", v3.parse_symbol_from_context(result.output), 120, ["exact target context"]))
        if command.parse_as == "context" and not parsed:
            target = v3.extract_target(command.display())
            if target:
                structural_candidates.append(v3.Candidate(target, "exact-context", command.label, "context-target", v3.parse_symbol_from_context(result.output), 80, ["exact target context"]))
        if command.parse_as == "show" and not parsed and not v3.is_empty_result(result):
            arg = command.args[2] if len(command.args) > 2 else "file"
            structural_candidates.append(v3.Candidate(arg if ":" in arg else f"{arg}:1", "file-show", command.label, "file", None, 65, ["exact file show"]))
        if command.parse_as == "deps" and not parsed and not v3.is_empty_result(result):
            arg = command.args[2] if len(command.args) > 2 else "file"
            structural_candidates.append(v3.Candidate(arg if ":" in arg else f"{arg}:1", "file-deps", command.label, "file", None, 70, ["exact file deps"]))

    rank_lists: list[tuple[str, list[v3.Candidate], float]] = []
    if bm25_candidates:
        rank_lists.append(("bm25-prf", dedupe_ranked(v7.score_candidates_v7([clone_candidate(c) for c in bm25_candidates], plan)), 1.0))
    if structural_candidates:
        rank_lists.append(("srcwalk", dedupe_ranked(v7.score_candidates_v7([clone_candidate(c) for c in structural_candidates], plan)), 1.25))
    if embedding_candidates:
        rank_lists.append(("embedding", dedupe_ranked(embedding_candidates), 0.85))

    if len(rank_lists) >= 2:
        ranked = rrf_fuse(rank_lists, plan)
        notes.append("v8 RRF fused ranks: " + ", ".join(f"{label}({len(cands)})" for label, cands, _ in rank_lists))
    else:
        all_candidates = bm25_candidates + structural_candidates + embedding_candidates
        ranked = v7.score_candidates_v7(all_candidates, plan)

    seen: set[str] = set()
    top: list[v3.Candidate] = []
    for cand in ranked:
        if cand.target not in seen:
            seen.add(cand.target)
            top.append(cand)
        if len(top) >= max_results:
            break

    confidence = confidence_report_v8(plan, top)
    if confidence.abstained:
        notes.append(f"Abstained: {confidence.reason}.")
        base = v3.SearchResult(plan, command_results, [], [], notes)
        return v7.SearchResultV7(base, confidence)

    expansions: list[v3.CommandResult] = []
    did_deps = False
    if top:
        context_limit = 1 if detail == "brief" or plan.intent in {"callers", "callees", "deps", "impact"} else max_results
        for cand in top[:context_limit]:
            if cand.source == "file-deps" or cand.command_label == "file-deps":
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
    return v7.SearchResultV7(base, confidence)


def evaluate(result: v7.SearchResultV7, case: v7.QualityCase) -> v7.QualityEval:
    return v7.evaluate(result, case)


def format_result(result: v7.SearchResultV7, verbose: bool = False) -> str:
    text = v7.format_result(result, verbose).replace("# semantic-search lab v7:", "# semantic-search lab v8:", 1)
    return text


def run_quality_lab(selected_repo: Optional[str] = None, limit: Optional[int] = None, verbose: bool = False, enable_embedding: bool = False, embed_pool: int = v6.DEFAULT_EMBED_POOL, include_ghidra: bool = False) -> str:
    cases = QUALITY_CASES if include_ghidra else v7.QUALITY_CASES
    cases = [c for c in cases if selected_repo is None or c.name == selected_repo]
    if limit:
        cases = cases[:limit]
    started = time.perf_counter()
    hit1 = hit3 = abstain_ok = 0
    mrr_sum = 0.0
    retrieval_cases = 0
    chunks: list[str] = ["# Query Router Lab Test v8 - RRF Fusion Quality Benchmark", "", f"Total cases: {len(cases)}", ""]

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
    parser = argparse.ArgumentParser(description="Lab v8 RRF fusion quality benchmark for semantic-srcwalk")
    parser.add_argument("query", nargs="?", help="Run one query instead of full benchmark")
    parser.add_argument("--repo", default=".", help="Repository root for one-query mode")
    parser.add_argument("--scope", default=".", help="srcwalk/BM25 scope")
    parser.add_argument("--max-results", type=int, default=3)
    parser.add_argument("--detail", choices=["brief", "normal", "deep"], default="normal")
    parser.add_argument("--lab", action="store_true", help="Run quality benchmark")
    parser.add_argument("--only-repo", choices=["bifrost", "uno", "srcwalk", "ghidra"], help="Filter benchmark cases")
    parser.add_argument("--include-ghidra", action="store_true", help="Include Ghidra cases in full lab")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--embedding", action="store_true", help="Enable guarded potion-code-16M rank source")
    parser.add_argument("--embed-pool", type=int, default=v6.DEFAULT_EMBED_POOL)
    args = parser.parse_args()

    if args.lab:
        print(run_quality_lab(args.only_repo, args.limit, args.verbose, args.embedding, args.embed_pool, args.include_ghidra or args.only_repo == "ghidra"))
        return
    if not args.query:
        parser.error("query required unless --lab is used")
    result = execute_search(args.query, args.repo, args.scope, args.max_results, args.detail, enable_embedding=args.embedding, embed_pool=args.embed_pool)
    print(format_result(result, verbose=args.verbose))


if __name__ == "__main__":
    main()
