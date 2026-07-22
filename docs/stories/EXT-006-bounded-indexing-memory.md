# EXT-006 Bound indexing memory without sacrificing semantic coverage

## Status

implemented

## Lane

normal

## Product Contract

Long-running Pi sessions must not be terminated by broad `semantic_query` or repeated `semantic_grep` indexing. Memory budgets limit acceleration and cache retention, not search coverage: `semantic_grep` must still verify every eligible file unless aborted or explicitly capped by a walk guard, and oversized `semantic_query` must fall back to bounded-memory full-coverage ranking instead of crashing.

## Relevant Product Docs

- `README.md`
- `src/index/files.ts`
- `src/index/cache.ts`
- `src/index/bm25.ts`
- `src/grep/semantic-grep.ts`
- `src/grep/semantic-grep-scopes.ts`
- `tests/semantic-grep.test.ts`
- `tests/semantic-grep-scopes.test.ts`

## Acceptance Criteria

- BM25 discovery enforces configurable aggregate file, byte, and walk-entry limits before reading/tokenizing large corpora.
- Oversized BM25 scopes return bounded-memory full-coverage streaming ranking when possible, with explicit notes about streaming mode and PRF tradeoff.
- A BM25 index larger than the configured retained-memory budget is usable for the current query but is not kept for later cache hits.
- `semantic_grep` cache eviction is bounded by both entry count and estimated retained bytes, with environment overrides.
- `semantic_grep` indexes only files within the acceleration budget but stream-verifies overflow files so exact/regex coverage is preserved when traversal completes.
- Output notes distinguish complete, capped, and aborted coverage; no partial result is silently presented as complete.
- Existing semantic result formats and normal small-repo behavior remain compatible.

## Design Notes

- Memory budget is an acceleration policy, not a semantic scope policy.
- `semantic_grep` keeps exact correctness by verifying matched indexed candidates and every overflow file against file contents.
- `semantic_query` keeps full scope coverage by using query-specific streaming BM25 for oversized scopes; PRF remains enabled only in normal indexed mode.
- Cache admission must happen before retaining entries; eviction after full build alone is insufficient.
- Node process RSS is telemetry, not a cache admission source.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | BM25 aggregate limits/admission, grep byte eviction/overflow search, notes for capped modes |
| Integration | `npm run check:ts`, `git diff --check` |
| E2E | `npm test`; child-process memory fixture exits 0 under bounded heap |
| Platform | Local macOS proof; Windows benchmark recommended before release claim |
| Release | N/A |

## Harness Delta

This story records the reliability invariant discovered from GitHub issues #12 and #13: indexing memory controls must protect both retained cache entries and in-flight build working sets while preserving semantic coverage.

## Evidence

- `npm run check:ts` ✅.
- `npm test` ✅ — 36/36 tests pass, including BM25 streaming fallback, grep overflow verification, and grep over-budget uncached regressions.
- `git diff --check` ✅.
- Smoke: `npm run smoke -- "bounded indexing memory" --scope src --max-results 3 --detail brief` ✅.
- Child-process heap proof: transpiled JS fixture with 3,000 files / 117 MB disk ran `bm25Search` under `node --max-old-space-size=64`; mode=`streaming`, candidates=5, no OOM ✅.
- `semantic_review({ target: "working-tree" })` ✅ evidence packet generated; no blocking issue surfaced.
- Reviewer-agent delegation attempted but failed due local runner `--tab` launch error; self-review plus semantic_review used instead.
