# Query Router Lab v7 Summary — quality benchmark + confidence gate

## What changed from v6

v6 still reported pipeline-style pass/fail. v7 changes the lab to evaluate quality:

```text
query
→ srcwalk router + BM25/PRF
→ optional guarded embedding rerank
→ extra candidate-pool fusion for weak broad queries
→ confidence / abstain gate
→ srcwalk evidence expansion
→ expected-target benchmark
```

New file:

```text
router_lab_v7.py
LAB_RESULTS_V7.md
LAB_RESULTS_V7_SUMMARY.md
```

## New benchmark semantics

Each case now has one of:

```text
expected targets/path substrings
or
should_abstain=True
```

Metrics:

```text
Hit@1
Hit@3
MRR
AbstainOK
```

Important caveat: for structural queries like `overview` and `trace callers`, v7 can count a match from evidence/command output, not only from candidate targets. This is intentional because those commands may answer without producing a normal code candidate.

## Full result

Command:

```bash
python3 router_lab_v7.py --lab > LAB_RESULTS_V7.md
```

Result:

```text
Total cases: 17
Hit@1=16/16
Hit@3=16/16
MRR=1.000
AbstainOK=17/17
elapsed=56758ms
```

There are 16 retrieval cases plus 1 expected abstain case.

## Fixes validated

### 1. No-result / weak-result abstention

Synthetic no-result case:

```text
where is unicorn payment teleport implemented?
```

v7 now abstains:

```text
Abstained: implementation query produced no code candidates.
```

This fixes the previous misleading behavior where v4/v6 returned weak docs/provider hits and still counted PASS.

### 2. Embedding drift guard

Smoke command:

```bash
python3 router_lab_v7.py --lab --only-repo bifrost --limit 4 --embedding
```

For:

```text
how does model pricing cost calculation work?
```

v7 skips embedding when BM25 already has a strong cluster:

```text
Embedding skipped: BM25 cluster ... prevents embedding drift over strong BM25 evidence.
Fusion skipped: BM25 cluster ... preserves strong BM25 cluster.
```

This addresses the v6 drift where potion rerank could pull a strong BM25 pricing result toward adjacent-but-worse files.

### 3. Better candidate-pool fusion

For broad weak query:

```text
how does discover rank results?
```

v7 adds file/symbol fusion and now promotes:

```text
src/search/rank.rs:1
```

This fixes the earlier issue where BM25-only results stayed around CLI/find flow instead of the ranking module.

### 4. Overview handling

Overview queries no longer fail/abstain just because `overview` returns structural output rather than parseable candidates.

## Remaining caveats

- The 17-case benchmark is still small and hand-labeled.
- Hit@1=16/16 should not be read as general semantic quality; it means the current expected set is satisfied.
- Evaluation is now more honest than v3-v6, but it can still be gamed by loose expected substrings.
- Need a larger benchmark with 30-50 cases and stricter expected targets before product claims.

## Practical conclusion

The current best design is still:

```text
Default:
  srcwalk router + BM25/PRF + confidence gate + evidence expansion

Optional:
  guarded potion-code-16M rerank only for weak broad queries

Avoid:
  embedding primary retrieval
  expanding weak results without abstention
```

Next useful work:

```text
1. Convert v7 lab into a small reusable benchmark harness.
2. Add 30-50 expected-target cases.
3. Persist BM25 index cache.
4. Keep embedding disabled by default, guarded by confidence.
```
