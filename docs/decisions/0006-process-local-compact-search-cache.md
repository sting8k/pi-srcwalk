# 0006 Process-Local Compact Search Cache

Date: 2026-06-03

## Status

Accepted

## Context

`semantic_search` used a JSON disk cache under the OS temp directory for BM25/PRF indexes. Dogfood usage showed the cache root could grow to gigabytes across many repo/scope entries. A PrestaShop full-repo cache measured 111.56 MB on disk and the JSON object load path reached about 1.3 GB max RSS in the benchmark process.

The cache is an internal performance detail, not a user-facing contract. The desired behavior is bounded broad-query acceleration without leaving temp files behind.

## Decision

Use a process-local compact memory cache for TypeScript BM25/PRF indexes.

The retained index uses:

- path table + chunk line ranges + short previews.
- vocabulary strings + token-to-termId map.
- typed-array postings for BM25.
- typed-array doc-term lists for PRF.

The cache does not write chunk/index files to `/tmp`. It is bounded by LRU limits controlled by:

- `PI_SRCWALK_MEMORY_CACHE_ENTRIES` default `4`.
- `PI_SRCWALK_MEMORY_CACHE_MAX_MB` default `512`.

## Alternatives Considered

1. Keep JSON disk cache and add TTL/LRU cleanup.
   - Lower implementation churn, but still leaves temp files and still pays JSON parse/object overhead.
2. Pure no-cache rebuilds.
   - Simplest and lowest retained memory, but makes repeated broad queries slower.
3. Binary disk cache.
   - Could reduce disk and parse overhead, but adds more format complexity than needed now.

## Consequences

Positive:

- No automatic `/tmp/pi-srcwalk-ts-cache` growth from current runtime.
- Lower retained index size by avoiding full chunk text and duplicated token strings.
- Lower GC/object overhead by using typed arrays for postings and doc terms.
- Same-process repeated broad queries still get cache hits.

Tradeoffs:

- Cache is lost when the process exits.
- First query after restart rebuilds the index.
- Fingerprinting still scans files before deciding a same-process cache hit.
- Reported cache size is an estimate for retained compact index data, not total Node RSS.

## Follow-Up

- If benchmark coverage expands, add a dedicated cache benchmark script with repeated runs and multiple large repos.
- If process memory remains high for very large repos, consider compressed postings buffers or scope-aware cache admission.
