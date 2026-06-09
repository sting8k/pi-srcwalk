# Changelog

All notable changes to this project are documented here.

## [1.1.0] - 2026-06-09

### Added
- `semantic_search` now supports a small QueryIR layer for structured hints such as `file:`, `path:`, `sym:`, `symbol:`, `lang:`, `content:`, `test:`, and `-test`.
- Added Zoekt-inspired code-aware ranking signals for path, basename, symbol, test, generated/vendor, and language-aware candidate ordering.

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
