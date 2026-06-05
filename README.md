# pi-srcwalk

Code evidence tools for AI coding agents — built on [`srcwalk`](https://github.com/sting8k/srcwalk).

Four agent-facing tools:

- **`semantic_search`** — find existing code evidence: symbols, files, callers, deps, overviews, tests, and natural-language questions.
- **`semantic_review`** — review staged or working-tree changes with diff evidence and risk hints.
- **`semantic_show`** — open a specific candidate from a previous search, or a direct target `path:line`, showing its structural context (flow map, callers, callees) or raw code.
- **`semantic_usages`** — show callers, callees, and references for a specific symbol using srcwalk trace and discover commands.

No Python runtime. Pure TypeScript. Ships as a [Pi](https://github.com/earendil-works/pi) extension package.

---

## Quick start

```bash
# Load the extension locally in Pi
pi -e ./extensions/pi-srcwalk/index.ts

# Or install as a package once published
pi install ./path/to/pi-srcwalk
```

After `/reload` in Pi, all four tools become available.

---

## Tools

### `semantic_search`

```ts
semantic_search({ query: string, scope?: string })
```

What it does:

- Accepts a natural-language question, a symbol, a file path, `path:line`, or a request like "who calls X", "deps of Y", "overview of Z", "tests for W".
- Looks up a TypeScript-native process-local BM25/PRF memory cache for broad queries.
- Calls `srcwalk` for structural evidence (discover, context, trace, deps, overview, show).
- Prioritizes exact symbol anchors when a natural-language query names CamelCase or method-like symbols.
- Uses RRF when lexical and structural rank lists are both available, computes retrieval confidence, and returns a compact evidence packet.

| You ask | It returns |
|---|---|
| `"how does ranking work?"` | ranked file/function candidates + code context |
| `"who calls parseCandidates?"` | caller trace with path:line targets |
| `"overview of src/search"` | structural overview with function list + relations |
| `"deps of rank.rs"` | dependency list |
| `"tests for bm25"` | test files matching the topic |
| `execute_search` (symbol) | definition location + surrounding context |
| `src/index/bm25.ts:17` (exact) | code context at that line |

Every result includes:

- **Retrieval confidence** — `high` when candidates cluster tightly; `medium` when results spread across modules or query is broad.
- **Bounded evidence** — raw `srcwalk` output, not an LLM summary. Use returned paths as follow-up targets with `read`/`edit` tools, not as final answers.

When `semantic_search` abstains (`abstained: true`), it means no strong match was found — do not fabricate evidence from thin air.

### `semantic_review`

```ts
semantic_review({ target?: "staged" | "working-tree", scope?: string })
```

What it does:

- Runs `srcwalk review` on staged changes by default.
- With `target: "working-tree"`, reviews unstaged diffs.
- Returns changed files, affected symbols, and risk hints.

Use `semantic_review` when the user asks to review, check, summarize, or assess current changes.

### `semantic_show`

```ts
semantic_show({
  search_id?: string,  // from a previous semantic_search
  usage_id?: string,   // from a previous semantic_usages
  candidate_id?: number,
  target?: string,     // alternative: direct path:line
  mode?: string,       // "context" (default) or "show"
  scope?: string,      // override scope for context mode
})
```

What it does:

- Opens a specific candidate from a previous `semantic_search` by `search_id + candidate_id` without manually copying the target path.
- Opens a specific target from `semantic_usages` by `usage_id + candidate_id`.
- Also accepts a direct `target` (`path:line`) for stateless usage without a prior search.
- Default mode `"context"` shows structural analysis: flow map, call neighborhood, callees, and callers.
- Mode `"show"` shows raw code with surrounding context lines.

```ts
// Example: open candidate #1 from a previous search
semantic_search({ query: "buildOrLoadIndex" })
// → returns search_id: "r595b4-s1", candidates: [...]
semantic_show({ search_id: "r595b4-s1", candidate_id: 1 })

// Example: open candidate #1 from previous usages lookup
semantic_usages({ symbol: "buildOrLoadIndex" })
// → returns usage_id: "r595b4-u1", candidates: [...]
semantic_show({ usage_id: "r595b4-u1", candidate_id: 1 })

// Stateless: directly show target
semantic_show({ target: "src/index/cache.ts:154-259", mode: "show" })
```

### `semantic_usages`

```ts
semantic_usages({
  symbol: string,
  relation?: "all" | "callers" | "callees" | "references",
  scope?: string,
  limit?: number,
})
```

What it does:

- Shows callers, callees, and references for a specific symbol in one concise response.
- Default `relation: "all"` runs all three. Use `relation: "callers"` to focus on one aspect.
- Callees always include detailed call sites (ordered, with args).
- Results include `usage_id` so targets can be opened with `semantic_show`.

```ts
// Example: all usages of a symbol
semantic_usages({ symbol: "executeSearch" })
// → usage_id: "r595b4-u1", callers: 2, callees: 10, references: 5

// Focus on one relation
semantic_usages({ symbol: "buildOrLoadIndex", relation: "callers" })
```

---

## How it works

```text
┌─────────────────────────────────────────────────────────────┐
│                         Agent (Pi)                          │
│  semantic_search(query, scope?)                             │
│  semantic_review({ target?, scope? })                       │
│  semantic_show({ search_id?, usage_id?, candidate_id? })     │
│  semantic_usages({ symbol, relation?, scope? })              │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    pi-srcwalk extension                     │
│                                                             │
│  Search lane                                                │
│    query → intent/route                                     │
│    symbol / file / callers / deps / overview / test         │
│    optional compact BM25/PRF memory cache                   │
│      general / definition / test / related only             │
│    srcwalk discover / overview / show / context / deps      │
│    rank candidates                                          │
│    RRF if BM25 + srcwalk both return rank lists             │
│    otherwise score the available source                     │
│    confidence gate → high / medium / abstain                │
│    expand evidence → context/show/trace/deps/assess         │
│    format search packet → truncate 50KB                     │
│                                                             │
│  Usage lane                                                 │
│    symbol → trace callers/callees + discover references     │
│    detailed callees by default                             │
│    usage_id registry → semantic_show targets                │
│    format usage packet → truncate 50KB                      │
│                                                             │
│  Review lane                                                │
│    default target → srcwalk review --staged                 │
│    working-tree target → srcwalk review                     │
│    parse changed files / hunks / symbols                    │
│    format review packet → truncate 50KB                     │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         Agent (Pi)                          │
│  search output: candidates + confidence + evidence          │
│  review output: changed evidence + diff stats               │
│  show output: context packet or raw code                     │
│  usage output: callers + callees + references + usage_id     │
└─────────────────────────────────────────────────────────────┘
```

`semantic_search` keeps the agent-facing contract small: the agent passes `query` and optional `scope`; result count, depth, verbosity, and retrieval strategy stay internal. `semantic_review` is separate: it reviews staged changes by default and uses `target: "working-tree"` for unstaged changes.

---

## Cache

Broad-query BM25/PRF uses a process-local compact memory cache:

```text
semantic_search process
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

Before the TypeScript implementation, `router_lab_v9.py` was the prototype that validated the design:

- Multi-strategy router: intent detection → srcwalk command planning.
- BM25/PRF retriever with persistent SQLite/FTS5 cache.
- RRF fusion with optional `potion-code-16M` embedding.
- Confidence gating and abstain logic.

Benchmark on Bifrost, Uno, Ghidra, and srcwalk repos: **16/16 Hit@1 core**, **10/10 Hit@1 Ghidra**.

The TypeScript extension inherited the router, BM25/PRF, RRF, and confidence architecture from Python lab v9. Embedding was intentionally left out of TS v1 to keep the extension dependency-free.

Python lab files and reports live on the `lab` branch.

---

## Project structure

```text
pi-srcwalk/
├── package.json                     # Pi package manifest
├── extensions/pi-srcwalk/index.ts   # Pi extension entrypoint (4 tools)
├── src/                             # TS-native runtime engine
│   ├── engine.ts                    # semantic_search orchestration
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
4. **Minimal agent surface** — agent passes `query` and optional `scope`. Knobs stay internal.
5. **Fallback broadly** — fall through to text search → symbol glob → overview, then abstain when evidence is still weak.

---

## References

- [srcwalk](https://github.com/sting8k/srcwalk) — structural code-intelligence CLI
- [Pi coding agent](https://github.com/earendil-works/pi) — agent platform, extension spec
- [Semble](https://github.com/MinishLab/semble) — RRF fusion inspiration
- [potion-code-16M](https://huggingface.co/minishlab/potion-code-16M) — embedding model (lab only)
