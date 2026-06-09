# Changelog

All notable changes to this project are documented here.

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
