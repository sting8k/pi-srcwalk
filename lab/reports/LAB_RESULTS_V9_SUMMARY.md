# Query Router Lab v9 Summary — Persistent `/tmp` Cache + RRF

## What changed from v8

v9 keeps the v8 search shape:

```text
srcwalk router
+ BM25/PRF
+ RRF fusion
+ confidence/abstain
+ srcwalk evidence expansion
```

The change is the cache layer:

```text
v8: in-process Python BM25 cache only
v9: persistent SQLite/FTS5 cache under /tmp/pi-srcwalk-v9-cache
```

Optional embedding now has an experimental full vector cache:

```text
/tmp/pi-srcwalk-v9-cache/<scope-key>/embeddings.potion-code-16m.float16.npy
```

No cache is written under `~`.

## Cache format

Per `(repo, scope)` cache directory:

```text
/tmp/pi-srcwalk-v9-cache/<scope-key>/
  manifest.json
  chunks.sqlite
  embeddings.potion-code-16m.float16.npy   # optional, only with --embedding
  embedding_manifest.json                   # optional
```

`chunks.sqlite` contains:

```text
chunks(id, path, start, end, text)
chunks_fts(path, text)  # SQLite FTS5 external-content index
```

The manifest fingerprints files by relative path, size, and mtime. If the fingerprint changes, the cache rebuilds.

## Quality result

### Core 17 cases

```text
python3 router_lab_v9.py --lab > LAB_RESULTS_V9.md
```

Result:

```text
Hit@1=16/16
Hit@3=16/16
MRR=1.000
AbstainOK=17/17
elapsed=26960ms  # warm cache run
```

### Ghidra 11 cases

```text
python3 router_lab_v9.py --lab --only-repo ghidra > LAB_RESULTS_V9_GHIDRA.md
```

Result:

```text
Hit@1=10/10
Hit@3=10/10
MRR=1.000
AbstainOK=11/11
elapsed=22897ms  # mixed cold/warm cache run
```

Warm rerun:

```text
Hit@1=10/10
Hit@3=10/10
MRR=1.000
AbstainOK=11/11
elapsed=12115ms
```

## Cache size and latency metrics

Observed persistent cache sizes:

| Scope | Chunks | Cache size | Cold prepare/query | Warm prepare/query |
|---|---:|---:|---:|---:|
| srcwalk `src` | 613 | 2.50MB BM25 / 2.80MB with vectors | ~386/392ms | ~2/6-16ms |
| Bifrost `framework` | 889 | 4.49MB | ~555/563ms | ~2/9ms |
| Bifrost `tests` | 1194 | 6.07MB | ~677/683ms | warm not separately isolated |
| Bifrost `.` | 10871 | 68.09MB | ~10622/10633ms | ~47/56ms |
| Uno `src` | 32805 | 114.50MB | ~18286/18311ms | ~346/380ms |
| Ghidra `Ghidra/Features/Decompiler` | 3612 | 19.34MB | ~2298/2306ms | ~8/15-16ms |
| Ghidra `Ghidra/Framework` | 16066 | 65.05MB | ~8762/8783ms | ~91/112ms |

Total `/tmp/pi-srcwalk-v9-cache` after these lab runs:

```text
~323MB
```

## Embedding vector cache smoke

Command:

```text
python3 router_lab_v9.py --repo ~/Documents/Develope/Ultra-lab/tilth --scope src --embedding "how does remote ranking logic work?"
```

First vector-cache build on srcwalk `src`:

```text
613 vectors
0.30MB float16 vector file
embedding rank total ~1493ms
```

Second CLI process run with vector cache hit but cold model load:

```text
embedding rank total ~909ms
```

Same Python process, model already warm:

```text
run 1 total ~987ms embedding rank
run 2 total ~294ms embedding rank
```

Interpretation:

```text
Persistent vector cache avoids re-encoding chunks.
A long-running MCP/server process is still important because model load dominates CLI cold runs.
```

## Comparison to v8

| Metric | v8 | v9 |
|---|---:|---:|
| Core quality | Hit@1 16/16, AbstainOK 17/17 | Hit@1 16/16, AbstainOK 17/17 |
| Ghidra quality | Hit@1 10/10, AbstainOK 11/11 | Hit@1 10/10, AbstainOK 11/11 |
| Cache persistence | in-process only | persistent `/tmp` |
| Warm BM25 query | process-local only | disk cache warm, typically ms to hundreds-ms depending scope |
| Cache format | Python object | SQLite + FTS5 |
| Optional embedding | pool rerank only | full vector cache rank source, optional |

## Caveats

- SQLite FTS5 is not identical to the pure-Python BM25 implementation, so v9 adds a generic path-token boost to preserve quality on test/topic queries.
- Large scopes still cost disk and load time. Scope narrowing remains important.
- Full embedding cache is optional and experimental. It improves candidate availability for concept queries, but it is not default.
- v9 still should not be described as “semantic search mạnh”. Better claim:

```text
smart srcwalk evidence wrapper with persistent BM25/FTS cache + RRF fusion
```

## Current recommendation

```text
Default:
  srcwalk router + SQLite/FTS BM25/PRF cache + RRF + confidence/abstain

Optional:
  potion-code-16M float16 vector cache under /tmp when --embedding is enabled

Production note:
  move cache from /tmp to a controlled app/cache directory only after the cache invalidation and cleanup policy is finalized
```
