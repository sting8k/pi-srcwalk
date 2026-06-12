# EXT-004 Semantic grep multi-scope

## Status

implemented

## Lane

normal

## Product Contract

`semantic_grep` accepts `scopes?: string[]` for one or more directory/file search roots. Omitted or empty `scopes` defaults to `["."]`. Relative, parent-relative (`../...`), and absolute paths are allowed; scopes are filters resolved from the current working directory, not a jail tied to a prior scope.

## Relevant Product Docs

- `README.md`
- `extensions/pi-srcwalk/index.ts`
- `src/grep/semantic-grep.ts`
- `src/grep/semantic-grep-scopes.ts`
- `tests/semantic-grep-scopes.test.ts`

## Acceptance Criteria

- `semantic_grep` tool schema exposes `scopes?: string[]` instead of single `scope`/`path` for grep.
- Multiple scopes are canonicalized by real path where possible.
- Duplicate scopes, nested parent/child directories, and files covered by kept directories are pruned before indexing.
- Relative, `../`, and absolute scopes are allowed.
- Missing scopes produce notes and zero matches for that missing root, not fatal errors.
- Candidate files are deduped by real path before indexing.
- Indexed file and byte caps remain bounded, and broad traversal has an entry cap.
- Cache keys are deterministic from canonical pruned scopes; equivalent scope sets reuse cache.
- Request-specific pruning/missing notes do not leak through cached indexes.

## Design Notes

- API:
  - `semantic_grep({ pattern, scopes?, glob?, literal?, regex?, ignoreCase?, context?, maxResults? })`
  - `scopes` defaults to `["."]` when omitted or empty.
- Infrastructure:
  - `src/grep/semantic-grep-scopes.ts` owns scope normalization, realpath canonicalization, overlap pruning, file collection, and resource caps.
- Domain rules:
  - Scope containment uses `path.relative(parent, child)`, not string prefix matching.
  - Paths inside cwd render as cwd-relative; paths outside cwd render as absolute.
  - Glob filtering runs after scope union and file dedupe.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | Scope normalization/pruning, cache-equivalent scope reuse, missing-note cache isolation, parent-relative/absolute scopes |
| Integration | `npm run check:ts` |
| E2E | `npm test` grep behavior suite |
| Platform | N/A |
| Release | N/A |

## Harness Delta

This story records the public tool contract change from a single grep scope to multi-scope search roots with resource-focused guards.

## Evidence

- `npm run check:ts` ✅
- `npm test` ✅ — 24 tests passed
- `semantic_review({ target: "working-tree" })` ✅
