# Query Router Lab v4 Summary — BM25/PRF, no embeddings

## What changed from v3

v3:

```text
query -> multi-strategy srcwalk commands -> parse/rank -> context/trace/deps
```

v4:

```text
query
  -> code-aware tokenizer
  -> BM25 first pass
  -> pseudo relevance feedback (repo-derived terms)
  -> BM25 second pass
  -> merge with selected srcwalk strategies
  -> srcwalk context/trace/deps evidence expansion
```

No embedding model and no manual synonym dictionary were used.

## Retrieval approach

- Tokenization splits `camelCase`, `PascalCase`, `snake_case`, paths, and extensions.
- Morphology is generic only: `ranking -> rank`, `tests -> test`, etc.
- Expansion is corpus-derived:
  1. Run BM25 once.
  2. Take top chunks.
  3. Extract salient high-IDF terms from those chunks.
  4. Search again with original query + derived terms.
- BM25 uses an inverted index, not per-query full chunk scan.

## Full lab result

Same 17 cases as v3:

```text
PASS=17, PARTIAL=0, FAIL=0
```

Cold CLI run:

```text
v3:  8.25s
v4: 37.5s
```

Warm in-process run with BM25 indexes cached:

```text
v4 warm: 7.8s
```

## Performance finding

Cold v4 is slower because it builds indexes for large scopes:

```text
Bifrost framework: 889 chunks, ~0.57s
Bifrost tests:     1194 chunks, ~0.69s
Bifrost .:         10871 chunks, ~10.7s
Uno src:           32805 chunks, ~17.8s
srcwalk src:       613 chunks, ~0.32s
```

After index build, query time is low. Example on Uno `src`:

```text
cold bm25: ~17.8s including index build
warm bm25: ~29-38ms
```

## Quality finding

BM25/PRF improved some noisy v3 cases:

- `tests for semantic cache` no longer chooses lockfile/package-lock first.
- `tests for InitializeComponent analyzer` ranks analyzer tests strongly.
- `how does model pricing cost calculation work?` stays in pricing code.

But BM25-only is still not true semantic search:

- It cannot understand concepts without lexical overlap.
- Broad queries can still rank adjacent-but-not-perfect chunks.
- PRF can drift if first-pass BM25 is off.

## Practical conclusion

BM25/PRF is practical only if indexes are cached.

Recommended MVP path:

```text
1. Keep v3 srcwalk router as default.
2. Add BM25/PRF as an optional retriever for broad natural-language/test/definition queries.
3. Persist index on disk per repo/scope.
4. Use srcwalk for all evidence expansion.
```

Do not build BM25 index on every tool call. For an agent extension, use:

```text
semantic-search index --scope <scope>   # explicit or lazy first use
semantic-search query ...               # warm query path
```

## Decision

Minimal/no-embedding path is viable:

```text
BM25 + code-aware tokenizer + PRF + srcwalk expansion
```

But production must include persistent index caching and should not replace srcwalk routing entirely.
