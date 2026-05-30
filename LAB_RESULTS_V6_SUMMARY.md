# Query Router Lab v6 Summary — potion-code-16M rerank

## What was tested

v6 keeps the v4/v5 architecture:

```text
query
→ srcwalk router + BM25/PRF candidate pool
→ optional embedding rerank for broad/general/test/definition queries
→ srcwalk context/trace/deps evidence expansion
```

Model tested:

```text
minishlab/potion-code-16M via model2vec StaticModel
```

No full vector index was built. The model reranked only the BM25/PRF pool.

## Environment/dependencies

- `model2vec`: installed
- `psutil`: installed for RSS/CPU metrics
- Model: `minishlab/potion-code-16M`
- Embedding dimension observed in smoke test: `256`

## Full lab result

Default pool size 16:

```text
PASS=17, PARTIAL=0, FAIL=0, elapsed=40504ms
/usr/bin/time -l:
  real: 41.54s
  user: 52.88s
  sys: 11.13s
  max resident set size: 1763786752 bytes (~1.64GiB)
  peak memory footprint: 1694290688 bytes (~1.58GiB)
```

Pool size 4:

```text
PASS=17, PARTIAL=0, FAIL=0, elapsed=42054ms
/usr/bin/time -l:
  real: 43.13s
  user: 54.98s
  sys: 10.01s
  max resident set size: 1761492992 bytes (~1.64GiB)
  peak memory footprint: 1690096256 bytes (~1.57GiB)
```

## Embedding compute metrics

Pool size 16, 6 embedding rerank calls:

```text
embedding-rerank wall time: min 14ms, avg 145.7ms, max 631ms
model load: min 0ms, avg 101.7ms, max 610ms
encode time: min 11ms, avg 14.5ms, max 17ms
script-reported RSS after rerank: min 199.8MB, avg 1035.9MB, max 1682.1MB
```

Pool size 4, 6 embedding rerank calls:

```text
embedding-rerank wall time: min 4ms, avg 121.2ms, max 653ms
model load: min 0ms, avg 107.8ms, max 647ms
encode time: min 3ms, avg 3.7ms, max 4ms
script-reported RSS after rerank: min 197.3MB, avg 1035.6MB, max 1679.9MB
```

Important: end-to-end lab time is still dominated by v4 BM25 cold index builds for large scopes, not by potion encode time.

## Comparison against v5 CodeRankEmbed

```text
v5 CodeRank pool16: ~193s, ~9.7–10.4GiB peak
v5 CodeRank pool4:  ~68s,  ~2.6–3.3GiB peak
v6 potion pool16:   ~41.5s, ~1.6GiB peak
v6 potion pool4:    ~43.1s, ~1.6GiB peak
```

potion-code-16M is much cheaper than CodeRankEmbed locally.

## Quality observations

potion-code-16M is fast, but quality is mixed versus BM25/PRF:

- It can improve some broad query ordering, e.g. `how does remote control server start?` moved a relevant `EnsureServerAsync` chunk to top.
- It keeps strong lexical/test cases usable, e.g. `tests for InitializeComponent analyzer` still ranks analyzer tests at top.
- It can drift on weak/noisy conceptual queries, e.g. `where is unicorn payment teleport implemented?` moved toward provider docs/Cerebras rather than clearly reporting no strong match.
- For several keyword-overlap queries, BM25/PRF alone was already strong; potion rerank did not clearly beat it.

## Practical conclusion

potion-code-16M is viable as a lightweight optional reranker, unlike CodeRankEmbed which is too heavy for default local use.

But it should not replace BM25/PRF or srcwalk routing:

```text
Default:
  srcwalk router + BM25/PRF + srcwalk evidence expansion

Optional lightweight embedding:
  potion-code-16M rerank for broad/general/test/definition queries
  only after BM25 has produced a candidate pool
```

## Decision

For MVP:

```text
Do not use embedding as the primary retriever.
Use potion-code-16M only as an optional reranker/fallback.
Keep srcwalk evidence expansion as the source of truth.
```

If enabled, prefer:

- small BM25 pool (`4–16`)
- confidence gates before reranking
- drift guard: do not allow embedding to select candidates with very weak BM25/source evidence
- persistent BM25 cache, because BM25 cold indexing still dominates runtime
