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
- Looks up a TypeScript-native persistent BM25/PRF cache.
- Calls `srcwalk` for structural evidence (discover, context, trace, deps, overview, show).
- Fuses results with RRF ranking, computes retrieval confidence, and returns a compact evidence packet.

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
│                        Agent (Pi)                          │
│   semantic_search("how does ranking work?", scope?")       │
│   semantic_review({ target: "staged" })                     │
└──────────────┬──────────────────────────────────────────────┘
               │ query + optional scope
               ▼
┌─────────────────────────────────────────────────────────────┐
│                  pi-srcwalk extension                       │
│                                                             │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ intent detect │  │ BM25/PRF     │  │ srcwalk commands │  │
│  │ symbol? file? │  │ chunk cache  │  │ discover, trace, │  │
│  │ callers? deps?│  │ pure JSON    │  │ deps, overview,  │  │
│  │ overview? test│  │ auto-rebuild │  │ context, show    │  │
│  └───────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│          │                 │                    │            │
│          └─────────┬───────┴────────────────────┘            │
│                    ▼                                         │
│          ┌─────────────────┐                                 │
│          │  RRF fusion     │                                 │
│          │  ┌─ BM25 rank   │                                 │
│          │  ├─ structural  │                                 │
│          │  └─ score merge │                                 │
│          └────────┬────────┘                                 │
│                   ▼                                          │
│          ┌─────────────────┐                                 │
│          │ confidence gate │  ─ high / medium / abstain      │
│          └────────┬────────┘                                 │
│                   ▼                                          │
│          ┌─────────────────┐                                 │
│          │ evidence expand │  ─ context, trace, deps         │
│          │ (top candidates)│                                 │
│          └────────┬────────┘                                 │
│                   ▼                                          │
│          ┌─────────────────┐                                 │
│          │ format +        │                                 │
│          │ truncate 50KB   │                                 │
│          └────────┬────────┘                                 │
└───────────────────┼──────────────────────────────────────────┘
                    │ evidence packet
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                        Agent (Pi)                          │
│  ## Candidates            ## Commands executed              │
│  1. src/ranking/rank.ts   [ok] srcwalk discover ...         │
│  2. ...                   [ok] srcwalk context ...          │
│  ## Retrieval confidence  ## Evidence expansion             │
│  level: high              context src/ranking/rank.ts:17... │
│  source: ranking                                            │
└─────────────────────────────────────────────────────────────┘
```

Agent only sees `query` and optional `scope`. Result count, depth, verbosity, and embedding options are internal defaults — the tool chooses them, not the LLM.
---

## Cache

Chunk index is stored on disk as pure JSON:

```text
/tmp/pi-srcwalk-ts-cache/<scope-key>/
  manifest.json    # file fingerprints (size + mtime)
  chunks.jsonl     # chunk text + tokens
  index.json       # doc frequencies + BM25 postings
```

Cache auto-rebuilds when files change. Typical sizes:

| Repo + scope | Chunks | Cache |
|---|---:|---:|
| srcwalk `src` | ~600 | ~2.5 MB |
| Bifrost `framework` | ~900 | ~4.5 MB |
| Ghidra `Features/Decompiler` | ~3,600 | ~19 MB |
| Bifrost full | ~11,000 | ~68 MB |
| Uno `src` | ~33,000 | ~115 MB |

No database, no native dependencies. Node.js built-in `fs` is all it needs.

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
│   ├── index/                       # chunk cache + BM25/PRF
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
5. **Fallback always** — never return empty; fall through to text search → symbol glob → overview.

---

## References

- [srcwalk](https://github.com/sting8k/srcwalk) — structural code-intelligence CLI
- [Pi coding agent](https://github.com/earendil-works/pi) — agent platform, extension spec
- [Semble](https://github.com/MinishLab/semble) — RRF fusion inspiration
- [potion-code-16M](https://huggingface.co/minishlab/potion-code-16M) — embedding model (lab only)
