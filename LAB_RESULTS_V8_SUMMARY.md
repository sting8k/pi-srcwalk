# Query Router Lab v8 Summary — RRF Fusion

## What v8 tests

v8 changes v7's rough candidate merge into rank fusion:

```text
structural query
  -> srcwalk router
  -> srcwalk context/trace/deps evidence

broad/concept query
  -> BM25/PRF rank
  + srcwalk structural rank
  + optional potion-code-16M embedding rank
  -> RRF fusion
  -> confidence/abstain
  -> srcwalk evidence expansion
```

v8 still does **not** copy Semble as a pure retriever. It keeps `srcwalk` as the evidence engine.

## Files

```text
router_lab_v8.py
LAB_RESULTS_V8.md
LAB_RESULTS_V8_GHIDRA.md
LAB_RESULTS_V8_EMBEDDING.md
LAB_RESULTS_V8_SUMMARY.md
```

## Core 17-case result

Command:

```bash
python3 router_lab_v8.py --lab > LAB_RESULTS_V8.md
```

Result:

```text
Total cases: 17
Hit@1=16/16
Hit@3=16/16
MRR=1.000
AbstainOK=17/17
elapsed=52449ms
```

RRF was used in 3 broad cases. There was 1 expected abstain.

## Ghidra result

Command:

```bash
python3 router_lab_v8.py --lab --only-repo ghidra > LAB_RESULTS_V8_GHIDRA.md
```

Result:

```text
Total cases: 11
Hit@1=10/10
Hit@3=10/10
MRR=1.000
AbstainOK=11/11
elapsed=26407ms
```

Important fix vs v7:

```text
where is unicorn quantum teleport patching implemented?
```

v7 failed abstention on this Ghidra synthetic no-result case. v8 abstains by tightening implementation-query confidence:

```text
implementation query
+ code candidates exist
+ path/symbol keyword coverage = 0
-> abstain
```

## Optional embedding result

Command:

```bash
python3 router_lab_v8.py --lab --embedding --embed-pool 8 > LAB_RESULTS_V8_EMBEDDING.md
```

Result:

```text
Total cases: 17
Hit@1=16/16
Hit@3=16/16
MRR=1.000
AbstainOK=17/17
elapsed=54469ms
```

Embedding behavior:

```text
Embedding rank ran:     3 cases
Embedding rank skipped: 3 cases
RRF notes:              4 cases
```

Embedding is a rank source, not an override. Strong BM25 clusters still skip embedding to avoid drift.

## Design conclusion

v8 is better shaped than v7 because it replaces append-style merging with explicit RRF:

```text
v7: BM25 candidates + optional embedding rerank + append BM25 back
v8: BM25 rank + srcwalk structural rank + optional embedding rank -> RRF
```

Keep this direction for MVP:

```text
srcwalk router = structural/default path
BM25/PRF = default broad retriever
RRF = candidate fusion mechanism
potion-code-16M = optional rank source only when enabled/safe
srcwalk context/trace/deps = final evidence expansion
confidence/abstain = required guardrail
```

## Caveats

- Benchmark is still small and hand-labeled.
- RRF improved mechanism shape, not proof of strong semantic search.
- BM25 index caching and scope narrowing remain required for large repos.
- Current embedding rank is not a full persistent vector index; it reranks a BM25 pool. A production Semble-like embedding path would need cached chunk vectors.

## Verification

```bash
python3 -m py_compile router_lab_v8.py
python3 router_lab_v8.py --repo ~/Documents/Develope/Ultra-lab/tilth --scope src "how does discover rank results?"
python3 router_lab_v8.py --lab > LAB_RESULTS_V8.md
python3 router_lab_v8.py --lab --only-repo ghidra > LAB_RESULTS_V8_GHIDRA.md
python3 router_lab_v8.py --lab --embedding --embed-pool 8 > LAB_RESULTS_V8_EMBEDDING.md
```
