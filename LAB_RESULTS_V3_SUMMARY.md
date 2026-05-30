# Query Router Lab v3 — Complex Real-World Test Summary

## Goal

Validate whether a single-tool `semantic_search(query)` wrapper over `srcwalk` is practical under more realistic conditions than v2.

v3 tests the wrapper as an actual pipeline:

```text
query
  -> multi-strategy router
  -> srcwalk discover/show/context/deps/trace
  -> parse candidates
  -> rank candidates
  -> expand evidence
  -> formatted packet
```

## What changed from v2

v2 only tested whether one primary/fallback command produced output. v3 tests the real wrapper mechanism.

### v3 improvements

1. **Multi-strategy routing**
   - Exact target: `context`
   - File path: `show`
   - File deps: `deps`
   - Symbol: exact symbol -> lowercase -> glob -> text fallback
   - Natural language: text OR -> symbol glob -> overview fallback
   - Intent queries: symbol lookup -> context -> trace/deps/assess

2. **Candidate parsing**
   Parses only stable srcwalk evidence hints:
   - `> Next: srcwalk context ...`
   - `> Next: srcwalk show ...`
   - inline definitions: `[fn] Name path:line-range`
   - grouped definitions under a file
   - text-ranked files

3. **Ranking**
   Scores candidates using simple practical boosts:
   - exact symbol match
   - definition/context-target source
   - keyword/path match
   - test-file boost only for test queries
   - test-file penalty for normal queries

4. **Evidence expansion**
   Runs:
   - `srcwalk context <top target>`
   - `srcwalk trace callers <symbol>` for caller intent
   - `srcwalk trace callees <symbol> --detailed` for callee intent
   - `srcwalk deps <file>` for dependency intent

5. **Latency optimization**
   Stops early when strong structural evidence is found, especially for exact symbols and explicit targets.

## Test coverage

Real repos:

- `~/Documents/Develope/Bifrost/bifrost` — Go/TS project
- `~/Documents/Develope/uno` — very large C# repo
- `~/Documents/Develope/Ultra-lab/tilth` — srcwalk Rust repo

Cases: **17**

Covered query types:

- exact target: `file.go:line`
- file path
- exact symbol
- natural language topic
- callers intent
- callees intent
- deps intent
- tests/examples intent
- no-result / weak-result recovery
- overview query
- very large repo stress case

## Result

From `LAB_RESULTS_V3.md`:

```text
Summary: PASS=17, PARTIAL=0, FAIL=0, elapsed=8437ms
```

Average end-to-end time: about **0.5s/query** across the built-in test matrix.

## Important findings

### 1. The approach is more practical than v2 showed

v2 success rate was 75%. v3 reached 17/17 because it no longer treats routing as one brittle command. The key is:

```text
primary strategy + fallback strategies + parse/rank + evidence expansion
```

### 2. Query Router should not be pure if/else

The better shape is:

```text
classify intent
  -> generate 2-4 possible srcwalk strategies
  -> execute until enough strong evidence
  -> rank merged candidates
```

This avoids missing queries when one heuristic is wrong.

### 3. Exact target and file deps need special handling

Two bugs were found during v3:

- Exact target context output contains neighboring definitions; parser initially ranked those over the exact target.
- `deps of path/file.go` should call `deps` directly, not `show` or `context file:1`.

Both are fixed in `router_lab_v3.py`.

### 4. Overview output is useful even without candidates

Overview commands do not produce parseable `path:line` candidates, but they are valid final evidence packets. v3 treats successful overview as pass.

### 5. No embedding is required for MVP

Heuristics + srcwalk structural evidence are enough for a practical MVP. Embeddings/BM25 can improve related/semantic discovery later, but are not needed for first release.

## Recommended MVP flow

```text
semantic_search(query, repo, scope='.', max_results=3, detail='normal')
  1. classify intent
  2. build command plan
  3. run srcwalk commands with early-stop
  4. parse candidates from stable srcwalk hints
  5. rank candidates
  6. expand top evidence with context/trace/deps
  7. return raw-evidence-first packet
```

## Remaining risks

1. **Natural-language retrieval is still lexical**, not true semantic.
2. **Very broad text queries can return noisy candidates**; ranking mitigates but does not fully solve it.
3. **Symbol case sensitivity exists in srcwalk**, but lower/glob fallback handles most cases.
4. **Parsing relies on text packet format**, so wrapper should parse only stable hints and keep raw evidence fallback.

## Recommendation

Proceed to MVP implementation.

Minimum viable product should be based on `router_lab_v3.py`, split into modules:

```text
semantic_srcwalk/
  cli.py
  router.py
  runner.py
  parser.py
  ranker.py
  expander.py
  formatter.py
```

Then expose the single agent-facing tool:

```python
semantic_search(query: str, scope: str = '.', max_results: int = 3, detail: str = 'normal') -> str
```

MCP/tool integration should come after the CLI wrapper is stable.
