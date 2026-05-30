# Query Router Lab v7 — Ghidra add-on benchmark

Repo:

```text
~/Documents/Develope/ghidra
```

Runner:

```text
router_lab_v7.py
```

## Result

```text
Total cases: 11
Retrieval cases: 10
Expected abstain cases: 1
Hit@1: 10/10
Hit@3: 10/10
MRR: 1.000
AbstainOK: 10/11
Elapsed: 47.7s
```

## Cases

| # | Query | Scope | Expected | Result |
|---|---|---|---|---|
| 1 | `Ghidra/.../DecompInterface.java:774` | `Ghidra/Features/Decompiler` | `DecompInterface.java` | PASS |
| 2 | `Ghidra/.../DecompInterface.java` | `Ghidra/Features/Decompiler` | `DecompInterface.java` | PASS |
| 3 | `DecompInterface` | `Ghidra/Features/Decompiler` | `DecompInterface.java` | PASS |
| 4 | `how does decompile function work?` | `Ghidra/Features/Decompiler/src/main/java` | `Decompiler.java` / `DecompilerManager.java` / `DecompInterface.java` | PASS |
| 5 | `who calls decompileFunction?` | `Ghidra/Features/Decompiler` | `decompileFunction` callers | PASS |
| 6 | `deps of .../DecompInterface.java` | `Ghidra/Features/Decompiler` | `DecompInterface.java` deps | PASS |
| 7 | `ProgramDB` | `Ghidra/Framework/SoftwareModeling` | `ProgramDB.java` | PASS |
| 8 | `how does program database manage memory and symbols?` | `Ghidra/Framework/SoftwareModeling/src/main/java` | `SymbolManager.java` / `ProgramDB.java` | PASS |
| 9 | `overview of Ghidra/Features/Decompiler` | `Ghidra/Features/Decompiler` | overview output | PASS |
| 10 | `tests for decompiler interface` | `Ghidra` | `test.cc` / `testfunction.cc` / decompiler tests | PASS |
| 11 | `where is unicorn quantum teleport patching implemented?` | `Ghidra` | should abstain | FAIL |

## Performance notes

```text
Exact/path/symbol/deps/overview cases: mostly tens to hundreds of ms.
BM25 narrow scope `Ghidra/Features/Decompiler/src/main/java`: 607 chunks, ~334ms cold.
BM25 medium scope `Ghidra/Framework/SoftwareModeling/src/main/java`: 5361 chunks, ~2.9s cold.
BM25 broad scope `Ghidra`: 50905 chunks, ~29s cold.
Broad scope reused in-process cache: later query ~14ms BM25 query after index already built.
```

## Quality notes

Good:

```text
- Structural cases remain strong on a very large Java/C++ repo.
- Narrow/medium BM25 scopes work well for natural-language topic queries.
- The broad query `tests for decompiler interface` found real decompiler test C++ files.
```

Problem found:

```text
The synthetic no-result implementation query did not abstain.
Query: where is unicorn quantum teleport patching implemented?
Returned: TypeApplierFactory.java chunks under Ghidra/Features/PDB/...
Reason: BM25 produced a strong same-file cluster from `patching`/`implemented`-adjacent text, and v7 confidence treated cluster/score as high even though path keyword coverage was 0.00.
```

## Recommendation from Ghidra run

Keep v7 direction, but tighten abstain/confidence for implementation queries:

```text
If intent is definition/implementation
AND path_keyword_coverage == 0
AND top candidates are only a BM25 same-file cluster
AND no candidate path/symbol contains domain keywords
THEN abstain or downgrade confidence, even if BM25 score/cluster is high.
```

Also avoid broad-scope BM25 by default on huge repos:

```text
Prefer narrowed scope first.
Use full `Ghidra` scope only for test/overview/fallback or after a scope hint.
Persistent BM25 cache is mandatory if full-scope search is enabled.
```
