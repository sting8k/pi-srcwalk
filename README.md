# pi-srcwalk

**Agent evidence tools for `srcwalk` CLI — designed for AI coding agents.**

Agent thấy 2 tool chính:

```text
semantic_search(query, scope?)
semantic_review(target?, scope?)
```

Wrapper tự động route search/review intent, gọi `srcwalk` commands phù hợp, fuse kết quả search bằng BM25/PRF + RRF, expand evidence với context/trace/deps/review, trả về compact evidence packet.

---

## Architecture

```text
Agent
  │ semantic_search("how does ranking work?")
  │ semantic_review() for current diffs
  ▼
┌─────────────────────────────────────────┐
│  pi-srcwalk wrapper                     │
│                                         │
│  1. Classify query intent               │
│  2. Generate candidate pool:            │
│     - srcwalk discover/fusion commands  │
│     - TS-native BM25/PRF cache          │
│     - srcwalk structural candidates     │
│  3. RRF fuse candidate ranks            │
│  4. Confidence gate + abstain check     │
│  5. srcwalk context/trace/deps expand   │
│  6. Format evidence packet              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  srcwalk CLI (structural evidence)      │
│  discover · context · trace · deps ·    │
│  overview · show · review               │
└──────────────┬──────────────────────────┘
               │
               ▼
            Agent ← evidence packet
```

---

## Query types supported

| Query example | Intent | Strategy |
|---|---|---|
| `handleAuth` | symbol | `discover --as symbol` |
| `src/search/rank.rs:23` | exact target | `context <target>` |
| `src/search/rank.rs` | file | `show <file>` |
| "how does ranking work?" | broad/natural | TS BM25/PRF + RRF fusion |
| "who calls sort?" | callers | discover → trace callers |
| "what does sort call?" | callees | discover → trace callees |
| "deps of rank.rs" | deps | deps <file> |
| "overview of src/search" | overview | overview --symbols |
| "tests for ranking" | test search | test scope + topic BM25 |
| "review staged changes" | change review | `srcwalk review --staged` |

### Intent detection

```text
overview:   "overview", "architecture", "what is in", "structure"
callers:    "who calls", "who uses", "callers", "used by"
callees:    "what calls", "callees", "call flow"
deps:       "deps", "dependencies", "imports"
definition: "where is", "defined", "implementation"
test:       "tests for", "test", "spec", "example"
```

### Fallback chain

```text
Primary strategy fails
  → text search with keywords
  → symbol glob search
  → overview --symbols
```

---

## RRF fusion

Runtime Pi extension dùng **two-rank RRF** để merge TS lexical cache và `srcwalk` structural evidence. Python lab v9 vẫn giữ optional embedding để làm reference/benchmark lịch sử:

```text
TS BM25/PRF rank     weight=1.0
srcwalk structural   weight=1.25
embedding rank       disabled in TS runtime
  ↓
RRF fusion (K=60)
  ↓
confidence/abstain gate
```

Embedding không nằm trong TS runtime v1 để tránh Python/model dependency. Nếu cần benchmark embedding, dùng lab Python trong `lab/python/`.

---

## Cache format

TS runtime dùng persistent pure-JSON cache tại:

```text
/tmp/pi-srcwalk-ts-cache/<scope-key>/
  manifest.json               # file fingerprints
  chunks.jsonl                 # chunk metadata + text/tokens
  index.json                   # doc frequencies + BM25 postings
```

Per `(repo, scope)` cache khoảng:

| Scope | Chunks | Cache size |
|---|---:|---:|
| srcwalk `src` | 613 | ~2.5MB |
| Bifrost `framework` | 889 | ~4.5MB |
| Ghidra `Features/Decompiler` | 3612 | ~19.3MB |
| Bifrost full | 10871 | ~68MB |
| Uno `src` | 32805 | ~114.5MB |

Cache rebuild khi file fingerprint thay đổi (size + mtime).

---

## Embedding

TS runtime v1 không ship embedding để không phụ thuộc Python/model runtime. Embedding chỉ còn trong historical Python lab (`lab/python/router_lab_v9.py`) để so sánh benchmark khi cần.

---

## Usage

### Pi package / extension

```bash
# Temporary local test
pi -e ./extensions/pi-srcwalk/index.ts

# Package install from this repo/path once published or checked out
pi install ./path/to/pi-srcwalk
```

The extension registers two agent-facing tools:

```text
semantic_search(query, scope?)
semantic_review(target?, scope?)
```

Runtime implementation is TypeScript-only. `semantic_search` calls `srcwalk` plus a pure TS BM25/PRF cache for existing-code evidence. `semantic_review` calls `srcwalk review` for staged or working-tree diffs. Agent-facing knobs are intentionally minimal: pass only `query` for search by default, and call `semantic_review()` with no arguments for staged changes.

### TS engine smoke

```bash
# Requires TypeScript runtime/dev deps if run outside Pi's extension loader
npm run smoke -- "execute_search" -- --scope . --max-results 2 --detail brief
```

### Historical Python lab

```bash
cd lab/python
python3 router_lab_v9.py --lab
python3 router_lab_v9.py --lab --only-repo ghidra
python3 router_lab_v9.py --lab --embedding
```

---

## Lab results (v9 — current)

### Core benchmark — 17 quality-labeled cases

Tested on: Bifrost (Go), Uno (.NET), srcwalk (Rust)

```text
Hit@1:  16/16
Hit@3:  16/16
MRR:    1.000
AbstainOK: 17/17   (16 retrieval + 1 expected abstain)
elapsed: ~27s warm cache
```

### Ghidra benchmark — 11 cases

```text
Hit@1:  10/10
Hit@3:  10/10
MRR:    1.000
AbstainOK: 11/11   (10 retrieval + 1 expected abstain)
elapsed: ~22.9s cold, ~12.1s warm
```

Full lab reports:

```text
lab/reports/LAB_RESULTS_V9.md                  # core 17 cases
lab/reports/LAB_RESULTS_V9_GHIDRA.md           # Ghidra 11 cases
lab/reports/LAB_RESULTS_V9_SUMMARY.md          # summary + cache metrics
lab/reports/LAB_RESULTS_V9_EMBEDDING_SMOKE.md  # embedding smoke test
```

---

## Version history (lab)

| Version | What changed |
|---|---|
| v3 | Initial multi-strategy router + srcwalk discover/context |
| v4 | BM25/PRF retriever (in-memory, no embedding) |
| v5 | CodeRankEmbed reranker (quá nặng ~10GiB RAM, dropped) |
| v6 | potion-code-16M reranker (optional, guarded fallback) |
| v7 | Confidence gate + abstain + benchmark with expected targets |
| v8 | RRF fusion (BM25 + structural + optional embedding) |
| **v9** | **Persistent SQLite/FTS5 cache + full vector cache optional** |

---

## Project structure

```text
pi-srcwalk/
├── package.json                     # Pi package manifest
├── extensions/pi-srcwalk/index.ts   # Pi extension entrypoint
├── src/                             # TS-native runtime engine
│   ├── engine.ts                    # semantic_search orchestration
│   ├── index/                       # pure TS chunk cache + BM25/PRF
│   ├── router/                      # intent detection + command planning
│   ├── srcwalk/                     # srcwalk runner/parser
│   ├── ranking/                     # RRF + confidence/abstain
│   └── output/                      # evidence packet + truncation
└── lab/
    ├── python/router_lab_v9.py      # historical best Python lab
    ├── python/router_lab_v*.py      # older lab versions
    └── reports/LAB_RESULTS_V*.md    # benchmark reports
```

---

## Design principles

1. **Router over pattern-matching** — classify intent, generate strategies, execute with early-stop
2. **Evidence over summary** — trả raw `srcwalk` evidence, không tự summarize quá tay
3. **Minimal parsing** — bám vào `> Next: srcwalk context ...`, `### Definitions`, target dạng `path:line-range`
4. **Fallback always** — không bao giờ trả empty
5. **Abstain over hallucinate** — nếu không có evidence mạnh, trả "no strong match"

---

## Claim

```text
smart srcwalk evidence wrapper
with TS-native persistent BM25/PRF cache + RRF fusion
```

**Chưa nên claim:** "semantic search mạnh" hay "true embedding retrieval".

Not a Semble clone. Học RRF fusion từ Semble, không copy architecture.

---

## References

- [srcwalk](https://github.com/sting8k/srcwalk) — Structural code-intelligence CLI
- [semble](https://github.com/MinishLab/semble) — Semantic code search (inspiration for RRF fusion)
- [potion-code-16M](https://huggingface.co/minishlab/potion-code-16M) — Model2Vec embedding model

---

**Status:** TS-native Pi extension implementation started; Python v9 lab remains benchmark/reference material.
**Next:** Validate package loading in Pi and compare TS results against selected v9 golden cases.
