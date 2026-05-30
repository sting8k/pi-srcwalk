# Query Router Lab v5 Summary — CodeRankEmbed reranker

## What v5 tested

v5 adds `nomic-ai/CodeRankEmbed` as an optional reranker over the BM25/PRF candidate pool:

```text
query
→ v4 router / BM25 candidate pool
→ CodeRankEmbed rerank top-N chunks
→ srcwalk context/trace/deps expansion
```

It does **not** build a full vector index for the repo.

## Environment/dependencies

- `sentence-transformers`: installed
- `einops`: installed
- `psutil`: installed for RSS/CPU metrics
- Model: `nomic-ai/CodeRankEmbed` via `SentenceTransformer(..., trust_remote_code=True, device="cpu")`

## Full lab result

Default pool size 16:

```text
PASS=17, PARTIAL=0, FAIL=0, elapsed=192529ms
/usr/bin/time -l:
  real: 193.98s
  user: 219.75s
  sys: 114.75s
  max resident set size: 10461511680 bytes (~9.7GiB)
  peak memory footprint: 11112113216 bytes (~10.4GiB)
```

Pool size 4:

```text
PASS=17, PARTIAL=0, FAIL=0, elapsed=66621ms
/usr/bin/time -l:
  real: 68.00s
  user: 80.34s
  sys: 21.33s
  max resident set size: 3550609408 bytes (~3.3GiB)
  peak memory footprint: 2780406592 bytes (~2.6GiB)
```

## Embedding compute metrics

Default pool size 16, 6 embedding rerank calls:

```text
embedding-rerank wall time: min 8418ms, avg 25638ms, max 60742ms
model load: min 0ms, avg 1739ms, max 10434ms
encode time: min 8416ms, avg 23870ms, max 60721ms
script-reported RSS after rerank: min 1213.8MB, avg 2311.2MB, max 3440.2MB
```

Pool size 4, 6 embedding rerank calls:

```text
embedding-rerank wall time: min 1960ms, avg 4751ms, max 17121ms
model load: min 0ms, avg 1922ms, max 11531ms
encode time: min 1951ms, avg 2820ms, max 5588ms
script-reported RSS after rerank: min 1527.2MB, avg 2368.7MB, max 3145.2MB
```

Note: `/usr/bin/time -l` reports higher process peak than script RSS snapshots. Treat the `time -l` peak as the safer upper bound.

## Quality observations

Compared with v4 BM25/PRF:

- Improved or more plausible:
  - `how does model pricing cost calculation work?` stayed in `framework/modelcatalog/pricing.go`.
  - `how does remote control server start?` pool16 promoted `EntryPoint.cs:491-570` / `EnsureServerAsync`.
  - `tests for InitializeComponent analyzer` stayed strongly in `UnoInitializeComponentAnalyzerTests.cs`.
  - `how does discover rank results?` improved from broad CLI/run code to `src/commands/find.rs` discover implementation.
- Not clearly improved:
  - `tests for semantic cache` still ranked Anthropic integration tests, not a clearly semantic-cache-specific target.
  - `where is unicorn payment teleport implemented?` is intentionally nonsense/no-result-ish; reranker still picked plausible-but-wrong provider/docs chunks.
- Pool size matters:
  - pool16 quality was better than pool4 for `remote control server start`.
  - pool4 was much cheaper but quality drifted more on broad queries.

## Practical conclusion

CodeRankEmbed works, but CPU/local cost is high for a lightweight agent wrapper:

```text
v3 router-only:       ~8s full lab
v4 BM25/PRF cold:     ~37s full lab; warm BM25 queries cheap
v5 CodeRank pool16:   ~194s full lab; peak around 10GiB by time -l
v5 CodeRank pool4:    ~68s full lab; peak around 3GiB by time -l
```

## Decision

Do **not** make CodeRankEmbed the default path for MVP.

Recommended production design:

```text
Default:
  srcwalk router + BM25/PRF + srcwalk evidence expansion

Optional fallback:
  CodeRankEmbed only when:
    - query is broad/natural-language/conceptual
    - BM25/srcwalk confidence is low
    - user enables local embedding mode
    - preferably in a warm daemon/server process
```

If using CodeRankEmbed locally:

- keep BM25 pool small (4-8) unless quality demands more
- run as a warm process/daemon to amortize model load
- cap chunk length aggressively
- measure peak RSS on the target machine
- consider a lighter model (`potion-code-16M`) for default local mode
