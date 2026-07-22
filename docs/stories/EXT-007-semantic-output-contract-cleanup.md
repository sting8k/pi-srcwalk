# EXT-007 Semantic Output Contract Cleanup

## Status

implemented

## Lane

normal

## Product Contract

Semantic tool output should optimize for agent decision-making by default: concise result/evidence/caveat text first, operational diagnostics in verbose text or structured details, and explicit semantics for coverage vs result limits vs output truncation.

## Relevant Product Docs

- `README.md`
- `extensions/pi-srcwalk/index.ts` injected semantic tool contract

## Acceptance Criteria

- `semantic_query` default formatted output omits cache/command telemetry while `verbose` output preserves it.
- `semantic_grep` default formatted output omits cache/timing/index diagnostics while `verbose` output preserves them.
- `semantic_grep` inspect enrichment is opt-in (`enrich=true`) instead of default-on.
- `semantic_grep` result/details expose explicit coverage plus match-limit fields without removing existing stats aliases.
- Tool details distinguish output truncation from semantic match/result limits.
- README and injected tool guidance match the new default behavior.

## Design Notes

- Presentation layer owns output cleanup; search/index algorithms should stay unchanged.
- Keep backward-compatible aliases such as `stats.truncated`, `details.truncated`, and `details.fullOutputPath` for existing callers.
- Add explicit fields rather than renaming existing public fields in this patch.
- Coverage must be derived from walk-cap state, not from number of shown matches.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Formatter tests for default vs verbose telemetry; grep stats/coverage tests; enrichment-policy helper tests. |
| Integration | `npm test`; `npm run check:ts`; smoke output for concise grep/query if practical. |
| E2E | Not required for local patch; PR/CI should cover package test workflow. |
| Platform | Not required; output-only TypeScript changes. |
| Release | Release notes must mention `semantic_grep` enrichment default behavior change. |

## Harness Delta

No harness policy change expected.

## Evidence

- `npm run check:ts` ✅
- `npm test` ✅ — 41/41
- `git diff --check` ✅
- Direct smoke output check ✅ — grep/query concise default hides diagnostics; verbose output preserves diagnostics.
- Reviewer agent returned rework; P2 findings fixed: operational grep notes are verbose-only by default, and unreadable eligible files now mark coverage incomplete.
- Harness durable story row updated to `implemented`.
