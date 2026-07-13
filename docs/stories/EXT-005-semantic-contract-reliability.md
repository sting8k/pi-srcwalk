# EXT-005 Semantic contract reliability

## Status

implemented

## Lane

normal

## Product Contract

Keep the five semantic tools predictable at their public boundaries: an explicit `semantic_query` scope is immutable, CLI failure evidence remains visible, `semantic_show` handles bounded direct target lists exactly, and overview output can provide safe follow-up file candidates.

## Relevant Product Docs

- `README.md`
- `extensions/pi-srcwalk/index.ts`
- `src/router/intent.ts`
- `src/engine.ts`
- `src/srcwalk/parse.ts`
- `src/output/format.ts`

## Acceptance Criteria

- An explicitly supplied `semantic_query` scope is used unchanged, even when the query contains a slash path; path-based overview scope inference runs only when the caller omits scope.
- `semantic_inspect` includes the non-empty bounded CLI output alongside the failure code for both single-symbol and multi-symbol packets.
- A direct comma-separated `semantic_show` target list is bounded and validated, runs one `srcwalk show` command per target with its own 5000-token budget, and renders a section/status for every target. Successful outline/caveat output is reported as degraded/non-exact rather than `ok`.
- Successful overview output yields bounded candidates only for existing repo-relative files, retains line/range targets when present, and registers those candidates through the existing `semantic_query` handoff so `semantic_show` can follow them. Directory-only or candidate-less overview output remains graceful.
- Existing single-target show behavior and overview expansion behavior remain intact.
- Concurrent first tool calls after Pi reload wait on one shared, retryable runtime-module preload instead of starting independent dynamic-import roots.

## Design Notes

- Commands:
  - `semantic_query` passes `undefined` when scope is omitted; `buildPlan` owns the omitted-scope path inference.
  - `semantic_inspect` reuses one bounded command-result formatter for single and multi-symbol sections.
  - `semantic_show` keeps the stateful candidate path and single-target packet unchanged; direct multi-target input is split and executed per target.
- Queries:
  - Overview parsing belongs beside the existing `srcwalk` output parsers and feeds the existing candidate registry without a second handoff mechanism.
- API:
  - Direct show lists accept at most three `path:line`/`path:start-end` targets.
  - Overview candidates are repo-relative file targets and use `:1` when no line/range is present.
- Domain rules:
  - Explicit scope is immutable; omitted scope may infer from an overview path token.
  - CLI code and non-empty stderr/stdout are evidence, not discarded diagnostics.
  - A directory is never registered as a follow-up show candidate.
- UI surfaces:
  - Multi-target show reports `ok`, `degraded (non-exact output)`, or `code=N` per target.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Router scope regression, bounded inspect error formatter, show target split/exactness, overview file-candidate parsing |
| Integration | `npm run check:ts` |
| E2E | `npm test` plus focused semantic query/show/inspect smoke where the local `srcwalk` CLI permits |
| Platform | N/A |
| Release | N/A |

## Harness Delta

This story records the public-contract hardening for scope ownership, diagnostic preservation, exact follow-up reads, and overview-to-show candidate handoff. The existing registry and overview expansion remain the shared mechanisms.

## Evidence

- `npm test` ✅ — 32/32 tests pass, including four new contract regressions.
- `npm run check:ts` ✅.
- `git diff --check` ✅.
- Smoke: omitted overview scope inferred `src/router` and returned follow-up file candidates ✅.
- Smoke: explicit overview scope `src` remained `src` despite `extensions/pi-srcwalk` in query text ✅.
- Smoke: explicit test-intent scope `src` remained `src` after reviewer regression fix ✅.
- Reviewer: initial rework finding on test-intent scope override fixed; final validation rerun passed.
- Follow-up guard: shared runtime-module preload is single-flight for concurrent cold calls and resets after a failed preload; `npm test` now passes 33/33.
