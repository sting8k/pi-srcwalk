# pi-srcwalk

**Single-tool semantic search wrapper for `srcwalk` CLI — designed for AI coding agents.**

Agent chỉ thấy 1 tool duy nhất:

```text
semantic_search(query, scope=".", max_results=3)
```

Wrapper tự động route query, gọi `srcwalk` commands phù hợp, fuse kết quả bằng BM25/PRF + RRF, expand evidence với context/trace/deps, trả về compact evidence packet.

---

## Architecture

```text
Agent
  │ semantic_search("how does ranking work?")
  ▼
┌─────────────────────────────────────────┐
│  pi-srcwalk wrapper                     │
│                                         │
│  1. Classify query intent               │
│  2. Generate candidate pool:            │
│     - srcwalk discover/fusion commands  │
│     - SQLite/FTS5 BM25/PRF search       │
│     - optional potion-code-16M vectors  │
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
│  overview · show                        │
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
| "how does ranking work?" | broad/natural | BM25/FTS + RRF fusion |
| "who calls sort?" | callers | discover → trace callers |
| "what does sort call?" | callees | discover → trace callees |
| "deps of rank.rs" | deps | deps <file> |
| "overview of src/search" | overview | overview --symbols |
| "tests for ranking" | test search | test scope + topic BM25 |

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

Thay vì sequential pipeline, v9 dùng **three-rank RRF** để merge:

```text
BM25/FTS rank        weight=1.0
srcwalk structural   weight=1.0
embedding rank       weight=0.85  (optional)
  ↓
RRF fusion (K=60)
  ↓
confidence/abstain gate
```

Embedding chỉ chạy khi:
- query là broad/concept/test (không symbol/file/callers/deps)
- BM25 cluster không quá mạnh
- model/index warm

---

## Cache format

V9 dùng persistent cache tại:

```text
/tmp/pi-srcwalk-v9-cache/<scope-key>/
  manifest.json               # file fingerprints
  chunks.sqlite               # chunk metadata + FTS5 index
  embeddings.potion-code-16m.float16.npy   # optional
  embedding_manifest.json                  # optional
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

## Optional embedding

```bash
python3 router_lab_v9.py --embedding "query" --repo ~/repo --scope src
```

Dùng `potion-code-16M` (Model2Vec) float16 vectors:

- 256 dims, 0.5KB / chunk vector
- Build một lần, cache persistent
- Cold model load ~900ms, warm ~300ms
- Chỉ bật khi query broad/concept, không mặc định

---

## Usage

### CLI

```bash
# Single query
python3 router_lab_v9.py "how does search ranking work?" \
  --repo ~/Documents/Develope/Ultra-lab/tilth \
  --scope src

# With embedding
python3 router_lab_v9.py "how does remote control work?" \
  --repo ~/Documents/Develope/uno \
  --scope src \
  --embedding

# Lab benchmark
python3 router_lab_v9.py --lab
python3 router_lab_v9.py --lab --only-repo ghidra
python3 router_lab_v9.py --lab --embedding
```

### Python API

```python
from router_lab_v9 import execute_search

result = execute_search(
    query="who calls sort?",
    repo="/path/to/repo",
    scope="src",
    max_results=3,
    enable_embedding=False,
)

print(result.confidence.reason)
for candidate in result.candidates:
    print(candidate.target, candidate.symbol, candidate.score)
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
LAB_RESULTS_V9.md               # core 17 cases
LAB_RESULTS_V9_GHIDRA.md        # Ghidra 11 cases
LAB_RESULTS_V9_SUMMARY.md       # summary + cache metrics
LAB_RESULTS_V9_EMBEDDING_SMOKE.md  # embedding smoke test
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
├── README.md                        # This file
├── router_lab_v9.py                 # Current best lab shape
├── router_lab_v3.py                 # Core router/parser
├── router_lab_v4.py                 # BM25 index + PRF + srcwalk commands
├── router_lab_v6.py                 # Embedding model + rerank logic
├── router_lab_v7.py                 # Benchmark + confidence gate
├── router_lab_v8.py                 # RRF fusion
├── LAB_RESULTS_V9_SUMMARY.md        # v9 summary + metrics
├── LAB_RESULTS_V9.md                # v9 full lab run
├── LAB_RESULTS_V9_GHIDRA.md         # v9 Ghidra run
├── LAB_RESULTS_V*.md                # Older lab reports
├── router_lab_v*.py                 # Older lab versions
└── router_lab.py                    # v1 prototype
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
with persistent BM25/FTS cache + RRF fusion
```

**Chưa nên claim:** "semantic search mạnh" hay "true embedding retrieval".

Not a Semble clone. Học RRF fusion từ Semble, không copy architecture.

---

## References

- [srcwalk](https://github.com/sting8k/srcwalk) — Structural code-intelligence CLI
- [semble](https://github.com/MinishLab/semble) — Semantic code search (inspiration for RRF fusion)
- [potion-code-16M](https://huggingface.co/minishlab/potion-code-16M) — Model2Vec embedding model

---

**Status:** Lab phase complete — v9 validated on 3 codebases (28 cases across 4 repos)  
**Next:** Productionize as MCP tool / agent skill
