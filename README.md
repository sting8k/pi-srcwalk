# pi-srcwalk

Code evidence tools for AI coding agents — built on [`srcwalk`](https://github.com/sting8k/srcwalk).

Two agent-facing tools:

- **`semantic_search`** — find existing code evidence: symbols, files, callers, deps, overviews, tests, and natural-language questions.
- **`semantic_review`** — review staged or working-tree changes with diff evidence and risk hints.

No Python runtime. Pure TypeScript. Ships as a [Pi](https://github.com/earendil-works/pi) extension package.

---

## Quick start

```bash
# Load the extension locally in Pi
pi -e ./extensions/pi-srcwalk/index.ts

# Or install as a package once published
pi install ./path/to/pi-srcwalk
```

After `/reload` in Pi, both `semantic_search` and `semantic_review` become available.

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

---

## How it works

```text
┌─────────────────────────────────────────────────────────────┐
│                         Agent (Pi)                          │
│  semantic_search(query, scope?)                             │
│  semantic_review({ target?, scope? })                       │
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

Python lab files are under `lab/python/`. Full reports are in `lab/reports/`.

---

## Project structure

```text
pi-srcwalk/
├── package.json                     # Pi package manifest
├── extensions/pi-srcwalk/index.ts   # Pi extension entrypoint (2 tools)
├── src/                             # TS-native runtime engine
│   ├── engine.ts                    # semantic_search orchestration
│   ├── cli.ts                       # dev smoke-test CLI
│   ├── index/                       # compact memory cache + BM25/PRF
│   ├── router/                      # intent detection + command planning
│   ├── srcwalk/                     # CLI runner + output parser
│   ├── ranking/                     # RRF fusion + confidence
│   └── output/                      # evidence formatting + truncation
└── lab/
    ├── python/router_lab_v*.py      # research prototypes (v3–v9)
    └── reports/LAB_RESULTS_V*.md    # historical benchmarks
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
