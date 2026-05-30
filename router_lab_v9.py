#!/usr/bin/env python3
"""
Query Router Lab Test v9

Production-cache shape prototype for semantic-srcwalk:
- keeps v8: srcwalk router + BM25/PRF + RRF + confidence/abstain + evidence expansion
- replaces process-only BM25 cache with persistent /tmp SQLite + FTS5 cache
- adds optional full potion-code-16M vector cache under /tmp for embedding rank source
- never writes cache under the user home directory in this lab version
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

import router_lab_v3 as v3
import router_lab_v4 as v4
import router_lab_v6 as v6
import router_lab_v7 as v7
import router_lab_v8 as v8

CACHE_VERSION = "v9-cache-sqlite-fts5-2026-05-30"
CACHE_ROOT = Path("/tmp") / "pi-srcwalk-v9-cache"
FTS_FIRST_PASS_K = v4.FIRST_PASS_K
FTS_PRF_DOCS = v4.PRF_DOCS
FTS_PRF_TERMS = v4.PRF_TERMS
EMBED_VECTOR_FILE = "embeddings.potion-code-16m.float16.npy"
EMBED_MANIFEST_FILE = "embedding_manifest.json"


@dataclass
class CacheStats:
    cache_dir: Path
    db_path: Path
    cache_hit: bool
    chunks: int
    files: int
    fingerprint: str
    build_ms: int
    query_ms: int = 0
    size_bytes: int = 0


def cache_key(repo: Path, scope: str) -> str:
    raw = f"{repo.resolve()}\n{scope}\n{CACHE_VERSION}"
    return hashlib.sha256(raw.encode()).hexdigest()[:20]


def cache_dir_for(repo: Path, scope: str) -> Path:
    return CACHE_ROOT / cache_key(repo, scope)


def fingerprint_files(repo: Path, scope: str) -> tuple[str, list[Path]]:
    files = v4.iter_files(repo, scope)
    h = hashlib.sha256()
    for path in files:
        try:
            rel = str(path.relative_to(repo))
            stat = path.stat()
        except OSError:
            continue
        h.update(rel.encode())
        h.update(b"\0")
        h.update(str(stat.st_size).encode())
        h.update(b"\0")
        h.update(str(stat.st_mtime_ns).encode())
        h.update(b"\n")
    return h.hexdigest(), files


def dir_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return total
    for file in path.rglob("*"):
        if file.is_file():
            try:
                total += file.stat().st_size
            except OSError:
                pass
    return total


def read_manifest(cache_dir: Path) -> dict | None:
    path = cache_dir / "manifest.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def write_manifest(cache_dir: Path, manifest: dict) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True))


def open_db(db_path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    return con


def fts_query(tokens: list[str]) -> str:
    # Tokens come from v4.tokenize, so they are already simple identifiers.
    uniq = []
    seen = set()
    for token in tokens:
        if token and token not in seen:
            seen.add(token)
            uniq.append(token)
    return " OR ".join(uniq)


def build_or_load_cache(repo: Path, scope: str) -> CacheStats:
    started = time.perf_counter()
    repo = repo.resolve()
    cache_dir = cache_dir_for(repo, scope)
    db_path = cache_dir / "chunks.sqlite"
    fingerprint, files = fingerprint_files(repo, scope)
    manifest = read_manifest(cache_dir)
    if manifest and db_path.exists() and manifest.get("fingerprint") == fingerprint:
        return CacheStats(
            cache_dir=cache_dir,
            db_path=db_path,
            cache_hit=True,
            chunks=int(manifest.get("chunks", 0)),
            files=int(manifest.get("files", len(files))),
            fingerprint=fingerprint,
            build_ms=int((time.perf_counter() - started) * 1000),
            size_bytes=dir_size(cache_dir),
        )

    cache_dir.mkdir(parents=True, exist_ok=True)
    tmp_db = cache_dir / "chunks.sqlite.tmp"
    if tmp_db.exists():
        tmp_db.unlink()
    con = open_db(tmp_db)
    try:
        con.execute("PRAGMA journal_mode=OFF")
        con.execute("PRAGMA synchronous=OFF")
        con.execute("CREATE TABLE chunks(id INTEGER PRIMARY KEY, path TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, text TEXT NOT NULL)")
        con.execute("CREATE VIRTUAL TABLE chunks_fts USING fts5(path, text, content='chunks', content_rowid='id')")
        chunk_id = 0
        for path in files:
            try:
                rel = str(path.relative_to(repo))
                text = path.read_text(errors="ignore")
            except Exception:
                continue
            lines = text.splitlines()
            if not lines:
                continue
            step = max(1, v4.CHUNK_LINES - v4.CHUNK_OVERLAP)
            for start_line in range(0, len(lines), step):
                block = lines[start_line:start_line + v4.CHUNK_LINES]
                if not block:
                    continue
                chunk_text = "\n".join(block)
                toks = v4.tokenize(rel.replace("/", " ")) + v4.tokenize(chunk_text)
                if len(toks) < 3:
                    continue
                chunk_id += 1
                start = start_line + 1
                end = start_line + len(block)
                con.execute("INSERT INTO chunks(id, path, start, end, text) VALUES (?, ?, ?, ?, ?)", (chunk_id, rel, start, end, chunk_text))
                con.execute("INSERT INTO chunks_fts(rowid, path, text) VALUES (?, ?, ?)", (chunk_id, rel, chunk_text))
        con.commit()
        con.execute("INSERT INTO chunks_fts(chunks_fts) VALUES ('optimize')")
        con.commit()
    finally:
        con.close()

    os.replace(tmp_db, db_path)
    manifest = {
        "cache_version": CACHE_VERSION,
        "repo": str(repo),
        "scope": scope,
        "fingerprint": fingerprint,
        "files": len(files),
        "chunks": chunk_id,
        "created_at": int(time.time()),
        "format": "sqlite+fts5 external-content chunks",
        "cache_root": str(CACHE_ROOT),
    }
    write_manifest(cache_dir, manifest)
    return CacheStats(
        cache_dir=cache_dir,
        db_path=db_path,
        cache_hit=False,
        chunks=chunk_id,
        files=len(files),
        fingerprint=fingerprint,
        build_ms=int((time.perf_counter() - started) * 1000),
        size_bytes=dir_size(cache_dir),
    )


def fetch_chunks(con: sqlite3.Connection, ids: list[int]) -> list[sqlite3.Row]:
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    rows = con.execute(f"SELECT id, path, start, end, text FROM chunks WHERE id IN ({placeholders})", ids).fetchall()
    by_id = {int(row["id"]): row for row in rows}
    return [by_id[i] for i in ids if i in by_id]


def fts_search(con: sqlite3.Connection, tokens: list[str], limit: int) -> list[tuple[sqlite3.Row, float]]:
    query = fts_query(tokens)
    if not query:
        return []
    try:
        rows = con.execute(
            "SELECT rowid AS id, bm25(chunks_fts) AS rank FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY rank LIMIT ?",
            (query, limit),
        ).fetchall()
    except sqlite3.OperationalError:
        return []
    ids = [int(row["id"]) for row in rows]
    chunks = fetch_chunks(con, ids)
    rank_by_id = {int(row["id"]): float(row["rank"]) for row in rows}
    return [(chunk, rank_by_id[int(chunk["id"])]) for chunk in chunks]


def feedback_terms_from_rows(rows: list[tuple[sqlite3.Row, float]], query_tokens: list[str]) -> list[str]:
    query_set = set(query_tokens)
    weights: Counter[str] = Counter()
    for row, _rank in rows[:FTS_PRF_DOCS]:
        tokens = v4.tokenize(row["path"].replace("/", " ")) + v4.tokenize(row["text"])
        for term in tokens:
            if term in query_set or term in v3.STOP_WORDS or term in v3.WEAK_KEYWORDS or len(term) <= 2:
                continue
            weights[term] += 1
    return [term for term, _ in weights.most_common(FTS_PRF_TERMS)]


def bm25_search_cached(repo: Path, scope: str, query: str, max_results: int) -> tuple[v3.CommandResult, list[v3.Candidate], list[str]]:
    started = time.perf_counter()
    stats = build_or_load_cache(repo, scope)
    query_tokens = v4.tokenize(query)
    con = open_db(stats.db_path)
    try:
        first = fts_search(con, query_tokens, FTS_FIRST_PASS_K)
        derived = feedback_terms_from_rows(first, query_tokens)
        final = fts_search(con, query_tokens + derived, max_results)
    finally:
        con.close()
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    stats.query_ms = elapsed_ms

    lines = [
        f"SQLite FTS BM25/PRF retrieval scope={scope}",
        f"cache_dir={stats.cache_dir}",
        f"cache_hit={stats.cache_hit} chunks={stats.chunks} files={stats.files} cache_size_mb={stats.size_bytes / (1024 * 1024):.2f}",
        f"cache_prepare_ms={stats.build_ms} query_ms={elapsed_ms}",
        f"query_tokens={query_tokens}",
        f"derived_terms={derived}",
    ]
    candidates: list[v3.Candidate] = []
    for rank, (row, fts_rank) in enumerate(final, 1):
        path = row["path"]
        start = int(row["start"])
        end = int(row["end"])
        target = f"{path}:{start}-{end}"
        # SQLite bm25 is an ordering signal where lower is better; keep stable rank-based score.
        # Then add a generic path-token boost. This is important for test/topic queries:
        # a helper file can mention the terms in content, while the actual target often carries
        # the domain terms in its path/name (for example InitializeComponentAnalyzerTests.cs).
        lower_path = path.lower()
        basename = Path(path).name.lower()
        unique_query_tokens = list(dict.fromkeys(query_tokens))
        path_hits = sum(1 for tok in unique_query_tokens if tok in lower_path)
        basename_hits = sum(1 for tok in unique_query_tokens if tok in basename)
        scaled = 95.0 - rank * 4.0 + path_hits * 12.0 + basename_hits * 8.0
        source = "sqlite-fts-prf" if derived else "sqlite-fts"
        evidence = [f"sqlite-fts rank={rank} bm25={fts_rank:.5f} path_hits={path_hits} basename_hits={basename_hits} terms={','.join((query_tokens + derived)[:12])}"]
        candidates.append(v3.Candidate(target, source, "bm25-prf", "chunk", None, scaled, evidence))
        preview = " ".join(row["text"].strip().split())[:180]
        lines.append(f"{rank}. {target} bm25={fts_rank:.5f} preview={preview}")

    cmd = v3.SrcwalkCommand("sqlite-fts-prf", ["sqlite-fts", "search", query, "--scope", scope], "SQLite FTS5 BM25 + repo-derived expansion", "bm25")
    result = v3.CommandResult(cmd, "\n".join(lines), 0 if final else 2, elapsed_ms)
    notes = [
        f"v9 cache {'hit' if stats.cache_hit else 'built'} for scope `{scope}`: {stats.chunks} chunks, {stats.size_bytes / (1024 * 1024):.2f}MB under {stats.cache_dir}, prepare {stats.build_ms}ms, query {elapsed_ms}ms."
    ]
    if not final:
        notes.append("SQLite FTS BM25/PRF produced no candidates; falling back to srcwalk strategies.")
    return result, candidates, notes


def build_v4_compatible_index(repo: Path, scope: str) -> v4.BM25Index:
    """Compatibility shim for v6.chunk_text_for_candidate.

    It loads chunk metadata/text from the v9 SQLite cache instead of rebuilding all files.
    Scoring is not expected to use this object in v9; bm25_search_cached uses SQLite FTS.
    """
    stats = build_or_load_cache(repo, scope)
    con = open_db(stats.db_path)
    try:
        rows = con.execute("SELECT path, start, end, text FROM chunks ORDER BY id").fetchall()
    finally:
        con.close()
    chunks = []
    for row in rows:
        tokens = v4.tokenize(row["path"].replace("/", " ")) + v4.tokenize(row["text"])
        chunks.append(v4.Chunk(row["path"], int(row["start"]), int(row["end"]), row["text"], tokens))
    return v4.BM25Index(chunks, {}, [], {}, 0.0, stats.build_ms)


def embedding_cache_paths(plan: v3.QueryPlan) -> tuple[Path, Path]:
    cdir = cache_dir_for(plan.repo, plan.scope)
    return cdir / EMBED_VECTOR_FILE, cdir / EMBED_MANIFEST_FILE


def build_or_load_embedding_vectors(plan: v3.QueryPlan, notes: list[str]) -> tuple[np.ndarray, list[v4.Chunk]]:
    """Optional full vector cache, only used when --embedding is enabled.

    The vectors are float16 normalized rows in /tmp. Query time only encodes the query.
    """
    index = build_v4_compatible_index(plan.repo, plan.scope)
    vector_path, manifest_path = embedding_cache_paths(plan)
    cache_dir = vector_path.parent
    chunk_count = len(index.chunks)
    manifest = None
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text())
        except Exception:
            manifest = None
    if vector_path.exists() and manifest and manifest.get("chunks") == chunk_count and manifest.get("model") == v6.MODEL_NAME:
        vectors = np.load(vector_path, mmap_mode="r")
        notes.append(f"v9 embedding cache hit: {chunk_count} vectors, {vector_path.stat().st_size / (1024 * 1024):.2f}MB under {vector_path}.")
        return vectors, index.chunks

    model, warm, load_ms = v6.load_model()
    texts = [f"{chunk.path}\n{chunk.text}" for chunk in index.chunks]
    start = time.perf_counter()
    rows: list[np.ndarray] = []
    batch = 256
    for i in range(0, len(texts), batch):
        encoded = v6.normalize_rows(model.encode(texts[i:i + batch])).astype(np.float16)
        rows.append(encoded)
    vectors = np.vstack(rows) if rows else np.zeros((0, 256), dtype=np.float16)
    cache_dir.mkdir(parents=True, exist_ok=True)
    np.save(vector_path, vectors)
    manifest_path.write_text(json.dumps({
        "model": v6.MODEL_NAME,
        "chunks": chunk_count,
        "dtype": "float16",
        "created_at": int(time.time()),
        "model_warm": warm,
        "model_load_ms": load_ms,
        "build_ms": int((time.perf_counter() - start) * 1000),
    }, indent=2, sort_keys=True))
    notes.append(f"v9 embedding cache built: {chunk_count} vectors, {vector_path.stat().st_size / (1024 * 1024):.2f}MB under {vector_path}.")
    return vectors, index.chunks


def run_embedding_rank_cached(
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
        started = time.perf_counter()
        vectors, chunks = build_or_load_embedding_vectors(plan, notes)
        model, warm, load_ms = v6.load_model()
        q_start = time.perf_counter()
        query_vec = v6.normalize_rows(model.encode([plan.query]))[0].astype(np.float32)
        query_ms = int((time.perf_counter() - q_start) * 1000)
        sims = np.asarray(vectors, dtype=np.float32) @ query_vec
        top_n = min(max(max_results * 4, embed_pool, 10), len(chunks))
        if top_n == 0:
            return []
        order = np.argpartition(-sims, top_n - 1)[:top_n]
        order = order[np.argsort(-sims[order])]
        reranked: list[v3.Candidate] = []
        for rank, idx in enumerate(order, 1):
            chunk = chunks[int(idx)]
            sim = float(sims[int(idx)])
            cand = v3.Candidate(chunk.target, "embedding-index", "embedding-index", "chunk", None, 92.0 - rank * 1.5 + sim * 10.0, [f"potion-code-16M vector rank={rank} cosine={sim:.4f}"])
            reranked.append(cand)
        elapsed = int((time.perf_counter() - started) * 1000)
        cmd = v3.SrcwalkCommand("embedding-index", ["potion-code-16M", "vector-search", plan.query, "--scope", plan.scope], "potion-code-16M full vector cache search", "embedding")
        lines = [
            f"Embedding vector cache model={v6.MODEL_NAME}",
            f"model_warm={warm} model_load_ms={load_ms} query_encode_ms={query_ms} total_ms={elapsed}",
            f"vectors={len(chunks)} top_n={top_n}",
        ]
        for i, cand in enumerate(reranked[:max_results * 4], 1):
            lines.append(f"{i}. {cand.target} score={cand.score:.3f} evidence={cand.evidence[-1]}")
        command_results.append(v3.CommandResult(cmd, "\n".join(lines), 0 if reranked else 2, elapsed))
        notes.append(f"potion-code-16M full embedding cache produced optional RRF rank; query_encode={query_ms}ms total={elapsed}ms.")
        return reranked
    except Exception as exc:
        notes.append(f"Embedding index rank failed ({type(exc).__name__}: {str(exc)[:180]}). Falling back to BM25/srcwalk ranks.")
        return []


# Patch imported lab modules so v8's RRF/evidence flow uses the v9 cache layer.
v4.bm25_search = bm25_search_cached  # type: ignore[assignment]
v4.build_bm25_index = build_v4_compatible_index  # type: ignore[assignment]
v8.run_embedding_rank_if_safe = run_embedding_rank_cached  # type: ignore[assignment]


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
    return v8.execute_search(query, repo, scope, max_results, detail, command_budget, enable_embedding, embed_pool)


def format_result(result: v7.SearchResultV7, verbose: bool = False) -> str:
    return v8.format_result(result, verbose).replace("# semantic-search lab v8:", "# semantic-search lab v9:", 1)


def run_quality_lab(selected_repo: Optional[str] = None, limit: Optional[int] = None, verbose: bool = False, enable_embedding: bool = False, embed_pool: int = v6.DEFAULT_EMBED_POOL, include_ghidra: bool = False) -> str:
    cases = v8.QUALITY_CASES if include_ghidra else v7.QUALITY_CASES
    cases = [c for c in cases if selected_repo is None or c.name == selected_repo]
    if limit:
        cases = cases[:limit]
    started = time.perf_counter()
    hit1 = hit3 = abstain_ok = 0
    mrr_sum = 0.0
    retrieval_cases = 0
    chunks: list[str] = ["# Query Router Lab Test v9 - Persistent /tmp Cache + RRF Quality Benchmark", "", f"Cache root: `{CACHE_ROOT}`", f"Total cases: {len(cases)}", ""]

    for idx, case in enumerate(cases, 1):
        result = execute_search(case.query, case.repo, case.scope, max_results=3, detail="normal", enable_embedding=enable_embedding, embed_pool=embed_pool)
        quality = v8.evaluate(result, case)
        result.quality = quality
        if not case.should_abstain:
            retrieval_cases += 1
            hit1 += int(quality.hit1)
            hit3 += int(quality.hit3)
            mrr_sum += quality.mrr
        abstain_ok += int(quality.abstain_ok)
        verdict = "PASS" if (quality.abstain_ok if case.should_abstain else quality.hit3 and quality.abstain_ok) else "FAIL"
        chunks.append(f"\n---\n\n## Case {idx}: {case.name} — {verdict}")
        if case.note:
            chunks.append(f"note: {case.note}\n")
        chunks.append(format_result(result, verbose=verbose))

    elapsed = int((time.perf_counter() - started) * 1000)
    n = len(cases) or 1
    r = retrieval_cases or 1
    summary = f"Summary: Hit@1={hit1}/{retrieval_cases}, Hit@3={hit3}/{retrieval_cases}, MRR={mrr_sum/r:.3f}, AbstainOK={abstain_ok}/{n}, elapsed={elapsed}ms"
    chunks.insert(4, summary)
    return "\n".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Lab v9 persistent /tmp cache benchmark for semantic-srcwalk")
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
    parser.add_argument("--embedding", action="store_true", help="Enable optional full potion-code-16M vector cache rank source")
    parser.add_argument("--embed-pool", type=int, default=v6.DEFAULT_EMBED_POOL)
    parser.add_argument("--cache-root", action="store_true", help="Print cache root and exit")
    args = parser.parse_args()

    if args.cache_root:
        print(CACHE_ROOT)
        return
    if args.lab:
        print(run_quality_lab(args.only_repo, args.limit, args.verbose, args.embedding, args.embed_pool, args.include_ghidra or args.only_repo == "ghidra"))
        return
    if not args.query:
        parser.error("query required unless --lab is used")
    result = execute_search(args.query, args.repo, args.scope, args.max_results, args.detail, enable_embedding=args.embedding, embed_pool=args.embed_pool)
    print(format_result(result, verbose=args.verbose))


if __name__ == "__main__":
    main()
