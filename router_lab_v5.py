#!/usr/bin/env python3
"""
Query Router Lab Test v5

Adds optional embedding reranking on top of v4:
- v4 BM25/PRF builds a candidate pool for broad natural-language/test/definition queries
- CodeRankEmbed reranks that BM25 pool only; it does not build a full vector index
- srcwalk remains the evidence engine for context/trace/deps/show/overview
- compute metrics are recorded: model load, encode, rerank wall time, RSS, CPU time
"""

from __future__ import annotations

import argparse
import os
import time
from dataclasses import dataclass
from typing import Optional

import numpy as np
import psutil

import router_lab_v3 as v3
import router_lab_v4 as v4

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

MODEL_NAME = "nomic-ai/CodeRankEmbed"
DEFAULT_EMBED_POOL = 16
_MODEL = None
_PROCESS = psutil.Process(os.getpid())


@dataclass
class EmbedMetrics:
    model_name: str
    model_warm: bool
    model_load_ms: int
    query_encode_ms: int
    candidate_encode_ms: int
    rerank_ms: int
    total_ms: int
    candidates_in: int
    candidates_out: int
    rss_before_mb: float
    rss_after_model_mb: float
    rss_after_rerank_mb: float
    cpu_user_delta_s: float
    cpu_system_delta_s: float

    def as_lines(self) -> list[str]:
        return [
            f"Embedding rerank model={self.model_name}",
            f"model_warm={self.model_warm} model_load_ms={self.model_load_ms}",
            f"query_encode_ms={self.query_encode_ms} candidate_encode_ms={self.candidate_encode_ms} rerank_ms={self.rerank_ms} total_ms={self.total_ms}",
            f"candidates_in={self.candidates_in} candidates_out={self.candidates_out}",
            f"rss_before_mb={self.rss_before_mb:.1f} rss_after_model_mb={self.rss_after_model_mb:.1f} rss_after_rerank_mb={self.rss_after_rerank_mb:.1f}",
            f"cpu_user_delta_s={self.cpu_user_delta_s:.3f} cpu_system_delta_s={self.cpu_system_delta_s:.3f}",
        ]


def rss_mb() -> float:
    return _PROCESS.memory_info().rss / (1024 * 1024)


def cpu_times() -> tuple[float, float]:
    t = _PROCESS.cpu_times()
    return t.user, t.system


def load_model() -> tuple[object, bool, int]:
    global _MODEL
    if _MODEL is not None:
        return _MODEL, True, 0
    start = time.perf_counter()
    from sentence_transformers import SentenceTransformer

    _MODEL = SentenceTransformer(MODEL_NAME, trust_remote_code=True, device="cpu")
    return _MODEL, False, int((time.perf_counter() - start) * 1000)


def should_run_embedding(plan: v3.QueryPlan, bm25_candidates: list[v3.Candidate], enable_embedding: bool) -> bool:
    if not enable_embedding:
        return False
    if len(bm25_candidates) < 2:
        return False
    if plan.query_kind in {"explicit_target", "file", "file_deps", "overview", "symbol"}:
        return False
    return plan.intent in {"general", "definition", "test", "related"}


def chunk_text_for_candidate(plan: v3.QueryPlan, candidate: v3.Candidate) -> str:
    index = v4.build_bm25_index(plan.repo, plan.scope)
    for chunk in index.chunks:
        if chunk.target == candidate.target:
            return f"{chunk.path}\n{chunk.text}"
    return candidate.target


def embedding_rerank(plan: v3.QueryPlan, candidates: list[v3.Candidate], pool_size: int, max_results: int) -> tuple[list[v3.Candidate], v3.CommandResult, EmbedMetrics]:
    started = time.perf_counter()
    cpu_user_before, cpu_sys_before = cpu_times()
    rss_before = rss_mb()

    model, warm, model_load_ms = load_model()
    rss_after_model = rss_mb()

    pool = candidates[:pool_size]
    texts = [chunk_text_for_candidate(plan, c) for c in pool]

    q_start = time.perf_counter()
    query_emb = model.encode([plan.query], normalize_embeddings=True, show_progress_bar=False)[0]
    query_encode_ms = int((time.perf_counter() - q_start) * 1000)

    c_start = time.perf_counter()
    cand_embs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    candidate_encode_ms = int((time.perf_counter() - c_start) * 1000)

    r_start = time.perf_counter()
    sims = np.dot(cand_embs, query_emb)
    order = np.argsort(-sims)
    reranked: list[v3.Candidate] = []
    for rank, idx in enumerate(order[:max_results], 1):
        cand = pool[int(idx)]
        sim = float(sims[int(idx)])
        cand.source = "embedding-rerank"
        cand.score = 95.0 - rank * 2.0 + sim * 10.0
        cand.evidence.append(f"CodeRankEmbed rerank={rank} cosine={sim:.4f}")
        reranked.append(cand)
    rerank_ms = int((time.perf_counter() - r_start) * 1000)

    total_ms = int((time.perf_counter() - started) * 1000)
    rss_after_rerank = rss_mb()
    cpu_user_after, cpu_sys_after = cpu_times()
    metrics = EmbedMetrics(
        model_name=MODEL_NAME,
        model_warm=warm,
        model_load_ms=model_load_ms,
        query_encode_ms=query_encode_ms,
        candidate_encode_ms=candidate_encode_ms,
        rerank_ms=rerank_ms,
        total_ms=total_ms,
        candidates_in=len(pool),
        candidates_out=len(reranked),
        rss_before_mb=rss_before,
        rss_after_model_mb=rss_after_model,
        rss_after_rerank_mb=rss_after_rerank,
        cpu_user_delta_s=cpu_user_after - cpu_user_before,
        cpu_system_delta_s=cpu_sys_after - cpu_sys_before,
    )

    lines = metrics.as_lines()
    for i, cand in enumerate(reranked, 1):
        lines.append(f"{i}. {cand.target} score={cand.score:.3f} evidence={cand.evidence[-1]}")

    cmd = v3.SrcwalkCommand(
        "embedding-rerank",
        ["CodeRankEmbed", "rerank", plan.query, "--pool", str(len(pool))],
        "CodeRankEmbed rerank over BM25/PRF pool",
        "embedding",
    )
    result = v3.CommandResult(cmd, "\n".join(lines), 0 if reranked else 2, total_ms)
    return reranked, result, metrics


def execute_search(
    query: str,
    repo: str,
    scope: str = ".",
    max_results: int = 3,
    detail: str = "normal",
    command_budget: int = 6,
    enable_embedding: bool = True,
    embed_pool: int = DEFAULT_EMBED_POOL,
) -> v3.SearchResult:
    plan = v3.build_plan(query, repo, scope, max_results, detail)
    command_results: list[v3.CommandResult] = []
    notes: list[str] = []
    candidates: list[v3.Candidate] = []
    bm25_candidates: list[v3.Candidate] = []

    if v4.should_run_bm25(plan):
        bm25_result, bm25_candidates, bm25_notes = v4.bm25_search(plan.repo, plan.scope, plan.query, max(max_results * 6, embed_pool))
        command_results.append(bm25_result)
        notes.extend(bm25_notes)
        if bm25_result.code == 0:
            if should_run_embedding(plan, bm25_candidates, enable_embedding):
                try:
                    reranked, embed_result, metrics = embedding_rerank(plan, bm25_candidates, embed_pool, max(max_results * 3, 8))
                    command_results.append(embed_result)
                    candidates.extend(reranked)
                    notes.append(
                        "CodeRankEmbed reranked BM25 pool; "
                        f"load={metrics.model_load_ms}ms warm={metrics.model_warm} "
                        f"encode={metrics.query_encode_ms + metrics.candidate_encode_ms}ms "
                        f"rss_after={metrics.rss_after_rerank_mb:.1f}MB."
                    )
                except Exception as exc:
                    notes.append(f"Embedding rerank failed ({type(exc).__name__}: {str(exc)[:180]}). Falling back to BM25 candidates.")
                    candidates.extend(bm25_candidates)
            else:
                candidates.extend(bm25_candidates)

    for command in v4.srcwalk_commands_for_v4(plan, bm25_candidates)[:command_budget]:
        result = v3.run_command(plan.repo, command)
        command_results.append(result)
        if result.code != 0:
            notes.append(f"{command.label} failed with code {result.code}")
            continue
        parsed = v3.parse_candidates(result)
        candidates.extend(parsed)
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

        strong_defs = [c for c in candidates if c.source in {"definition", "grouped-definition", "next-context"}]
        if command.label == "symbol-exact" and strong_defs and plan.intent in {"callers", "callees", "deps", "impact", "definition"}:
            break
        if plan.intent not in {"callers", "callees", "deps", "impact"}:
            if command.label in {"symbol-exact", "target-context", "file-show", "overview"} and strong_defs:
                break
            if len(candidates) >= max_results * 3:
                break

    ranked = v4.score_candidates_v4(candidates, plan)
    seen: set[str] = set()
    top: list[v3.Candidate] = []
    for cand in ranked:
        if cand.target not in seen:
            seen.add(cand.target)
            top.append(cand)
        if len(top) >= max_results:
            break

    if not top and command_results:
        notes.append("No parseable candidates. Returning best raw command output only.")

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

    return v3.SearchResult(plan, command_results, top, expansions, notes)


def format_result(result: v3.SearchResult, verbose: bool = False) -> str:
    text = v3.format_result(result, verbose)
    return text.replace("# semantic-search lab v3:", "# semantic-search lab v5:", 1)


def run_complex_lab(selected_repo: Optional[str] = None, limit: Optional[int] = None, verbose: bool = False, enable_embedding: bool = True, embed_pool: int = DEFAULT_EMBED_POOL) -> str:
    chunks: list[str] = []
    tests = [t for t in v3.COMPLEX_TESTS if selected_repo is None or t[0] == selected_repo]
    if limit:
        tests = tests[:limit]
    started = time.perf_counter()
    passed = 0
    partial = 0
    failed = 0

    chunks.append("# Query Router Lab Test v5 - CodeRankEmbed Rerank")
    chunks.append("")
    chunks.append(f"Total cases: {len(tests)}")
    chunks.append("")

    for idx, (name, repo, scope, query) in enumerate(tests, 1):
        result = execute_search(query, repo, scope, max_results=3, detail="normal", enable_embedding=enable_embedding, embed_pool=embed_pool)
        has_candidate = bool(result.candidates)
        has_expansion_ok = any(e.code == 0 and e.output.strip() for e in result.expansions)
        if has_candidate and has_expansion_ok:
            passed += 1
            verdict = "PASS"
        elif result.plan.intent == "overview" and has_expansion_ok:
            passed += 1
            verdict = "PASS"
        elif has_expansion_ok:
            partial += 1
            verdict = "PARTIAL"
        else:
            failed += 1
            verdict = "FAIL"
        chunks.append(f"\n---\n\n## Case {idx}: {name} — {verdict}")
        chunks.append(format_result(result, verbose=verbose))

    elapsed = int((time.perf_counter() - started) * 1000)
    chunks.insert(3, f"Summary: PASS={passed}, PARTIAL={partial}, FAIL={failed}, elapsed={elapsed}ms")
    return "\n".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Lab v5 for semantic-srcwalk CodeRankEmbed reranker")
    parser.add_argument("query", nargs="?", help="Run one query instead of full lab")
    parser.add_argument("--repo", default=".", help="Repository root for one-query mode")
    parser.add_argument("--scope", default=".", help="srcwalk/BM25 scope")
    parser.add_argument("--max-results", type=int, default=3)
    parser.add_argument("--detail", choices=["brief", "normal", "deep"], default="normal")
    parser.add_argument("--lab", action="store_true", help="Run built-in complex lab")
    parser.add_argument("--only-repo", choices=["bifrost", "uno", "srcwalk"], help="Filter built-in lab")
    parser.add_argument("--limit", type=int, help="Limit built-in lab cases")
    parser.add_argument("--verbose", action="store_true", help="Longer evidence previews")
    parser.add_argument("--no-embedding", action="store_true", help="Disable CodeRankEmbed reranker")
    parser.add_argument("--embed-pool", type=int, default=DEFAULT_EMBED_POOL, help="BM25 candidates to rerank with embeddings")
    args = parser.parse_args()

    if args.lab or not args.query:
        print(run_complex_lab(args.only_repo, args.limit, args.verbose, not args.no_embedding, args.embed_pool))
        return

    result = execute_search(args.query, args.repo, args.scope, args.max_results, args.detail, enable_embedding=not args.no_embedding, embed_pool=args.embed_pool)
    print(format_result(result, verbose=args.verbose))


if __name__ == "__main__":
    main()
