# EXT-002 Split semantic query and semantic grep tools

## Status

implemented

## Lane

normal

## Product Contract

Expose `semantic_query` as the renamed code-intent discovery tool, add `semantic_grep` as the deterministic raw text/regex tool, and stop encouraging built-in `grep` in the pi-srcwalk contract.

## Relevant Product Docs

- `README.md`
- `extensions/pi-srcwalk/index.ts`
- `src/output/format.ts`
- `src/grep/semantic-grep.ts`

## Acceptance Criteria

- `semantic_search` is renamed to `semantic_query` in the Pi tool surface and docs.
- `semantic_grep` is registered as a new Pi tool.
- `semantic_grep` supports literal and regex search with candidate pruning and full-scan fallback.
- The system prompt contract tells agents to use `semantic_query` for discovery and `semantic_grep` for raw text/regex, not built-in `grep`.
- README and package metadata reflect the new tool split.

## Design Notes

- Commands:
  - `semantic_query` keeps the existing srcwalk/BM25 discovery flow.
  - `semantic_grep` uses an in-memory trigram index plus exact line verification.
- Queries:
  - `semantic_query` remains intent-driven.
  - `semantic_grep` is deterministic and returns file:line matches.
- API:
  - New Pi tool surface: `semantic_grep`.
- Domain rules:
  - Do not recommend built-in `grep` by default once `semantic_grep` exists.

## Validation

| Layer | Expected proof |
| --- | --- |
| Unit | `npm run check:ts` |
| Integration | `semantic_query` / `semantic_grep` smoke output if available |
| E2E | Pi tool registration and prompt contract review |
| Platform | N/A |
| Release | N/A |

## Harness Delta

No new harness mechanics yet; story records the tool-surface split and validation expectations.

## Evidence

- `npm run check:ts` ✅
- `git diff --check` ✅
- `npm run smoke -- "how does ranking work? file:rank.ts -test" --scope src --max-results 3 --detail brief` ✅
- Direct `executeSemanticGrep` smoke literal `semantic_query` on `README.md` ✅ (`backend=trigram-index`)
- Direct `executeSemanticGrep` smoke regex `semantic.*query` on `README.md` ✅ (`backend=trigram-index`)
- Direct `executeSemanticGrep` smoke weak regex `s.*q` on `README.md` ✅ (`backend=full-scan`)
- Direct same-process cache smoke ✅ (`first.cacheHit=false`, `second.cacheHit=true`)
- `semantic_review({ target: "working-tree" })` ✅
