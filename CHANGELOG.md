# Changelog

All notable changes to this project are documented here.

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
