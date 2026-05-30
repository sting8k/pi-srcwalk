# Query Router Lab Test v7 - Ghidra Quality Benchmark

Total cases: 11
Summary: Hit@1=10/10, Hit@3=10/10, MRR=1.000, AbstainOK=10/11, elapsed=47697ms


---

## Case 1: ghidra — PASS
# semantic-search lab v7: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
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
## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 32ms] target-context: srcwalk context Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774 --scope Ghidra/Features/Decompiler --budget 3500

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774` `decompileFunction` — score=135.0, source=exact-context, kind=context-target
2. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:354-361` `verifyProcess` — score=85.0, source=definition, kind=fn
3. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:714-730` `flushCache` — score=85.0, source=definition, kind=fn

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:774 (ok, 32ms)
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
... (5377 more chars)
```

### Expansion 2: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:354-361 (ok, 25ms)
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

### Expansion 3: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:714-730 (ok, 23ms)
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
# semantic-search lab v7: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
intent: general; kind: file; keywords: ['DecompInterface', 'Decompiler', 'Features', 'feature', 'Ghidra']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 80.0; top_gap: 80.0; top_file_cluster: 1; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 6ms] file-show: srcwalk show Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java --budget 3500
- [ok, 8ms] file-discover: srcwalk discover Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java --as file --scope Ghidra/Features/Decompiler --limit 8 --budget 2500

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1` — score=80.0, source=file-show, kind=file

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1 (ok, 13ms)
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
# semantic-search lab v7: DecompInterface
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
intent: general; kind: symbol; keywords: ['DecompInterface']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 140.0; top_gap: 50.0; top_file_cluster: 2; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 70ms, matches=10] symbol-exact: srcwalk discover DecompInterface --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 3000
- [code=2, 44ms] symbol-lower: srcwalk discover decompinterface --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 2500
- [ok, 182ms] symbol-glob: srcwalk discover '*decompinterface*' --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 2500
- [ok, 17ms, matches=10] symbol-text: srcwalk discover DecompInterface --as text --scope Ghidra/Features/Decompiler --limit 10 --budget 2500

## Notes
- symbol-lower failed with code 2

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:82-1122` `DecompInterface` — score=140.0, source=definition, kind=class
2. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:160-179` `DecompInterface` — score=90.0, source=next-context, kind=context-target
3. `Ghidra/Features/Decompiler/ghidra_scripts/GraphASTScript.java:73-91` `buildAST` — score=75.0, source=next-context, kind=context-target

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

### Expansion 2: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:160-179 (ok, 34ms)
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
- [fn] GraphASTScript.buildAST Ghidra/Features/Decompiler/ghidra_scripts/GraphASTScript.java:76
- [fn] ShowCCallsScript.setUpDecompiler Ghidra/Features/Decompiler/ghidra_scripts/ShowCCallsScript.java:108
- [fn] ShowConstantUse.setUpDecompiler Ghidra/
... (1097 more chars)
```

### Expansion 3: context:Ghidra/Features/Decompiler/ghidra_scripts/GraphASTScript.java:73-91 (ok, 14ms)
```text
# Context Packet: Ghidra/Features/Decompiler/ghidra_scripts/GraphASTScript.java:73-91
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/ghidra_scripts/GraphASTScript.java:73-91 buildAST

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
entry: N1 entry :73-91 entry
  definitions: style parameter :73
actions summarized :74-78 3 action nodes
  calls: ifc.setOptions :78
  writes: options = new DecompileOptions() assignment_lhs :74; ifc = new DecompInterface() assignment_lhs :76
  reads: options call_arg :78

## Exits
- :91 end

## Call Neighborhood
### Callees (ordered)
- L74 options = new DecompileOptions()
- L76 ifc = new DecompInterface()
- L78 ifc.setOptions(arg1=options)
- L79 ifc.openProgram(arg1=this.currentProgram)
- L80 new DecompileException(arg1="Decompiler", arg2="
... (585 more chars)
```


---

## Case 4: ghidra — PASS
# semantic-search lab v7: how does decompile function work?
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler/src/main/java
intent: general; kind: general; keywords: ['decompile']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 150.0; top_gap: 15.0; top_file_cluster: 1; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['Decompiler.java', 'DecompilerManager.java', 'DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Quality expectation
- expected: ['Decompiler.java', 'DecompilerManager.java', 'DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 336ms] bm25-prf: bm25 search 'how does decompile function work?' --scope Ghidra/Features/Decompiler/src/main/java
- [ok, 48ms, matches=12] symbol-glob: srcwalk discover '*decompile*' --as symbol --scope Ghidra/Features/Decompiler/src/main/java --limit 12 --budget 2500

## Notes
- BM25 index for scope `Ghidra/Features/Decompiler/src/main/java` has 607 chunks; cold build 334ms, query 336ms.
- Fusion skipped: BM25 cluster: 3/3 top candidates in Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java with keyword path hit; preserves strong BM25 cluster.

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/Decompiler.java:46-58` `decompile` — score=150.0, source=definition, kind=fn
2. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:94-111` `decompile` — score=135.0, source=grouped-definition, kind=fn
3. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:172-177` `decompile` — score=135.0, source=grouped-definition, kind=fn

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/Decompiler.java:46-58 (ok, 39ms)
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
... (2623 more chars)
```

### Expansion 2: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:94-111 (ok, 44ms)
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
... (3035 more chars)
```

### Expansion 3: context:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/component/DecompilerManager.java:172-177 (ok, 49ms)
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
... (1176 more chars)
```


---

## Case 5: ghidra — PASS
# semantic-search lab v7: who calls decompileFunction?
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
## Quality expectation
- expected: ['decompileFunction']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 57ms, matches=10] symbol-exact: srcwalk discover decompileFunction --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 3000
- [code=2, 49ms] symbol-lower: srcwalk discover decompilefunction --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 2500
- [ok, 215ms] symbol-glob: srcwalk discover '*decompilefunction*' --as symbol --scope Ghidra/Features/Decompiler --limit 10 --budget 2500
- [ok, 172ms, matches=3493] text-any: srcwalk discover decompileFunction,calls,call --match any --as text --scope Ghidra/Features/Decompiler --limit 10 --budget 3000

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

### Expansion 2: trace-callers:decompileFunction (ok, 21ms)
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
# semantic-search lab v7: deps of Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Features/Decompiler
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
## Quality expectation
- expected: ['DecompInterface.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 60ms] file-deps: srcwalk deps Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java --budget 3500

## Best candidates
1. `Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java:1` — score=85.0, source=file-deps, kind=file

## Evidence expansion
### Expansion 1: deps:Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java (ok, 58ms)
```text
# Deps: Ghidra/Features/Decompiler/src/main/java/ghidra/app/decompiler/DecompInterface.java — 0 local, 16 external, 2 dependents

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
... (687 more chars)
```


---

## Case 7: ghidra — PASS
# semantic-search lab v7: ProgramDB
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Framework/SoftwareModeling
intent: general; kind: symbol; keywords: ['ProgramDB']

## Confidence
- level: high
- abstained: False
- reason: explicit structural query
- top_score: 140.0; top_gap: 50.0; top_file_cluster: 3; path_keyword_coverage: 1.00

## Quality expectation
- expected: ['ProgramDB.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Quality expectation
- expected: ['ProgramDB.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 182ms, matches=10] symbol-exact: srcwalk discover ProgramDB --as symbol --scope Ghidra/Framework/SoftwareModeling --limit 10 --budget 3000
- [code=2, 69ms] symbol-lower: srcwalk discover programdb --as symbol --scope Ghidra/Framework/SoftwareModeling --limit 10 --budget 2500
- [ok, 169ms] symbol-glob: srcwalk discover '*programdb*' --as symbol --scope Ghidra/Framework/SoftwareModeling --limit 10 --budget 2500
- [ok, 28ms, matches=10] symbol-text: srcwalk discover ProgramDB --as text --scope Ghidra/Framework/SoftwareModeling --limit 10 --budget 2500

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

### Expansion 2: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:241-294 (ok, 94ms)
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
... (4381 more chars)
```

### Expansion 3: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/ProgramDB.java:310-425 (ok, 92ms)
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
... (5280 more chars)
```


---

## Case 8: ghidra — PASS
# semantic-search lab v7: how does program database manage memory and symbols?
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra/Framework/SoftwareModeling/src/main/java
intent: general; kind: general; keywords: ['database', 'program', 'symbols', 'manage', 'memory']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 113.0; top_gap: 2.1; top_file_cluster: 3; path_keyword_coverage: 0.60

## Quality expectation
- expected: ['SymbolManager.java', 'ProgramDB.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Quality expectation
- expected: ['SymbolManager.java', 'ProgramDB.java']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 2891ms] bm25-prf: bm25 search 'how does program database manage memory and symbols?' --scope Ghidra/Framework/SoftwareModeling/src/main/java
- [ok, 177ms, matches=12] symbol-glob: srcwalk discover '*database*' --as symbol --scope Ghidra/Framework/SoftwareModeling/src/main/java --limit 12 --budget 2500

## Notes
- BM25 index for scope `Ghidra/Framework/SoftwareModeling/src/main/java` has 5361 chunks; cold build 2883ms, query 2891ms.
- Fusion skipped: BM25 cluster: 3/3 top candidates in Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java with keyword path hit; preserves strong BM25 cluster.

## Best candidates
1. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2451-2530` — score=113.0, source=bm25-prf, kind=chunk
2. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2661-2740` — score=110.9, source=bm25-prf, kind=chunk
3. `Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2521-2600` — score=108.7, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2451-2530 (ok, 43ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2451-2530
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2451-2530

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L2454 fromAddr.compareTo(arg1=toAddr)
- L2454 symbolIterator = getSymbolIterator(arg1=fromAddr, arg2=true)
- L2455 symbolIterator = getSymbolIterator(arg1=lastAddress, arg2=false)
- L2458 range.contains(arg1=symbol.getAddress())
- L2462 new AssertionError(arg1="Unexpected symbol type within memory range: " + symbol.getClass())
- L2465 newAddress = toAddr.add(arg1=memSym.getAdd
... (1918 more chars)
```

### Expansion 2: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2661-2740 (ok, 43ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2661-2740
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2661-2740

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L2663 fixupPinnedLabelSymbolAfterRebase(arg1=memSymbol, arg2=beforeBaseChangeAddress, arg3=match)
- L2666 fixupPrimarySymbols(arg1=primaryFixups)
- L2672 match.setPinned(arg1=true)
- L2673 memSymbol.delete()
- L2676 memSymbol.moveLowLevel(arg1=newAddress, arg2=null, arg3=null, arg4=null, arg5=true)
- L2685 match.setPinned(arg1=true)
- L2689 newLabel = createLabel(arg1=newAddre
... (1698 more chars)
```

### Expansion 3: context:Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2521-2600 (ok, 43ms)
```text
# Context Packet: Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2521-2600
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Framework/SoftwareModeling/src/main/java/ghidra/program/database/symbol/SymbolManager.java:2521-2600

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L2521 newPinned = destinationPrimary.isPinned()
- L2522 destinationPrimary.delete()
- L2526 memSymbol.moveLowLevel(arg1=newAddress, arg2=newName, arg3=newNamespace, arg4=newSource, arg5=newPinned)
- L2530 newSymbol = createLabel(arg1=oldAddress, arg2=originalName, arg3=originalNamespace, arg4=originalSource)
- L2531 newSymbol.setPinned(arg1=true)
- L2543 match = getSymbol(arg1
... (1606 more chars)
```


---

## Case 9: ghidra — PASS
# semantic-search lab v7: overview of Ghidra/Features/Decompiler
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
note: Broad Ghidra scope; tests cold BM25 cost.

# semantic-search lab v7: tests for decompiler interface
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra
intent: test; kind: test; keywords: ['decompiler', 'interface']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 158.0; top_gap: 2.2; top_file_cluster: 2; path_keyword_coverage: 0.50

## Quality expectation
- expected: ['test.cc', 'testfunction.cc', 'DecompilerTest']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Quality expectation
- expected: ['test.cc', 'testfunction.cc', 'DecompilerTest']
- should_abstain: False
- hit1: True; hit3: True; mrr: 1.000; abstain_ok: True; matched_rank: 1
## Commands executed
- [ok, 29018ms] bm25-prf: bm25 search 'tests for decompiler interface' --scope Ghidra
- [ok, 3296ms, matches=48152] test-text: srcwalk discover decompiler,interface,tests,test --match any --as text --scope Ghidra --limit 12 --budget 3000
- [ok, 1852ms, matches=12] test-symbol: srcwalk discover '*decompiler*' --as symbol --scope Ghidra --limit 12 --budget 2500

## Notes
- BM25 index for scope `Ghidra` has 50905 chunks; cold build 28984ms, query 29018ms.
- Fusion skipped: BM25 cluster: 2/3 top candidates in Ghidra/Features/Decompiler/src/decompile/cpp/test.cc with keyword path hit; preserves strong BM25 cluster.

## Best candidates
1. `Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:71-150` — score=158.0, source=bm25-prf, kind=chunk
2. `Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:141-174` `main` — score=155.8, source=bm25-prf, kind=chunk
3. `Ghidra/Features/Decompiler/src/decompile/cpp/testfunction.cc:351-399` — score=146.4, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:71-150 (ok, 22ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:71-150
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:71-150

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L71 fileManage.matchList(arg1=testFiles, arg2=".xml", arg3=true)
- L75 fileManage.matchList(arg1=allTestFiles, arg2=".xml", arg3=true)
- L76 allTestFiles.size()
- L77 fullNames.find(arg1=allTestFiles[i])
- L77 fullNames.end()
- L78 testFiles.push_back(arg1=allTestFiles[i])
- L129 const = getenv(arg1="SLEIGHHOME")
- L142 unitTestNames.insert(arg1=argv + 1, arg2=argv + argc)
- L148 dataTestNames.insert(arg1=argv + 1, arg2=argv + argc)

### Callers
- not available for non-s
... (191 more chars)
```

### Expansion 2: context:Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:141-174 (ok, 452ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:141-174
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/decompile/cpp/test.cc:103-174 main

## Flow Map
shape: 1 entry, 7 decisions, 1 loop, 2 exits, 12 actions, 3 summaries
N1 entry :103-174 entry
  definitions: argc parameter :103; argv parameter :103
  next -> N2 summary :104-114 pre-target statements x9
N2 summary :104-114 pre-target statements x9
  next -> N3 loop :115-155 (argc > 0)
N3 loop :115-155 (argc > 0)
  reads: argc condition :115
  body -> N4 summary :116 pre-target statements x1
  next -> N17 action :156 startDecompilerLibrary(sleighdirname.c_str())
N4 summary :116 pre-target statements x1
  next -> N5 decision :117-154 (command == "-path")
N5 decision :117-154 (command == "-path")
  reads: command condition :117
  fals
... (4752 more chars)
```

### Expansion 3: context:Ghidra/Features/Decompiler/src/decompile/cpp/testfunction.cc:351-399 (ok, 28ms)
```text
# Context Packet: Ghidra/Features/Decompiler/src/decompile/cpp/testfunction.cc:351-399
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/Decompiler/src/decompile/cpp/testfunction.cc:351-399

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L363 testFiles.size()
- L365 testCollection.clear()
- L366 testCollection.loadTest(arg1=testFiles[i])
- L367 testCollection.runTests(arg1=failures)
- L368 totalTestsApplied = testCollection.getTestsApplied()
- L369 totalTestsSucceeded = testCollection.getTestsSucceeded()
- L373 fs.str()
- L374 failures.push_back(arg1=fs.str())
- L378 fs.str()
- L379 failures.push_back(arg1=fs.str())
- L387 failures.empty()
- L389 list<string>::const_iterator = failures.
... (270 more chars)
```


---

## Case 11: ghidra — FAIL
note: Synthetic no-result case; should abstain.

# semantic-search lab v7: where is unicorn quantum teleport patching implemented?
repo: /Users/bean/Documents/Develope/ghidra
scope: Ghidra
intent: definition; kind: intent_symbol; keywords: ['teleport', 'patching', 'unicorn', 'quantum']

## Confidence
- level: high
- abstained: False
- reason: strong candidate cluster/coverage/score
- top_score: 98.0; top_gap: 2.1; top_file_cluster: 3; path_keyword_coverage: 0.00

## Quality expectation
- expected: none
- should_abstain: True
- hit1: False; hit3: False; mrr: 0.000; abstain_ok: False; matched_rank: None
## Quality expectation
- expected: []
- should_abstain: True
- hit1: False; hit3: False; mrr: 0.000; abstain_ok: False; matched_rank: None
## Commands executed
- [ok, 14ms] bm25-prf: bm25 search 'where is unicorn quantum teleport patching implemented?' --scope Ghidra
- [code=2, 711ms] symbol-exact: srcwalk discover teleport --as symbol --scope Ghidra --limit 10 --budget 3000
- [ok, 1965ms] fusion-symbol-teleport: srcwalk discover '*teleport*' --as symbol --scope Ghidra --limit 8 --budget 2200
- [ok, 50ms] fusion-file-teleport: srcwalk discover '*teleport*' --as file --scope Ghidra --limit 8 --budget 1800
- [ok, 2030ms, matches=1] fusion-symbol-patching: srcwalk discover '*patching*' --as symbol --scope Ghidra --limit 8 --budget 2200
- [ok, 56ms] fusion-file-patching: srcwalk discover '*patching*' --as file --scope Ghidra --limit 8 --budget 1800
- [ok, 2045ms] fusion-symbol-unicorn: srcwalk discover '*unicorn*' --as symbol --scope Ghidra --limit 8 --budget 2200
- [ok, 50ms] fusion-file-unicorn: srcwalk discover '*unicorn*' --as file --scope Ghidra --limit 8 --budget 1800

## Notes
- BM25 index for scope `Ghidra` has 50905 chunks; cold build 28984ms, query 14ms.
- symbol-exact failed with code 2

## Best candidates
1. `Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:421-500` `getTypeApplier` — score=98.0, source=bm25-prf, kind=chunk
2. `Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:141-220` `getTypeApplier` — score=95.9, source=bm25-prf, kind=chunk
3. `Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:281-360` `getTypeApplier` — score=93.9, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:421-500 (ok, 141ms)
```text
# Context Packet: Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:421-500
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:90-547 getTypeApplier

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
entry: N1 entry :90-547 entry
  definitions: pdbId parameter :90
summary: N2 summary :91-94 pre-target statements x2
action: N3 action :541 e.getMessage()
  calls: e.getMessage :541
action: N4 action :545 appliersByPdbId.put(pdbId, applier)
  calls: appliersByPdbId.put :545
  reads: pdbId call_arg :545; applier call_arg :545

## Exits
- :546 return applier;

## Call Neighborhood
### Callees (ordered)
- L91 applier = appliersByPdbId.get(arg1=pdbId)
- L98 applier = new Primit
... (2131 more chars)
```

### Expansion 2: context:Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:141-220 (ok, 143ms)
```text
# Context Packet: Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:141-220
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:90-547 getTypeApplier

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
entry: N1 entry :90-547 entry
  definitions: pdbId parameter :90
summary: N2 summary :91-94 pre-target statements x2
action: N3 action :541 e.getMessage()
  calls: e.getMessage :541
action: N4 action :545 appliersByPdbId.put(pdbId, applier)
  calls: appliersByPdbId.put :545
  reads: pdbId call_arg :545; applier call_arg :545

## Exits
- :546 return applier;

## Call Neighborhood
### Callees (ordered)
- L91 applier = appliersByPdbId.get(arg1=pdbId)
- L98 applier = new Primit
... (2131 more chars)
```

### Expansion 3: context:Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:281-360 (ok, 156ms)
```text
# Context Packet: Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:281-360
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- Ghidra/Features/PDB/src/main/java/ghidra/app/util/pdb/pdbapplicator/TypeApplierFactory.java:90-547 getTypeApplier

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
entry: N1 entry :90-547 entry
  definitions: pdbId parameter :90
summary: N2 summary :91-94 pre-target statements x2
action: N3 action :541 e.getMessage()
  calls: e.getMessage :541
action: N4 action :545 appliersByPdbId.put(pdbId, applier)
  calls: appliersByPdbId.put :545
  reads: pdbId call_arg :545; applier call_arg :545

## Exits
- :546 return applier;

## Call Neighborhood
### Callees (ordered)
- L91 applier = appliersByPdbId.get(arg1=pdbId)
- L98 applier = new Primit
... (2131 more chars)
```

