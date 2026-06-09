# pi-srcwalk

A Pi extension wrapper around [`srcwalk`](https://github.com/sting8k/srcwalk) — makes structural code-intelligence easy for AI coding agents. `srcwalk` is a CLI for symbol search, callers/callees, deps, and overviews; this package wraps it into five agent-safe semantic tools with bounded output, error handling, and registry-based candidate handoff.

Five agent-facing tools:

- **`semantic_query`** — discover ranked code evidence from natural-language questions, symbols, files, overviews, deps, and tests.
- **`semantic_inspect`** — deep-inspect known symbol(s): context, callers, callees, and references in one shot.
- **`semantic_show`** — read exact source target(s) via `srcwalk show` with a fixed `-C 12` surrounding-line window.
- **`semantic_review`** — review staged or working-tree changes with diff evidence and risk hints.
- **`semantic_grep`** — search raw text or regex with trigram-indexed candidate pruning and full-scan fallback.

No Python runtime. Pure TypeScript. Ships as a [Pi](https://github.com/earendil-works/pi) extension package.

---

## Prerequisites

- [`srcwalk`](https://github.com/sting8k/srcwalk) CLI — the structural code-intelligence engine.

  Install via:

  ```bash
  npm install -g srcwalk
  # or npx srcwalk for on-demand use
  ```

  Verify:

  ```bash
  npx srcwalk --version
  # or srcwalk --version if installed globally
  ```

---

## Quick start

```bash
# Install from npm
pi install npm:@sting8k/pi-srcwalk

# Or load the local checkout during development
pi -e ./extensions/pi-srcwalk/index.ts
```

After `/reload` in Pi, all five tools become available.

---

## Which tool should I use?

```text
unknown target / broad question
  -> semantic_query

known exact symbol
  -> semantic_inspect

raw text / regex
  -> semantic_grep

exact path:line or candidate id
  -> semantic_show

changed code
  -> semantic_review
```

| Need | Use |
|---|---|
| Find likely files, symbols, deps, tests, or overview | `semantic_query` |
| Understand one known symbol deeply | `semantic_inspect` |
| Search raw text or regex | `semantic_grep` |
| Read exact source from a candidate or `path:line` | `semantic_show` |
| Review current diff | `semantic_review` |

---

## Tools

### `semantic_query`

Use this for broad code discovery: questions, fuzzy symbols, file targets, overviews, deps, and tests.

What it does:

- Accepts a natural-language question, a fuzzy symbol, a file path, `path:line`, or a request like "overview of Z", "deps of Y", or "tests for W".
- Looks up a TypeScript-native process-local BM25/PRF memory cache for broad queries.
- Calls `srcwalk` for structural evidence (discover, context, trace, deps, overview, show).
- Prioritizes exact symbol anchors when a natural-language query names CamelCase or method-like symbols.
- Uses RRF fusion when both BM25 and srcwalk rank lists are available, then gates confidence.
- Returns a compact evidence packet.

| You ask | It returns |
|---|---|
| `"how does ranking work?"` | ranked file/function candidates + code context |
| `"overview of src/search"` | structural overview with function list + relations |
| `"deps of rank.rs"` | dependency list |
| `"tests for bm25"` | test files matching the topic |
| `execute_search` (fuzzy symbol) | definition candidates + evidence |
| `src/index/bm25.ts:17` (exact) | evidence at that location |

Every result includes:

- **Retrieval confidence** — `high` when candidates cluster tightly; `medium` when results spread across modules or query is broad.
- **Bounded evidence** — compact `srcwalk` evidence by default, with full blocks available in deep detail. Open returned candidates with `semantic_show`, or inspect exact known symbols with `semantic_inspect`.

When `semantic_query` abstains (`abstained: true`), it means no strong match was found — do not fabricate evidence from thin air.

### `semantic_grep`

Use this for exact text or regex matches. Add `scope`, `glob`, `literal`, `regex`, `ignoreCase`, or `context` only when needed.

What it does:

- Searches exact text or regex patterns deterministically.
- Uses a trigram-indexed pipeline: literal anchor extraction, candidate pruning, then exact line verification.
- Falls back to full scanning when regex anchors are too weak or too complex.
- Returns raw file:line matches with optional context lines.
- Replaces built-in `grep` in the pi-srcwalk injected tool contract.

| You ask | It returns |
|---|---|
| `foo bar` | literal file:line matches |
| `execute.*Search` | regex matches with pruned candidates |
| `--glob "**/*.ts"` | same search, but limited to matching files |
| `-i` / `ignoreCase: true` | case-insensitive matches |

### `semantic_inspect`

Use this when you already know the exact symbol name. Pass up to three symbols with commas when needed.

What it does:

- Deep-inspects known symbol(s). Use `symbol: "A,B,C"` for up to 3 symbols.
- Runs `srcwalk context` first to show local structure and call neighborhood.
- Adds explicit relation evidence:
  - `callers` — upstream call sites
  - `callees` — downstream detailed call sites
  - `references` — symbol matches / reference candidates
- Default `relation: "all"` returns Context, Callers, Callees, and References.
- Results include `inspect_id` so targets can be opened with `semantic_show`.

```ts
// Full inspect for one known symbol
semantic_inspect({ symbol: "executeSearch" })
// -> Context, Callers, Callees, References, inspect_id

// Narrow output to callers
semantic_inspect({ symbol: "buildOrLoadIndex", relation: "callers" })
// -> Context, Callers

// Bounded multi-symbol inspect
semantic_inspect({ symbol: "executeSearch,readArg,formatInspectPacket" })
// -> one section per symbol; max 3
```

### `semantic_show`

Use this to open exact source from a previous `search_id` / `inspect_id`, or from a direct `path:line` target.

What it does:

- Reads exact source code via `srcwalk show <target> -C 12 --budget 5000`.
- Opens a candidate from `semantic_query` using `search_id + candidate_id`.
- Opens a candidate from `semantic_inspect` using `inspect_id + candidate_id`.
- Also accepts direct targets, including multi-target strings like `a.ts:10,b.ts:20-30`.
- Does not run `srcwalk context` or relation traces. For structural context around a known symbol, use `semantic_inspect`.

```ts
// Open candidate #1 from a previous search
semantic_query({ query: "buildOrLoadIndex" })
// -> returns search_id: "r595b4-s1", candidates: [...]
semantic_show({ search_id: "r595b4-s1", candidate_id: 1 })

// Open candidate #1 from a previous inspect
semantic_inspect({ symbol: "buildOrLoadIndex" })
// -> returns inspect_id: "r595b4-u1", candidates: [...]
semantic_show({ inspect_id: "r595b4-u1", candidate_id: 1 })

// Stateless direct source read
semantic_show({ target: "src/index/cache.ts:154-259" })

// Multi-target direct source read
semantic_show({ target: "src/engine.ts:45-55,src/router/intent.ts:1-5" })
```

### `semantic_review`

Use this to review staged or working-tree changes, optionally narrowed to one scope.

What it does:

- Runs `srcwalk review` on staged changes by default.
- With `target: "working-tree"`, reviews unstaged diffs.
- If `scope` points to a nested git repo, runs review inside that repo.
- Returns changed files, affected symbols, and risk hints.

Use `semantic_review` when the user asks to review, check, summarize, or assess current changes.

---

## Common workflows

### Understand and edit existing code

```text
semantic_query({ query: "where is cache eviction handled?" })
  -> semantic_inspect({ symbol: "evictOldest" })
  -> semantic_show({ inspect_id, candidate_id: 1 })
  -> edit
  -> semantic_review({ target: "working-tree" })
```

### Review current changes

```text
semantic_review({ target: "working-tree" })
  -> semantic_show({ target: "file.ts:line-range" }) when exact source is needed
```

---

## How it works

```text
Agent (Pi)
  ├─ semantic_query(query, scope?)
  │    discovery / NL routing
  │    -> BM25/PRF + srcwalk evidence
  │    -> ranked candidates + confidence
  │
  ├─ semantic_grep({ pattern, scope?, glob?, literal?, regex? })
  │    deterministic text/regex search
  │    -> literal anchors / trigram prune
  │    -> verify exact line matches
  │
  ├─ semantic_inspect({ symbol, relation?, scope?, limit? })
  │    known symbol(s), max 3
  │    -> discover target + refs
  │    -> srcwalk context
  │    -> callers / detailed callees
  │    -> inspect_id candidates
  │
  ├─ semantic_show({ target } | { search_id/inspect_id, candidate_id })
  │    exact source read
  │    -> srcwalk show <target> -C 12 --budget 5000
  │
  └─ semantic_review({ target?, scope? })
       changed-code evidence
       -> srcwalk review --staged | working-tree
```

Each lane returns bounded `srcwalk` evidence and truncates tool output to 50KB. `semantic_query` is broad discovery, `semantic_grep` is raw text/regex search, `semantic_inspect` is targeted symbol understanding, `semantic_show` is exact source reading, and `semantic_review` is changed-code review.

---

## Cache

Broad-query BM25/PRF uses a process-local compact memory cache:

```text
semantic_query process
└─ memory:<repo+scope+version hash>
   ├─ path table + chunk line ranges + short previews
   ├─ vocab table + token→termId map
   ├─ typed-array BM25 postings
   └─ typed-array doc terms for PRF
```

The cache does not write chunk/index files to `/tmp`. It rebuilds when file fingerprints change and is bounded with LRU eviction:

| Env | Default | Purpose |
|---|---:|---|
| `PI_SRCWALK_MEMORY_CACHE_ENTRIES` | `4` | maximum cached repo/scope indexes per process |
| `PI_SRCWALK_MEMORY_CACHE_MAX_MB` | `512` | approximate memory budget before LRU eviction |

The retained memory index avoids full chunk text and duplicated token strings; it keeps only chunk metadata, short previews, vocabulary strings, and typed arrays. No database, no native dependencies.

---

## Python lab (research phase)

`router_lab_v9.py` on the `lab` branch prototyped the router, BM25/PRF, RRF, and confidence architecture. Embedding was left out of TS v1 to keep the extension dependency-free.

---

## Project structure

```text
pi-srcwalk/
├── package.json                     # Pi package manifest
├── extensions/pi-srcwalk/index.ts   # Pi extension entrypoint (5 tools)
├── src/                             # TS-native runtime engine
│   ├── engine.ts                    # semantic_query orchestration
│   ├── cli.ts                       # dev smoke-test CLI
│   ├── index/                       # compact memory cache + BM25/PRF
│   ├── router/                      # intent detection + command planning
│   ├── srcwalk/                     # CLI runner + output parser
│   ├── ranking/                     # RRF fusion + confidence
│   └── output/                      # evidence formatting + truncation
```

---

## Design principles

1. **Router, not pattern-match** — classify intent, generate strategies, early-stop on success.
2. **Evidence, not summary** — return raw `srcwalk` output as bounded evidence. Don't paraphrase.
3. **Abstain, don't hallucinate** — if no strong match, say so clearly with `abstained: true`.
4. **Minimal agent surface** — keep tool inputs small; advanced `srcwalk` knobs stay internal.
5. **Fallback broadly** — fall through to text search → symbol glob → overview, then abstain when evidence is still weak.

---

## References

- [srcwalk](https://github.com/sting8k/srcwalk) — structural code-intelligence CLI
- [Pi coding agent](https://github.com/earendil-works/pi) — agent platform, extension spec
- [Semble](https://github.com/MinishLab/semble) — RRF fusion inspiration
- [potion-code-16M](https://huggingface.co/minishlab/potion-code-16M) — embedding model (lab only)
