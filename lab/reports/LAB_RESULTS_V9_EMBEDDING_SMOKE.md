# semantic-search lab v9: how does remote ranking logic work?
repo: /Users/bean/Documents/Develope/Ultra-lab/tilth
scope: src
intent: general; kind: general; keywords: ['ranking', 'remote', 'rank']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 183.7; top_gap: 32.1; top_file_cluster: 2; path_keyword_coverage: 0.33
## Commands executed
- [ok, 7ms] sqlite-fts-prf: sqlite-fts search 'how does remote ranking logic work?' --scope src
- [ok, 1493ms] embedding-index: potion-code-16M vector-search 'how does remote ranking logic work?' --scope src
- [ok, 34ms] symbol-glob: srcwalk discover '*ranking*' --as symbol --scope src --limit 12 --budget 2500
- [ok, 34ms] fusion-symbol-ranking: srcwalk discover '*ranking*' --as symbol --scope src --limit 8 --budget 2200
- [ok, 9ms] fusion-file-ranking: srcwalk discover '*ranking*' --as file --scope src --limit 8 --budget 1800
- [ok, 34ms] fusion-symbol-remote: srcwalk discover '*remote*' --as symbol --scope src --limit 8 --budget 2200
- [ok, 8ms] fusion-file-remote: srcwalk discover '*remote*' --as file --scope src --limit 8 --budget 1800
- [ok, 39ms, matches=8] fusion-symbol-rank: srcwalk discover '*rank*' --as symbol --scope src --limit 8 --budget 2200
- [ok, 8ms] fusion-file-rank: srcwalk discover '*rank*' --as file --scope src --limit 8 --budget 1800

## Notes
- v9 cache hit for scope `src`: 613 chunks, 2.50MB under /tmp/pi-srcwalk-v9-cache/82c544ec30609abc2f3f, prepare 2ms, query 7ms.
- v9 embedding cache built: 613 vectors, 0.30MB under /tmp/pi-srcwalk-v9-cache/82c544ec30609abc2f3f/embeddings.potion-code-16m.float16.npy.
- potion-code-16M full embedding cache produced optional RRF rank; query_encode=0ms total=1493ms.
- v8 RRF fused ranks: bm25-prf(36), srcwalk(9), embedding(16)

## Best candidates
1. `src/search/rank.rs:1` — score=183.7, source=rrf-fusion, kind=file
2. `src/search/rank.rs:351-430` — score=151.6, source=rrf-fusion, kind=chunk
3. `src/search/rank/tests.rs:1` — score=148.2, source=rrf-fusion, kind=file

## Evidence expansion
### Expansion 1: context:src/search/rank.rs:1 (ok, 14ms)
```text
# Context Packet: src/search/rank.rs:1
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/search/rank.rs:1-1

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- none

### Callers
- not available for non-symbol range targets

> Caveat: static context packet is capped; verify exact edges with trace commands.

> Next: srcwalk show src/search/rank.rs:1-1 -C 20
```

### Expansion 2: context:src/search/rank.rs:351-430 (ok, 16ms)
```text
# Context Packet: src/search/rank.rs:351-430
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/search/rank.rs:351-430

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L354 path_lower = m.path.to_string_lossy().to_ascii_lowercase()
- L355 text_lower = m.text.to_ascii_lowercase()
- L356 haystack = format!("{path_lower} {text_lower}")
- L361 matched = words
- L363 words.len()
- L365 words.len()
- L376 ext = path.extension().and_then(|e| e.to_str()).unwrap_or(arg1="")
- L379 has_docs_component = path.components().any(arg1=|c| { c.as_os_str() .to_str() .is_some_and(|s| s == "docs" || s == "doc") })
- L387 path_str = path.to_string_lossy()
- L388 path_str.contains(arg1="example")
- L389 path_str.contains(
... (400 more chars)
```

### Expansion 3: context:src/search/rank/tests.rs:1 (ok, 13ms)
```text
# Context Packet: src/search/rank/tests.rs:1
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/search/rank/tests.rs:1-1

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- none

### Callers
- not available for non-symbol range targets

> Caveat: static context packet is capped; verify exact edges with trace commands.

> Next: srcwalk show src/search/rank/tests.rs:1-1 -C 20
```

