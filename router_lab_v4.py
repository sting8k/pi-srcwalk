#!/usr/bin/env python3
"""
Query Router Lab Test v4

Adds a minimal no-embedding retrieval layer on top of v3:
- code-aware tokenizer: camelCase/snake_case/path splitting
- light generic morphology/stemming, no domain synonym arrays
- pure-Python BM25 index built from the repo/scope
- pseudo relevance feedback (PRF): first-pass BM25 -> repo-derived terms -> second-pass BM25
- srcwalk remains the evidence engine for context/trace/deps/show/overview
"""

from __future__ import annotations

import argparse
import math
import os
import re
import time
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import router_lab_v3 as v3


SKIP_DIRS = {
    ".git", ".hg", ".svn", ".idea", ".vscode", ".vs",
    "node_modules", "target", "bin", "obj", "build", "dist", "out",
    ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache",
    ".gradle", ".next", ".nuxt", "coverage", "vendor",
}

CODE_EXTS = {
    ".rs", ".go", ".cs", ".ts", ".tsx", ".js", ".jsx", ".py",
    ".java", ".kt", ".swift", ".cpp", ".cc", ".c", ".h", ".hpp",
    ".rb", ".php", ".scala", ".css", ".scss", ".less", ".html",
    ".md", ".mdx", ".rst", ".toml", ".yaml", ".yml", ".json",
}

SKIP_FILENAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "Cargo.lock",
    "composer.lock", "poetry.lock", "Pipfile.lock",
}

MAX_FILE_BYTES = 512_000
CHUNK_LINES = 80
CHUNK_OVERLAP = 10
FIRST_PASS_K = 12
PRF_DOCS = 5
PRF_TERMS = 5

TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|[0-9]+")
CAMEL_BOUNDARY_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


@dataclass
class Chunk:
    path: str
    start: int
    end: int
    text: str
    tokens: list[str]

    @property
    def target(self) -> str:
        return f"{self.path}:{self.start}-{self.end}"


@dataclass
class BM25Index:
    chunks: list[Chunk]
    doc_freq: dict[str, int]
    doc_lens: list[int]
    postings: dict[str, list[tuple[int, int]]]
    avgdl: float
    built_ms: int

    def idf(self, term: str) -> float:
        n = len(self.chunks)
        df = self.doc_freq.get(term, 0)
        return math.log(1.0 + (n - df + 0.5) / (df + 0.5))

    def score(self, query_tokens: list[str], top_k: int = 10) -> list[tuple[int, float]]:
        if not self.chunks or not query_tokens:
            return []
        q = Counter(query_tokens)
        scores: dict[int, float] = defaultdict(float)
        k1 = 1.5
        b = 0.75

        # Use a real inverted index instead of scanning every chunk per query.
        for term, q_weight in q.items():
            posting = self.postings.get(term)
            if not posting:
                continue
            idf = self.idf(term)
            for idx, f in posting:
                dl = self.doc_lens[idx] or 1
                denom = f + k1 * (1 - b + b * dl / (self.avgdl or 1.0))
                scores[idx] += q_weight * idf * (f * (k1 + 1)) / denom

        return sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]


_INDEX_CACHE: dict[tuple[str, str], BM25Index] = {}


def split_identifier(token: str) -> list[str]:
    parts: list[str] = []
    for piece in re.split(r"[_\-./\\]+", token):
        if not piece:
            continue
        parts.extend(p for p in CAMEL_BOUNDARY_RE.split(piece) if p)
    return parts


def stem_light(token: str) -> str:
    # Generic morphology only; intentionally no domain-specific synonym table.
    t = token.lower()
    for suffix, replacement, min_len in [
        ("ization", "ize", 9),
        ("isation", "ize", 9),
        ("ication", "y", 9),
        ("ing", "", 6),
        ("ed", "", 5),
        ("ies", "y", 5),
        ("es", "", 5),
        ("s", "", 5),
    ]:
        if len(t) >= min_len and t.endswith(suffix):
            return t[: -len(suffix)] + replacement
    return t


def tokenize(text: str) -> list[str]:
    out: list[str] = []
    for raw in TOKEN_RE.findall(text):
        for part in split_identifier(raw):
            low = part.lower()
            if len(low) <= 2 or low in v3.STOP_WORDS or low in v3.WEAK_KEYWORDS:
                continue
            out.append(low)
            stem = stem_light(low)
            if stem != low and len(stem) > 2:
                out.append(stem)
    return out


def iter_files(repo: Path, scope: str) -> list[Path]:
    root = (repo / scope).resolve() if scope != "." else repo.resolve()
    if root.is_file():
        return [root]
    files: list[Path] = []
    if not root.exists():
        return files
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            path = Path(dirpath) / name
            if name in SKIP_FILENAMES:
                continue
            if path.suffix not in CODE_EXTS:
                continue
            try:
                if path.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            files.append(path)
    return files


def build_bm25_index(repo: Path, scope: str) -> BM25Index:
    key = (str(repo.resolve()), scope)
    cached = _INDEX_CACHE.get(key)
    if cached:
        return cached

    start = time.perf_counter()
    chunks: list[Chunk] = []
    for path in iter_files(repo, scope):
        try:
            rel = str(path.relative_to(repo))
            text = path.read_text(errors="ignore")
        except Exception:
            continue
        lines = text.splitlines()
        if not lines:
            continue
        path_tokens = tokenize(rel.replace("/", " "))
        step = max(1, CHUNK_LINES - CHUNK_OVERLAP)
        for start_line in range(0, len(lines), step):
            block = lines[start_line : start_line + CHUNK_LINES]
            if not block:
                continue
            chunk_text = "\n".join(block)
            toks = path_tokens + tokenize(chunk_text)
            if len(toks) < 3:
                continue
            chunks.append(Chunk(rel, start_line + 1, start_line + len(block), chunk_text, toks))

    df: dict[str, int] = defaultdict(int)
    doc_lens: list[int] = []
    postings_acc: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for idx, chunk in enumerate(chunks):
        doc_lens.append(len(chunk.tokens))
        counts = Counter(chunk.tokens)
        for term, freq in counts.items():
            df[term] += 1
            postings_acc[term].append((idx, freq))
    avgdl = sum(doc_lens) / len(doc_lens) if doc_lens else 0.0
    built_ms = int((time.perf_counter() - start) * 1000)
    index = BM25Index(chunks, dict(df), doc_lens, dict(postings_acc), avgdl, built_ms)
    _INDEX_CACHE[key] = index
    return index


def feedback_terms(index: BM25Index, top: list[tuple[int, float]], query_tokens: list[str]) -> list[str]:
    query_set = set(query_tokens)
    weights: Counter[str] = Counter()
    for idx, _score in top[:PRF_DOCS]:
        chunk = index.chunks[idx]
        counts = Counter(chunk.tokens)
        for term, tf in counts.items():
            if term in query_set or term in v3.STOP_WORDS or term in v3.WEAK_KEYWORDS or len(term) <= 2:
                continue
            # Corpus-derived expansion: term salience in top docs weighted by IDF.
            weights[term] += tf * index.idf(term)
    return [term for term, _ in weights.most_common(PRF_TERMS)]


def bm25_search(repo: Path, scope: str, query: str, max_results: int) -> tuple[v3.CommandResult, list[v3.Candidate], list[str]]:
    start = time.perf_counter()
    index = build_bm25_index(repo, scope)
    query_tokens = tokenize(query)
    first = index.score(query_tokens, top_k=FIRST_PASS_K)
    derived = feedback_terms(index, first, query_tokens)
    second_tokens = query_tokens + derived
    final = index.score(second_tokens, top_k=max_results)
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    lines = [
        f"BM25/PRF retrieval scope={scope}",
        f"chunks={len(index.chunks)} index_built_ms={index.built_ms} query_ms={elapsed_ms}",
        f"query_tokens={query_tokens}",
        f"derived_terms={derived}",
    ]
    candidates: list[v3.Candidate] = []
    max_score = final[0][1] if final else 1.0
    for rank, (idx, score) in enumerate(final, 1):
        chunk = index.chunks[idx]
        scaled = 75.0 - rank * 2.0 + (score / max_score) * 10.0 if max_score else 50.0 - rank
        source = "bm25-prf" if derived else "bm25"
        evidence = [f"bm25 rank={rank} raw_score={score:.3f} terms={','.join(second_tokens[:12])}"]
        candidates.append(v3.Candidate(chunk.target, source, "bm25-prf", "chunk", None, scaled, evidence))
        preview = " ".join(chunk.text.strip().split())[:180]
        lines.append(f"{rank}. {chunk.target} score={score:.3f} preview={preview}")

    cmd = v3.SrcwalkCommand("bm25-prf", ["bm25", "search", query, "--scope", scope], "BM25 + repo-derived expansion", "bm25")
    result = v3.CommandResult(cmd, "\n".join(lines), 0 if final else 2, elapsed_ms)
    notes = []
    if not final:
        notes.append("BM25/PRF produced no candidates; falling back to srcwalk strategies.")
    elif index.built_ms:
        notes.append(f"BM25 index for scope `{scope}` has {len(index.chunks)} chunks; cold build {index.built_ms}ms, query {elapsed_ms}ms.")
    return result, candidates, notes


def should_run_bm25(plan: v3.QueryPlan) -> bool:
    if plan.query_kind in {"explicit_target", "file", "file_deps", "overview", "symbol"}:
        return False
    # Useful for natural language, definition/topic search, tests, related, and weak intent-symbol queries.
    return plan.intent in {"general", "definition", "test", "related"}


def srcwalk_commands_for_v4(plan: v3.QueryPlan, bm25_candidates: list[v3.Candidate]) -> list[v3.SrcwalkCommand]:
    if not bm25_candidates:
        return plan.commands
    # For broad natural language/test/definition queries, BM25 replaces the expensive broad text discover.
    # Keep overview fallback only if caller explicitly asked overview; exact/symbol/trace/deps are handled by v3 path.
    if plan.intent in {"general", "definition", "test", "related"}:
        return [c for c in plan.commands if c.label.startswith("symbol-") and c.label != "text-any"][:1]
    return plan.commands


def score_candidates_v4(candidates: list[v3.Candidate], plan: v3.QueryPlan) -> list[v3.Candidate]:
    scored = v3.score_candidates(candidates, plan)
    for cand in scored:
        if cand.source in {"bm25", "bm25-prf"}:
            cand.score += 15
            target_lower = cand.target.lower()
            if any(part in target_lower for part in ["test", "tests", "spec", "fixture"]):
                cand.score += 20 if plan.intent == "test" else -8
    return sorted(scored, key=lambda c: c.score, reverse=True)


def execute_search(query: str, repo: str, scope: str = ".", max_results: int = 3, detail: str = "normal", command_budget: int = 6) -> v3.SearchResult:
    plan = v3.build_plan(query, repo, scope, max_results, detail)
    command_results: list[v3.CommandResult] = []
    notes: list[str] = []
    candidates: list[v3.Candidate] = []
    bm25_candidates: list[v3.Candidate] = []

    if should_run_bm25(plan):
        bm25_result, bm25_candidates, bm25_notes = bm25_search(plan.repo, plan.scope, plan.query, max(max_results * 3, 8))
        command_results.append(bm25_result)
        notes.extend(bm25_notes)
        if bm25_result.code == 0:
            candidates.extend(bm25_candidates)

    for command in srcwalk_commands_for_v4(plan, bm25_candidates)[:command_budget]:
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

    ranked = score_candidates_v4(candidates, plan)
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
    return text.replace("# semantic-search lab v3:", "# semantic-search lab v4:", 1)


def run_complex_lab(selected_repo: Optional[str] = None, limit: Optional[int] = None, verbose: bool = False) -> str:
    chunks: list[str] = []
    tests = [t for t in v3.COMPLEX_TESTS if selected_repo is None or t[0] == selected_repo]
    if limit:
        tests = tests[:limit]
    started = time.perf_counter()
    passed = partial = failed = 0

    chunks.append("# Query Router Lab Test v4 - BM25/PRF Run")
    chunks.append("")
    chunks.append(f"Total cases: {len(tests)}")
    chunks.append("")

    for idx, (name, repo, scope, query) in enumerate(tests, 1):
        result = execute_search(query, repo, scope, max_results=3, detail="normal")
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
    parser = argparse.ArgumentParser(description="Lab v4 for semantic-srcwalk BM25/PRF router")
    parser.add_argument("query", nargs="?", help="Run one query instead of full lab")
    parser.add_argument("--repo", default=".", help="Repository root for one-query mode")
    parser.add_argument("--scope", default=".", help="srcwalk/BM25 scope")
    parser.add_argument("--max-results", type=int, default=3)
    parser.add_argument("--detail", choices=["brief", "normal", "deep"], default="normal")
    parser.add_argument("--lab", action="store_true", help="Run built-in complex lab")
    parser.add_argument("--only-repo", choices=["bifrost", "uno", "srcwalk"], help="Filter built-in lab")
    parser.add_argument("--limit", type=int, help="Limit built-in lab cases")
    parser.add_argument("--verbose", action="store_true", help="Longer evidence previews")
    args = parser.parse_args()

    if args.lab or not args.query:
        print(run_complex_lab(args.only_repo, args.limit, args.verbose))
        return

    result = execute_search(args.query, args.repo, args.scope, args.max_results, args.detail)
    print(format_result(result, verbose=args.verbose))


if __name__ == "__main__":
    main()
