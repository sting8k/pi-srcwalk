# Changelog

All notable changes to this project are documented here.

## [2.0.0] - 2026-08-17

### Changed
- Replaced the five `semantic_*` tools with a single raw `srcwalk` passthrough tool: `args: string` is split quote-aware and passed straight to the CLI, with output returned verbatim.
- Removed the semantic engine entirely (BM25/PRF cache, router, ranking, grep pipeline, output formatting); the extension now depends only on a small runner, batch coordinator, and argument splitter.
- Removed the `semantic_*` contract injection into the system prompt; the extension now only cleans up the stale sentinel block from older installs.

### Added
- Batch multi-call: `args` accepts an array of up to 6 independent command lines, run concurrently (3 at a time) and returned in order with `--- $ srcwalk <cmd> ---` headers; no fail-fast.
- Shell metacharacter rejection (`|`, `>`, `<`, `;`, `&` outside quotes) with a hint to use the batch array instead.
- Missing-binary detection with actionable install instructions, and `[srcwalk exit N]` prefixes on non-zero exits.

## [1.2.8] - 2026-07-22

### Changed
- `semantic_query` default output now hides cache, command, timing, and ranking diagnostics while preserving the same candidate/evidence semantics; verbose formatting still includes diagnostics.
- `semantic_grep` now returns raw matches by default. Use `enrich: true` to opt into inspect enrichment for top matches.

### Added
- `semantic_grep` output now reports explicit coverage status, shown/match truncation, and unreadable-file counts so callers can distinguish incomplete searches from display truncation.

### Fixed
- Unreadable eligible grep files now mark coverage incomplete instead of falsely reporting complete coverage.

## [1.2.5] - 2026-06-26

### Changed
- `semantic_query` engine now runs independent srcwalk command batches and candidate expansions concurrently with bounded concurrency, while preserving the original command and expansion output order.
- BM25 scoring and PRF term selection use a bounded top-k partial selection instead of full sort, reducing per-query allocations.
- A short process-local fingerprint cache avoids re-walking and re-stating the scope file tree between warm queries within the TTL window.

### Notes
- Output and ranking semantics are unchanged on the same repository snapshot. Only `elapsedMs` and cache timing fields differ. The fingerprint TTL introduces a small staleness window (<1s) between file changes and the next search.

## [1.2.4] - 2026-06-26

### Changed
- Lazy-load `pi-srcwalk` tool implementations from each tool execution path so Pi startup and help rendering no longer eagerly load the search, grep, formatter, and srcwalk runner implementation graph.

## [1.2.3] - 2026-06-13

### Added
- `semantic_grep` now enriches the top 3 ranked matches with inspect packets by default, including context, flow map, callers, callees, and references.
- Added `enrich: false` opt-out to suppress enrichment and return raw grep output.
- Enrichment deduplicates inspected symbols and reports skipped targets with reasons.
- File-scoped grep enrichment uses parent scope for context/inspect resolution.

### Fixed
- Skipped enrichment entries are now surfaced instead of silently discarded when all targets are filtered out.

## [1.2.2] - 2026-06-12

### Added
- Added multi-scope `semantic_grep` support through `scopes`, including relative, parent-relative, and absolute search roots.
- Added canonical scope pruning, realpath-based file deduplication, and traversal/index resource caps for multi-scope grep.

### Fixed
- Updated the Pi tool schema to use the TypeBox array schema for `semantic_grep.scopes`.

## [1.2.1] - 2026-06-09

### Fixed
- Coordinated lazy cache builds with same-key single-flight and per-repo build queueing to avoid duplicate first-hit cache work.
- Propagated abort signals through cache preparation paths so cancelled callers do not hold build work unnecessarily.

### Added
- Added regression tests for cache build coordination, semantic grep metrics, and grouped formatter output.

## [1.2.0] - 2026-06-09

### Added
- Added `semantic_query` as the code-structure discovery tool, replacing `semantic_search`.
- Added `semantic_grep` for deterministic literal and regex search with trigram-index candidate pruning and full-scan fallback.
- Added grouped output for `semantic_query` candidates and evidence expansions, plus `semantic_grep` matches.

### Changed
- The Pi prompt contract now routes raw text and regex search to `semantic_grep` and code-intent discovery to `semantic_query`.
- Built-in `grep` is disabled via Pi active tools at `session_start` when the runtime supports it.
- `semantic_query` normal detail now uses compact evidence summaries; deep detail keeps full evidence blocks.

## [1.1.0] - 2026-06-09

### Added
- `semantic_search` now supports a small QueryIR layer for structured hints such as `file:`, `path:`, `sym:`, `symbol:`, `lang:`, `content:`, `test:`, and `-test`.
- Added code-aware ranking signals for path, basename, symbol, test, generated/vendor, and language-aware candidate ordering.

### Changed
- Hint commands are preserved during broad-query fusion so explicit user constraints stay in the retrieval pool.
- Search output now reports parsed QueryIR notes when structured hints are used.
- Negated hints such as `-file:vendor`, `-sym:Foo`, `-lang:ts`, and `-content:bar` now act as exclusion signals instead of positive filters.

## [1.0.1] - 2026-06-09

### Fixed
- `semantic_review` now detects nested git repos in `scope` and runs `srcwalk review` from the nested repo cwd.
- `semantic_review` details now preserve the requested scope while also reporting the effective nested-repo scope.

### Changed
- Release workflow now uses Node 24 for npm trusted publishing.
- Release workflow now creates a GitHub Release for each published tag.

## [1.0.0] - 2026-06-08

### Added
- Initial release of the four Pi tools: `semantic_search`, `semantic_inspect`, `semantic_show`, and `semantic_review`.
- npm-ready package metadata, release workflow, and Pi install instructions.
