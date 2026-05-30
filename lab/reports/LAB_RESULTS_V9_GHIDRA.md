# Query Router Lab Test v9 - Persistent /tmp Cache + RRF Quality Benchmark

Cache root: `/tmp/pi-srcwalk-v9-cache`
Total cases: 11
Summary: Hit@1=10/10, Hit@3=10/10, MRR=1.000, AbstainOK=11/11, elapsed=22897ms


---

## Case 1: ghidra — PASS
# semantic-search lab v9: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774
repo: /Users/bean/Documents/Develope/ghidra
scope: .
intent: general; kind: explicit_target; keywords: ['DecompInterface', 'Decompiler', 'Features', 'feature', 'Ghidra']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 135.0; top_gap: 50.0; top_file_cluster: 3; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 177ms] target-context: srcwalk context Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774 --scope . --budget 3500

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774` `decompileFunction` — score=135.0, source=exact-context, kind=context-target
2. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:354-361` `verifyProcess` — score=85.0, source=definition, kind=fn
3. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:714-730` `flushCache` — score=85.0, source=definition, kind=fn

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774 (ok, 160ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774-839 decompileFunction

## Flow Map
shape: 1 entry, 4 decisions, 0 loops, 2 exits, 10 actions
N1 entry :774-839 entry
  definitions: func parameter :774; timeoutSecs parameter :774; monitor parameter :775
  next -> N2 action :777 dtmanage.clearTemporaryIds()
N2 action :777 dtmanage.clearTemporaryIds()
  calls: dtmanage.clearTemporaryIds :777
  next -> N3 action :778 decompileMessage = ""
N3 action :778 decompileMessage = ""
  writes: decompileMessage assignment_lhs :778
  next -> N4 decision :780-783 (program == null || (monitor != null && monitor.isCancelled()))
N4 decision :780-783 (program == nul
... (5529 more chars)
```

### Expansion 2: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:354-361 (ok, 145ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:354-361
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:354-361 verifyProcess

## Flow Map
shape: 1 entry, 2 decisions, 0 loops, 2 exits, 1 action
N1 entry :354-361 entry
  next -> N2 decision :355-357 ((decompProcess == null) || (!decompProcess.isReady()))
N2 decision :355-357 ((decompProcess == null) || (!decompProcess.isReady()))
  reads: decompProcess condition :355; isReady condition :355
  true -> N3 action :356 initializeProcess()
  false -> N4 decision :358-360 (!decompProcess.isReady())
N3 action :356 initializeProcess()
  calls: initializeProcess :356
  next -> N4 decision :358-360 (!decompProcess.isReady())
N4 decision :358-360 (!decompProces
... (2157 more chars)
```

### Expansion 3: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:714-730 (ok, 157ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:714-730
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:714-730 flushCache

## Flow Map
shape: 1 entry, 1 decision, 0 loops, 2 exits, 3 actions
N1 entry :714-730 entry
  next -> N2 action :715 int res = -1;
N2 action :715 int res = -1;
  writes: res = -1 assignment_lhs :715
  next -> N3 decision :717-720 ((decompProcess != null) && decompProcess.isReady())
N3 decision :717-720 ((decompProcess != null) && decompProcess.isReady())
  reads: decompProcess condition :717; isReady condition :717
  true -> N4 action :718 decompProcess.sendCommand("flushNative", stringResponse)
  false -> N6 action :728 stopProcess()
N4 action :718 decompProcess.sendCommand("fl
... (1802 more chars)
```


---

## Case 2: ghidra — PASS
# semantic-search lab v9: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java
repo: /Users/bean/Documents/Develope/ghidra
scope: .
intent: general; kind: file; keywords: ['DecompInterface', 'Decompiler', 'Features', 'feature', 'Ghidra']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 128.0; top_gap: 128.0; top_file_cluster: 1; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 6ms] file-show: srcwalk show Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java --budget 3500
- [ok, 47ms] file-discover: srcwalk discover Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java --as file --scope . --limit 8 --budget 2500

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1` — score=128.0, source=file-discover, kind=file

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1 (ok, 14ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1-1

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- none

### Callers
- not available for non-symbol range targets

> Caveat: static context packet is capped; verify exact edges with trace commands.

> Next: srcwalk show Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1-1 -C 20
```


---

## Case 3: ghidra — PASS
# semantic-search lab v9: DecompInterface
repo: /Users/bean/Documents/Develope/ghidra
scope: .
intent: general; kind: symbol; keywords: ['DecompInterface']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 140.0; top_gap: 50.0; top_file_cluster: 2; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['DecompInterface.java', 'DecompInterface']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 336ms, matches=10] symbol-exact: srcwalk discover DecompInterface --as symbol --scope . --limit 10 --budget 3000
- [code=2, 652ms] symbol-lower: srcwalk discover decompinterface --as symbol --scope . --limit 10 --budget 2500
- [ok, 1816ms] symbol-glob: srcwalk discover '*decompinterface*' --as symbol --scope . --limit 10 --budget 2500
- [ok, 149ms, matches=10] symbol-text: srcwalk discover DecompInterface --as text --scope . --limit 10 --budget 2500

## Notes
- symbol-lower failed with code 2

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:82-1122` `DecompInterface` — score=140.0, source=definition, kind=class
2. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:160-179` `DecompInterface` — score=90.0, source=next-context, kind=context-target
3. `Ghidra/Features/BSim/ghidra_scripts/CompareBSimSignaturesScript.java:119-138` `generateVector` — score=75.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:82-1122 (ok, 17ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:82-1122
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:82-1122

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L97 mainQuery = new PatchPackedEncode()
- L98 mainResponse = new PackedDecode(arg1=program.getAddressFactory())
- L99 callbackQuery = new PackedDecode(arg1=program.getAddressFactory())
- L100 callbackResponse = new PatchPackedEncode()
- L111 mainQuery = new PackedEncodeOverlay(arg1=spc)
- L112 mainResponse = new PackedDecodeOverlay(arg1=program.getAddressFactory(), arg2=spc)
- L113 callbackQuery = new Packed
... (1993 more chars)
```

### Expansion 2: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:160-179 (ok, 152ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:160-179
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:160-179 DecompInterface

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
actions summarized :161-178 18 action nodes
  writes: program assignment_lhs :161; pcodelanguage assignment_lhs :162; dtmanage assignment_lhs :163; +15 more

## Exits
- :179 end

## Call Neighborhood
### Callees (ordered)
- none

### Callers
- [fn] SymPcodeExecutor Ghidra/Debug/Debugger/src/main/java/ghidra/app/plugin/core/debug/stack/SymPcodeExecutor.java:82
- [fn] PcodeFrontend.getUnitContext Ghidra/Extensions/Lisa/src/main/java/ghidra/lisa/pcode/PcodeFrontend.java:122
- [fn] CompareBS
... (971 more chars)
```

### Expansion 3: context:Ghidra/Features/BSim/ghidra_scripts/CompareBSimSignaturesScript.java:119-138 (ok, 138ms)
```text
# Context Packet: Ghidra/Features/BSim/ghidra_scripts/CompareBSimSignaturesScript.java:119-138
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/BSim/ghidra_scripts/CompareBSimSignaturesScript.java:119-138 generateVector

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
entry: N1 entry :119-138 entry
  definitions: f parameter :119; program parameter :119
action: N2 action :120 DecompInterface decompiler = new DecompInterface();
  writes: decompiler = new DecompInterface() assignment_lhs :120
action: N3 action :122 decompiler.setOptions(new DecompileOptions())
  calls: decompiler.setOptions :122

## Exits
- :138 end

## Call Neighborhood
### Callees (ordered)
- L120 decompiler = new DecompInterface()
- L122 decompiler.setOptions(arg1=new DecompileOptions())
- L123 decompiler.toggleSy
... (987 more chars)
```


---

## Case 4: ghidra — PASS
# semantic-search lab v9: how does decompile function work?
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
intent: general; kind: general; keywords: ['decompile']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 170.7; top_gap: 5.5; top_file_cluster: 1; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['decompile', 'Decompiler', 'DecompInterface']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 2306ms] sqlite-fts-prf: sqlite-fts search 'how does decompile function work?' --scope Ghidra/Features/Decompiler
- [ok, 214ms, matches=12] symbol-glob: srcwalk discover '*decompile*' --as symbol --scope Ghidra/Features/Decompiler --limit 12 --budget 2500

## Notes
- v9 cache built for scope `Ghidra/Features/Decompiler`: 3612 chunks, 19.34MB under /tmp/pi-srcwalk-v9-cache/f08144940240bbe4c1ee, prepare 2298ms, query 2306ms.
- Extra fusion skipped: BM25 cluster: 2/3 top candidates in Ghidra/Features/Decompiler/src/test.slow/java/ghidra/app/plugin/core/decompile/DecompilerEquateTest.java with keyword path hit; preserves strong BM25 cluster.
- v8 RRF fused ranks: bm25-prf(36), srcwalk(12)

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/Decompiler.java:46-58` `decompile` — score=170.7, source=rrf-fusion, kind=fn
2. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:94-111` `decompile` — score=165.2, source=rrf-fusion, kind=fn
3. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:172-177` `decompile` — score=164.8, source=rrf-fusion, kind=fn

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/Decompiler.java:46-58 (ok, 50ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/Decompiler.java:46-58
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/Decompiler.java:46-58 decompile

## Flow Map
shape: 1 entry, 2 decisions, 0 loops, 1 exit, 4 actions
N1 entry :46-58 entry
  definitions: program parameter :46; function parameter :46; debugFile parameter :46; +1 more
  next -> N2 action :48 getDecompilerInterface(program)
N2 action :48 getDecompilerInterface(program)
  calls: getDecompilerInterface :48
  writes: ifc = getDecompilerInterface(program) assignment_lhs :48
  reads: program call_arg :48
  next -> N3 decision :50-52 (debugFile != null)
N3 decision :50-52 (debugFile != null)
  reads: debugFile condition :50
  true -> N4 action :51 ifc.enableDebug
... (3127 more chars)
```

### Expansion 2: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:94-111 (ok, 48ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:94-111
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:94-111 decompile

## Flow Map
shape: 1 entry, 2 decisions, 0 loops, 3 exits, 4 actions
N1 entry :94-111 entry
  definitions: program parameter :94; location parameter :94; viewerPosition parameter :95; +2 more
  next -> N2 action :97-98 DecompileRunnable newDecompileRunnable = new DecompileRunnable(program, location, debugFile, vi…
N2 action :97-98 DecompileRunnable newDecompileRunnable = new DecompileRunnable(program, location, debugFile, vi…
  writes: newDecompileRunnable = new DecompileRunnable(program, location, debugFile, viewerPosition, this) assignment_lhs :97
  next -
... (3539 more chars)
```

### Expansion 3: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:172-177 (ok, 52ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:172-177
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:172-177 decompile

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
entry: N1 entry :172-177 entry
  definitions: program parameter :172; functionToDecompile parameter :172; debugFile parameter :172; +1 more
actions: none structurally detected

## Exits
- :175 return decompiler.decompile(program, functionToDecompile, debugFile, monitor);

## Call Neighborhood
### Callees (ordered)
- L175 ->ret decompiler.decompile(arg1=program, arg2=functionToDecompile, arg3=debugFile, arg4=monitor)

### Resolved local callees
  [fn] decompile Ghidra/Fe
... (1680 more chars)
```


---

## Case 5: ghidra — PASS
# semantic-search lab v9: who calls decompileFunction?
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
intent: callers; kind: intent_symbol; keywords: ['decompileFunction']

## Confidence
- level: high
- abstained: False
- reason: structural intent query
- top_score: 135.0; top_gap: 0.0; top_file_cluster: 1; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['decompileFunction']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 51ms, matches=10] symbol-exact: srcwalk discover decompileFunction --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 3000
- [code=2, 37ms] symbol-lower: srcwalk discover decompilefunction --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 2500
- [ok, 178ms] symbol-glob: srcwalk discover '*decompilefunction*' --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 2500
- [ok, 164ms, matches=3493] text-any: srcwalk discover decompileFunction,calls,call --match any --as text --scope Ghidra/Features/Decompiler --limit 10 --budget 3000

## Notes
- symbol-lower failed with code 2

## Best candidates
1. `Ghidra/Features/Decompiler/ghidra_scripts/ShowCCallsScript.java:147-162` `decompileFunction` — score=135.0, source=definition, kind=fn
2. `Ghidra/Features/Decompiler/ghidra_scripts/ShowConstantUse.java:1030-1043` `decompileFunction` — score=135.0, source=definition, kind=fn
3. `Ghidra/Features/Decompiler/ghidra_scripts/StringParameterPropagator.java:626-649` `decompileFunction` — score=135.0, source=definition, kind=fn

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/ghidra_scripts/ShowCCallsScript.java:147-162 (ok, 24ms)
```text
# Context Packet: Ghidra/Features/Decompiler/ghidra_scripts/ShowCCallsScript.java:147-162
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/ghidra_scripts/ShowCCallsScript.java:147-162 decompileFunction

## Flow Map
shape: 1 entry, 1 decision, 0 loops, 2 exits, 3 actions
N1 entry :147-162 entry
  definitions: f parameter :147; decomplib parameter :147
  next -> actions summarized :152-156 3 action nodes
actions summarized :152-156 3 action nodes
  calls: decomplib.decompileFunction :152; decompRes.getHighFunction :155; decompRes.getCCodeMarkup :156
  writes: decompRes = decomplib.decompileFunction(f, decomplib.getOptions().getDefaultTimeout(), monitor) assignment_lhs :151; hfunction assignment_lhs :155; docroot assignment_lhs :156
  reads: f call_arg :152; decomplib call_arg :152; getOptions call_arg :152; +2 m
... (1976 more chars)
```

### Expansion 2: trace-callers:decompileFunction (ok, 23ms)
```text
# Trace callers: decompileFunction — 26 call sites

[symbol] decompileFunction
<- calls
  [fn] GraphASTScript.buildAST Ghidra/Features/Decompiler/ghidra_scripts/GraphASTScript.java:84 prefix=ifc(var) args=3
  [fn] ShowCCallsScript.decompileFunction Ghidra/Features/Decompiler/ghidra_scripts/ShowCCallsScript.java:152 prefix=decomplib(var) args=3
  [fn] ShowConstantUse.decompileFunction Ghidra/Features/Decompiler/ghidra_scripts/ShowConstantUse.java:1034 prefix=decompInterface(var) args=3
  [fn] StringParameterPropagator.decompileFunction Ghidra/Features/Decompiler/ghidra_scripts/StringParameterPropagator.java:633 prefix=decompInterface(var) args=3
  [fn] WindowsResourceReference.decompileFunction Ghidra/Features/Decompiler/ghidra_scripts/WindowsResourceReference.java:438 prefix=decompiler(var) args=3
  [fn] DecompilerScriptUtils.getHighFunction Ghidra/Features/Decompiler/ghidra_scripts/clas
... (3393 more chars)
```


---

## Case 6: ghidra — PASS
# semantic-search lab v9: deps of Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java
repo: /Users/bean/Documents/Develope/ghidra
scope: .
intent: deps; kind: file_deps; keywords: ['DecompInterface', 'Decompiler', 'Features', 'feature', 'Ghidra']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 85.0; top_gap: 85.0; top_file_cluster: 1; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 68ms] file-deps: srcwalk deps Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java --budget 3500

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1` — score=85.0, source=file-deps, kind=file

## Evidence expansion
### Expansion 1: deps:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java (ok, 49ms)
```text
# Deps: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java — 0 local, 16 external, 4 dependents

## Uses (local)
(none)

## Uses (external)
generic.jar.ResourceFile
ghidra.app.decompiler.signature.DebugSignature
ghidra.app.decompiler.signature.SignatureResult
ghidra.app.plugin.processors.sleigh.*
ghidra.program.model.address.*
ghidra.program.model.lang.*
ghidra.program.model.listing.Function
ghidra.program.model.listing.Program
ghidra.program.model.pcode.*
ghidra.program.model.symbol.IdentityNameTransformer
ghidra.program.model.symbol.NameTransformer
ghidra.util.Msg
ghidra.util.task.CancelledListener
ghidra.util.task.TaskMonitor
java.io.*
java.util.ArrayList

## Used by
Ghidra/Debug/Debugger/src/main/java/ghidra/app/plugin/core/debug/stack/
  SymPcodeExecutor.java:71     SymPcodeExecutor.forProgram → getCompilerSpec
  SymPcodeExecutor.java:82     SymPcode
... (1423 more chars)
```


---

## Case 7: ghidra — PASS
# semantic-search lab v9: ProgramDB
repo: /Users/bean/Documents/Develope/ghidra
scope: .
intent: general; kind: symbol; keywords: ['ProgramDB']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 140.0; top_gap: 50.0; top_file_cluster: 3; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['ProgramDB']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 1479ms, matches=10] symbol-exact: srcwalk discover ProgramDB --as symbol --scope . --limit 10 --budget 3000
- [code=2, 661ms] symbol-lower: srcwalk discover programdb --as symbol --scope . --limit 10 --budget 2500
- [ok, 1755ms] symbol-glob: srcwalk discover '*programdb*' --as symbol --scope . --limit 10 --budget 2500
- [ok, 278ms, matches=10] symbol-text: srcwalk discover ProgramDB --as text --scope . --limit 10 --budget 2500

## Notes
- symbol-lower failed with code 2

## Best candidates
1. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:68-2545` `ProgramDB` — score=140.0, source=definition, kind=class
2. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:241-294` `ProgramDB` — score=90.0, source=next-context, kind=context-target
3. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:310-425` `ProgramDB` — score=90.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:68-2545 (ok, 37ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:68-2545
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:68-2545

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L243 new DBHandle()
- L246 new IllegalArgumentException(arg1="unsupported compilerSpec: " + compilerSpec.getClass().getName())
- L251 this.compilerSpec = ProgramCompilerSpec.getProgramCompilerSpec(arg1=this, arg2=compilerSpec)
- L253 languageID = language.getLanguageID()
- L254 compilerSpecID = compilerSpec.getCompilerSpecID()
- L255 languageVersion = language.getVersion()
- L256 languageMinorVersion =
... (2105 more chars)
```

### Expansion 2: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:241-294 (ok, 445ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:241-294
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:241-294 ProgramDB

## Flow Map
shape: 1 entry, 1 decision, 0 loops, 2 exits, 11 actions
N1 entry :241-294 entry
  definitions: name parameter :241; language parameter :241; compilerSpec parameter :241; +1 more
  next -> N2 decision :245-248 (!(compilerSpec instanceof BasicCompilerSpec))
N2 decision :245-248 (!(compilerSpec instanceof BasicCompilerSpec))
  reads: compilerSpec condition :245
  true -> N3 throw :246-247 throw new IllegalArgumentException( "unsupported compilerSpec: " + compilerSpec.getClass().getN…
  false -> actions summarized :250-293 11 action nodes
N3 throw :246-247 throw ne
... (4506 more chars)
```

### Expansion 3: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:310-425 (ok, 494ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:310-425
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:310-425 ProgramDB

## Flow Map
shape: 1 entry, 3 decisions, 0 loops, 2 exits, 5 actions
N1 entry :310-425 entry
  definitions: dbh parameter :310; openMode parameter :310; monitor parameter :310; +1 more
  next -> N2 decision :315-317 (monitor == null)
N2 decision :315-317 (monitor == null)
  reads: monitor condition :315
  true -> N3 action :316 monitor = TaskMonitor.DUMMY
  false -> N4 decision :319-321 (openMode == null || openMode == OpenMode.CREATE)
N3 action :316 monitor = TaskMonitor.DUMMY
  writes: monitor assignment_lhs :316
  reads: TaskMonitor.DUMMY assignment_rhs :316
  next -> N4
... (5405 more chars)
```


---

## Case 8: ghidra — PASS
# semantic-search lab v9: how does program database manage memory and symbols?
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Framework
intent: general; kind: general; keywords: ['database', 'program', 'symbols', 'manage', 'memory']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 146.0; top_gap: 4.0; top_file_cluster: 1; path_keyword_coverage: 0.60

## Quality expectation
- expected: ['ProgramDB', 'database', 'symbol']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 8783ms] sqlite-fts-prf: sqlite-fts search 'how does program database manage memory and symbols?' --scope Ghidra/Framework
- [ok, 457ms, matches=12] symbol-glob: srcwalk discover '*database*' --as symbol --scope Ghidra/Framework --limit 12 --budget 2500

## Notes
- v9 cache built for scope `Ghidra/Framework`: 16066 chunks, 65.05MB under /tmp/pi-srcwalk-v9-cache/292f4594d89ab0d44005, prepare 8762ms, query 8783ms.
- Extra fusion skipped: BM25 cluster: 3/3 top candidates in Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/model/symbol/SymbolTable.java with keyword path hit; preserves strong BM25 cluster.

## Best candidates
1. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolDatabaseAdapter.java:351-430` — score=146.0, source=sqlite-fts-prf, kind=chunk
2. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:1121-1200` — score=142.0, source=sqlite-fts-prf, kind=chunk
3. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/model/symbol/SymbolTable.java:351-430` — score=138.0, source=sqlite-fts-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolDatabaseAdapter.java:351-430 (ok, 10ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolDatabaseAdapter.java:351-430
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolDatabaseAdapter.java:351-430

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- none

### Callers
- not available for non-symbol range targets

> Caveat: static context packet is capped; verify exact edges with trace commands.

> Next: srcwalk show Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolDatabaseAdapter.java:351-430 -C 20
```

### Expansion 2: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:1121-1200 (ok, 43ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:1121-1200
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:1121-1200

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L1127 checkValidNamespaceArgument(arg1=library)
- L1129 lock.acquire()
- L1131 matchLibraryId = library.getID()
- L1132 recordIter = adapter.getExternalSymbolsByOriginalImportName(arg1=extLabel)
- L1133 ->ret new SymbolRecordConstraintIterator(arg1=recordIter, arg2=rec -> { if (matchLibraryId > 0) { long parentId = rec.getLongValue(Symb … ID() == matchLibraryId; } return true;
... (1436 more chars)
```

### Expansion 3: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/model/symbol/SymbolTable.java:351-430 (ok, 8ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/model/symbol/SymbolTable.java:351-430
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/model/symbol/SymbolTable.java:351-430

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- none

### Callers
- not available for non-symbol range targets

> Caveat: static context packet is capped; verify exact edges with trace commands.

> Next: srcwalk show Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/model/symbol/SymbolTable.java:351-430 -C 20
```


---

## Case 9: ghidra — PASS
# semantic-search lab v9: overview of Ghidra/Features/Decompiler
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
intent: overview; kind: overview; keywords: ['Decompiler', 'Features', 'feature', 'Ghidra']

## Confidence
- level: high
- abstained: False
- reason: overview query returns structural overview output without candidate targets
- top_score: 0.0; top_gap: 0.0; top_file_cluster: 0; path_keyword_coverage: 0.00

## Quality expectation
- expected: ['Ghidra/Features/Decompiler']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 70ms] overview: srcwalk overview --scope Ghidra/Features/Decompiler --symbols

## Best candidates
- none parsed

## Evidence expansion
### Expansion 1: overview (ok, 70ms)
```text
# Overview: Ghidra/Features/Decompiler (depth auto→2, sizes ~= tokens)
# Note: respects .gitignore, .git/info/exclude, core.excludesFile, .ignore (+ parents); dotfiles included; built-in SKIP_DIRS still apply (target, node_modules, …). Use `srcwalk <path>` to inspect an ignored file directly.
src/  ~1.7M
  decompile/  ~1.4M
  main/  ~287.2k
  test.slow/  ~52.4k
ghidra_scripts/  ~225.9k
  classrecovery/  ~175.9k
    RecoveredClassHelper.java: class RecoveredClassHelper@50-8951, fn RecoveredClassHelper@153-181, fn updateVftableToClassMap@183-187, ... +96
    RTTIGccClassRecoverer.java: class RTTIGccClassRecoverer@45-4922, fn RTTIGccClassRecoverer@107-122, fn containsRTTI@124-139, ... +96
    RTTIWindowsClassRecoverer.java: class RTTIWindowsClassRecoverer@39-2847, fn RTTIWindowsClassRecoverer@73-82, fn containsRTTI@84-92, ... +56
    ExtendedFlatProgramAPI.java: class ExtendedFlatProgramAPI
... (3475 more chars)
```


---

## Case 10: ghidra — PASS
# semantic-search lab v9: tests for decompiler interface
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
intent: test; kind: test; keywords: ['decompiler', 'interface']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 142.6; top_gap: 4.4; top_file_cluster: 3; path_keyword_coverage: 0.50

## Quality expectation
- expected: ['test', 'Decompiler', 'DecompInterface']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 16ms] sqlite-fts-prf: sqlite-fts search 'tests for decompiler interface' --scope Ghidra/Features/Decompiler
- [ok, 182ms, matches=3775] test-text: srcwalk discover decompiler,interface,tests,test --match any --as text --scope Ghidra/Features/Decompiler --limit 12 --budget 3000
- [ok, 180ms, matches=12] test-symbol: srcwalk discover '*decompiler*' --as symbol --scope Ghidra/Features/Decompiler --limit 12 --budget 2500

## Notes
- v9 cache hit for scope `Ghidra/Features/Decompiler`: 3612 chunks, 19.34MB under /tmp/pi-srcwalk-v9-cache/f08144940240bbe4c1ee, prepare 8ms, query 16ms.
- Extra fusion skipped: BM25 cluster: 3/3 top candidates in Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc with keyword path hit; preserves strong BM25 cluster.
- v8 RRF fused ranks: bm25-prf(36), srcwalk(24)

## Best candidates
1. `Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:211-290` — score=142.6, source=rrf-fusion, kind=chunk
2. `Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:71-150` — score=138.2, source=rrf-fusion, kind=chunk
3. `Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:141-220` — score=133.8, source=rrf-fusion, kind=chunk

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:211-290 (ok, 40ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:211-290
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:211-290

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L223 mergeTestAdjacent(arg1=high_out, arg2=high_in)
- L226 high_out->isPersist()
- L227 high_in->isPersist()
- L229 high_out->isInput()
- L230 high_in->isInput()
- L232 high_out->isAddrTied()
- L233 high_in->isAddrTied()
- L244 vn->hasCover()
- L244 vn->isImplied()
- L246 LowlevelError(arg1="Cannot force merge of range")
- L259 vn->hasCover()
- L260 vn->isImplied()
- ... 15 more call sites

### Callers
- not available for non-symbol range targets

> Caveat: static co
... (153 more chars)
```

### Expansion 2: context:Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:71-150 (ok, 39ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:71-150
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:71-150

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L71 list <LoadGuard>::const_iterator = storeGuard.begin()
- L71 storeGuard.end()
- L72 (*iter).isValid(arg1=CPUI_STORE)
- L73 addOp(arg1=(*iter).getOp())
- L75 finalize()
- L81 op->code()
- L82 const = data.getStoreGuard(arg1=op)
- L85 ->ret loadGuard->isGuarded(arg1=vn->getAddr())
- L107 high_in->isTypeLock()
- L108 high_out->isTypeLock()
- L109 high_in->getType()
- L109 high_out->getType()
- ... 25 more call sites

### Callers
- not available for non-symbol range tar
... (177 more chars)
```

### Expansion 3: context:Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:141-220 (ok, 39ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:141-220
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/decompile/cpp/merge.cc:141-220

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L142 high_out->isProtoPartial()
- L143 high_in->isInput()
- L144 high_in->isAddrTied()
- L145 high_in->isPersist()
- L148 VariableGroup = high_in->piece->getGroup()
- L149 VariableGroup = high_out->piece->getGroup()
- L153 high_in->piece->getSize()
- L153 groupIn->getSize()
- L153 high_out->piece->getSize()
- L153 groupOut->getSize()
- L157 Symbol = high_in->getSymbol()
- L158 Symbol = high_out->getSymbol()
- ... 19 more call sites

### Callers
- not available for no
... (196 more chars)
```


---

## Case 11: ghidra — PASS
note: Synthetic no-result case; should abstain.

# semantic-search lab v9: where is unicorn quantum teleport patching implemented?
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
intent: definition; kind: intent_symbol; keywords: ['teleport', 'patching', 'unicorn', 'quantum']

## Confidence
- level: low
- abstained: True
- reason: implementation query produced no code candidates
- top_score: 91.0; top_gap: 4.0; top_file_cluster: 3; path_keyword_coverage: 0.00

## Quality expectation
- expected: none
- should_abstain: True
- hit1: False; hit3: False; mrr: 0.000; abstain_ok: True; matched_rank: None
## Commands executed
- [ok, 15ms] sqlite-fts-prf: sqlite-fts search 'where is unicorn quantum teleport patching implemented?' --scope Ghidra/Features/Decompiler
- [code=2, 39ms] symbol-exact: srcwalk discover teleport --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 3000
- [ok, 164ms] fusion-symbol-teleport: srcwalk discover '*teleport*' --as symbol --scope Ghidra/Features/Decompiler --limit 8 --budget 2200
- [ok, 8ms] fusion-file-teleport: srcwalk discover '*teleport*' --as file --scope Ghidra/Features/Decompiler --limit 8 --budget 1800
- [ok, 175ms] fusion-symbol-patching: srcwalk discover '*patching*' --as symbol --scope Ghidra/Features/Decompiler --limit 8 --budget 2200
- [ok, 8ms] fusion-file-patching: srcwalk discover '*patching*' --as file --scope Ghidra/Features/Decompiler --limit 8 --budget 1800
- [ok, 191ms] fusion-symbol-unicorn: srcwalk discover '*unicorn*' --as symbol --scope Ghidra/Features/Decompiler --limit 8 --budget 2200
- [ok, 8ms] fusion-file-unicorn: srcwalk discover '*unicorn*' --as file --scope Ghidra/Features/Decompiler --limit 8 --budget 1800

## Notes
- v9 cache hit for scope `Ghidra/Features/Decompiler`: 3612 chunks, 19.34MB under /tmp/pi-srcwalk-v9-cache/f08144940240bbe4c1ee, prepare 8ms, query 15ms.
- symbol-exact failed with code 2
- Abstained: implementation query produced no code candidates.

## Best candidates
- none parsed

## Evidence expansion
