# EXT-003 Lazy cache build single-flight

## Status

implemented

## Lane

normal

## Product Contract

Keep `semantic_query` and `semantic_grep` lazy, but ensure concurrent first-hit cache preparation does not duplicate heavy repo work. Same-key builds must single-flight; different build kinds for the same repo should serialize through a repo queue.

## Relevant Product Docs

- `src/index/cache.ts`
- `src/grep/semantic-grep.ts`
- `src/index/files.ts`
- `src/cache/build-coordinator.ts`
- `extensions/pi-srcwalk/index.ts`

## Acceptance Criteria

- Concurrent `buildOrLoadIndex(repo, scope)` calls for the same key share one in-flight promise.
- Concurrent `buildOrLoadGrepIndex(repo, scope, glob)` calls for the same key share one in-flight promise.
- Different cache builds for the same repo do not run in parallel.
- No eager `session_start` warmup is introduced.
- The shared coordinator remains small and reusable.

## Design Notes

- Commands:
  - `semantic_query` continues to call `buildOrLoadIndex` lazily.
  - `semantic_grep` continues to call `buildOrLoadGrepIndex` lazily.
- Infrastructure:
  - `src/cache/build-coordinator.ts` provides single-flight and repo queue helpers.
- Domain rules:
  - Same-key dedupe is per cache key.
  - Repo queue is for heavy build work only; it is not an eager warmup.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Coordinator smoke for same-key dedupe, repo queue ordering, abort-aware shared build, and abandoned-flight recovery |
| Integration | `npm run check:ts` |
| E2E | Manual query/grep smoke still works after build coordination |
| Platform | N/A |
| Release | N/A |

## Harness Delta

This story captures a performance hardening seam: shared build coordination without eager warmup.

## Evidence

- `npm run check:ts` ✅
- `git diff --check` ✅
- `npm run smoke -- "lazy cache build single-flight" --scope src --max-results 3 --detail brief` ✅
- Coordinator smoke: same-key single-flight, repo queue ordering, abort-aware shared build, concurrent `executeSemanticGrep` ✅
