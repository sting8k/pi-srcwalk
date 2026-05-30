# Query Router Lab Test v3 - Complex Run

Total cases: 17
Summary: PASS=17, PARTIAL=0, FAIL=0, elapsed=8437ms


---

## Case 1: bifrost — PASS
# semantic-search lab v3: framework/modelcatalog/pricing.go:28
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: general; kind: explicit_target; keywords: ['modelcatalog', 'framework', 'pricing', 'pric']

## Commands executed
- [ok, 60ms] target-context: srcwalk context framework/modelcatalog/pricing.go:28 --scope . --budget 3500

## Best candidates
1. `framework/modelcatalog/pricing.go:28` `CalculateCost` — score=140.0, source=exact-context, kind=context-target
2. `framework/modelcatalog/pricing.go:48-65` `calculateCostWithCache` — score=90.0, source=definition, kind=fn
3. `framework/modelcatalog/pricing.go:83-135` `calculateBaseCost` — score=90.0, source=definition, kind=fn

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:28 (ok, 61ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:28
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:28-45 CalculateCost

## Flow Map
shape: 1 entry, 3 decisions, 0 loops, 3 exits, 3 actions
N1 entry :28-45 entry
  definitions: result parameter :28; scopes parameter :28
  next -> N2 decision :29-31 result == nil
N2 decision :29-31 result == nil
  reads: result condition :29
  true -> N3 return :30 return 0
  false -> N4 action :33 var s PricingLookupScopes
N3 return :30 return 0
N4 action :33 var s PricingLookupScopes
  writes: s assignment_lhs :33
  next -> N5 decision :34-36 scopes != nil
N5 decision :34-36 scopes != nil
  reads: scopes condition :34
  true -> N6 action :35 s = *scopes
  false -> N7 action :39 result.GetExtraFields()
N6 action :35 s = *scopes
  writes: s assignment_lhs :35
  reads:
... (2537 more chars)
```

### Expansion 2: context:framework/modelcatalog/pricing.go:48-65 (ok, 37ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:48-65
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:48-65 calculateCostWithCache

## Flow Map
shape: 1 entry, 3 decisions, 0 loops, 4 exits, 2 actions
N1 entry :48-65 entry
  definitions: result parameter :48; cacheDebug parameter :48; scopes parameter :48
  next -> N2 decision :49-59 cacheDebug.CacheHit
N2 decision :49-59 cacheDebug.CacheHit
  reads: cacheDebug.CacheHit condition :49
  true -> N3 decision :51-53 cacheDebug.HitType != nil && *cacheDebug.HitType == "direct"
  false -> N8 action :62 mc.calculateBaseCost(result, scopes)
N3 decision :51-53 cacheDebug.HitType != nil && *cacheDebug.HitType == "direct"
  reads: cacheDebug.HitType condition :51
  true -> N4 return :52 return 0
  false -> N5 decision :55-57 cacheDebug.ProviderUsed != nil &&
... (2374 more chars)
```

### Expansion 3: context:framework/modelcatalog/pricing.go:83-135 (ok, 42ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:83-135
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:83-135 calculateBaseCost

## Flow Map
shape: 1 entry, 5 decisions, 0 loops, 12 exits, 8 actions
N1 entry :83-135 entry
  definitions: result parameter :83; scopes parameter :83
  next -> N2 action :84 result.GetExtraFields()
N2 action :84 result.GetExtraFields()
  calls: result.GetExtraFields :84
  writes: extraFields assignment_lhs :84
  next -> N3 decision :85-87 extraFields == nil
N3 decision :85-87 extraFields == nil
  reads: extraFields condition :85
  true -> N4 return :86 return 0
  false -> actions summarized :89-95 5 action nodes
N4 return :86 return 0
actions summarized :89-95 5 action nodes
  calls: string :89; extractCostInput :95
  writes: provider assignment_lhs :89; originalModelReq
... (8195 more chars)
```


---

## Case 2: bifrost — PASS
# semantic-search lab v3: framework/modelcatalog/pricing.go
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: general; kind: file; keywords: ['modelcatalog', 'framework', 'pricing', 'pric']

## Commands executed
- [ok, 6ms] file-show: srcwalk show framework/modelcatalog/pricing.go --budget 3500
- [ok, 11ms] file-discover: srcwalk discover framework/modelcatalog/pricing.go --as file --scope . --limit 8 --budget 2500

## Best candidates
1. `framework/modelcatalog/pricing.go:1` — score=85.0, source=file-show, kind=file

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:1 (ok, 15ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:1
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:1-1

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

> Next: srcwalk show framework/modelcatalog/pricing.go:1-1 -C 20
```


---

## Case 3: bifrost — PASS
# semantic-search lab v3: CalculateCost
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: general; kind: symbol; keywords: ['CalculateCost']

## Commands executed
- [ok, 98ms, matches=10] symbol-exact: srcwalk discover CalculateCost --as symbol --scope . --limit 10 --budget 3000

## Best candidates
1. `framework/modelcatalog/pricing.go:28-45` `CalculateCost` — score=140.0, source=definition, kind=fn
2. `tests/governance/test_utils.go:64-73` `CalculateCost` — score=125.0, source=definition, kind=fn
3. `framework/streaming/audio.go:117-199` `processAudioStreamingResponse` — score=80.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:28-45 (ok, 60ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:28-45
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:28-45 CalculateCost

## Flow Map
shape: 1 entry, 3 decisions, 0 loops, 3 exits, 3 actions
N1 entry :28-45 entry
  definitions: result parameter :28; scopes parameter :28
  next -> N2 decision :29-31 result == nil
N2 decision :29-31 result == nil
  reads: result condition :29
  true -> N3 return :30 return 0
  false -> N4 action :33 var s PricingLookupScopes
N3 return :30 return 0
N4 action :33 var s PricingLookupScopes
  writes: s assignment_lhs :33
  next -> N5 decision :34-36 scopes != nil
N5 decision :34-36 scopes != nil
  reads: scopes condition :34
  true -> N6 action :35 s = *scopes
  false -> N7 action :39 result.GetExtraFields()
N6 action :35 s = *scopes
  writes: s assignment_lhs :35
  rea
... (2540 more chars)
```

### Expansion 2: context:tests/governance/test_utils.go:64-73 (ok, 51ms)
```text
# Context Packet: tests/governance/test_utils.go:64-73
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- tests/governance/test_utils.go:64-73 CalculateCost

## Flow Map
shape: 1 entry, 1 decision, 0 loops, 2 exits, 3 actions
N1 entry :64-73 entry
  definitions: model parameter :64; inputTokens parameter :64
  next -> N2 action :65 modelInfo, ok := TestModels[model]
N2 action :65 modelInfo, ok := TestModels[model]
  writes: modelInfo, ok assignment_lhs :65
  reads: TestModels assignment_rhs :65; model assignment_rhs :65
  next -> N3 decision :66-68 !ok
N3 decision :66-68 !ok
  reads: ok condition :66
  true -> N4 return :67 return 0, fmt.Errorf("unknown model: %s", model)
  false -> N5 action :70 float64(inputTokens)
N4 return :67 return 0, fmt.Errorf("unknown model: %s", model)
  calls: fmt.Errorf :67
  reads: model call_arg :67
N5 actio
... (1738 more chars)
```

### Expansion 3: context:framework/streaming/audio.go:117-199 (ok, 36ms)
```text
# Context Packet: framework/streaming/audio.go:117-199
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/streaming/audio.go:117-199 processAudioStreamingResponse

## Flow Map
shape: 1 entry, 12 decisions, 0 loops, 5 exits, 23 actions
N1 entry :117-199 entry
  definitions: ctx parameter :117; result parameter :117; bifrostErr parameter :117
  next -> N2 action :119 getAccumulatorID(ctx)
N2 action :119 getAccumulatorID(ctx)
  calls: getAccumulatorID :119
  writes: requestID, ok assignment_lhs :119
  reads: ctx call_arg :119
  next -> N3 decision :120-123 !ok || requestID == ""
N3 decision :120-123 !ok || requestID == ""
  reads: ok condition :120; requestID condition :120
  true -> N4 return :122 return nil, fmt.Errorf("accumulator-id not found in context or is empty")
  false -> actions summarized :124-129 5 action nodes
N4 retu
... (9506 more chars)
```


---

## Case 4: bifrost — PASS
# semantic-search lab v3: how does model pricing cost calculation work?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: framework
intent: general; kind: general; keywords: ['calculation', 'pricing', 'model', 'pric', 'cost']

## Commands executed
- [ok, 73ms, matches=2058] text-any: srcwalk discover calculation,pricing,model,pric --match any --as text --scope framework --limit 12 --budget 3000

## Best candidates
1. `framework/modelcatalog/pricing.go:1` — score=55.0, source=ranked-file, kind=file
2. `framework/modelcatalog/pricing.go:47-793` — score=55.0, source=next-show, kind=text-hit
3. `framework/configstore/tables/pricingoverride.go:15-31` — score=55.0, source=next-show, kind=text-hit

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:1 (ok, 15ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:1
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:1-1

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

> Next: srcwalk show framework/modelcatalog/pricing.go:1-1 -C 20
```

### Expansion 2: context:framework/modelcatalog/pricing.go:47-793 (ok, 24ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:47-793
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:47-793

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L56 ->ret mc.computeCacheEmbeddingCost(arg1=cacheDebug, arg2=scopes)
- L62 baseCost = mc.calculateBaseCost(arg1=result, arg2=scopes)
- L63 embeddingCost = mc.computeCacheEmbeddingCost(arg1=cacheDebug, arg2=scopes)
- L75 pricing = mc.resolvePricing(arg1=*cacheDebug.ProviderUsed, arg2=*cacheDebug.ModelUsed, arg3="", arg4=schemas.EmbeddingRequest, arg5=scopes)
- L79 float64(arg1=*cacheDebug.InputTokens)
- L79 tieredInputRate(arg1=pricing, arg2=*cacheDebug.InputTokens)
- L84 extraFields = result.GetExtraFields()
... (2063 more chars)
```

### Expansion 3: context:framework/configstore/tables/pricingoverride.go:15-31 (ok, 5ms)
```text
# Context Packet: framework/configstore/tables/pricingoverride.go:15-31
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/configstore/tables/pricingoverride.go:15-31

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

> Next: srcwalk show framework/configstore/tables/pricingoverride.go:15-31 -C 20
```


---

## Case 5: bifrost — PASS
# semantic-search lab v3: who calls CalculateCost?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: framework
intent: callers; kind: intent_symbol; keywords: ['CalculateCost', 'calls', 'call']

## Commands executed
- [ok, 34ms, matches=10] symbol-exact: srcwalk discover CalculateCost --as symbol --scope framework --limit 10 --budget 3000

## Best candidates
1. `framework/modelcatalog/pricing.go:28-45` `CalculateCost` — score=140.0, source=definition, kind=fn
2. `framework/streaming/audio.go:117-199` — score=80.0, source=next-context, kind=context-target
3. `framework/modelcatalog/pricing_test.go:837-863` — score=70.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:28-45 (ok, 38ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:28-45
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:28-45 CalculateCost

## Flow Map
shape: 1 entry, 3 decisions, 0 loops, 3 exits, 3 actions
N1 entry :28-45 entry
  definitions: result parameter :28; scopes parameter :28
  next -> N2 decision :29-31 result == nil
N2 decision :29-31 result == nil
  reads: result condition :29
  true -> N3 return :30 return 0
  false -> N4 action :33 var s PricingLookupScopes
N3 return :30 return 0
N4 action :33 var s PricingLookupScopes
  writes: s assignment_lhs :33
  next -> N5 decision :34-36 scopes != nil
N5 decision :34-36 scopes != nil
  reads: scopes condition :34
  true -> N6 action :35 s = *scopes
  false -> N7 action :39 result.GetExtraFields()
N6 action :35 s = *scopes
  writes: s assignment_lhs :35
  rea
... (2540 more chars)
```

### Expansion 2: trace-callers:CalculateCost (ok, 20ms)
```text
# Trace callers: CalculateCost — 29 call sites

[symbol] CalculateCost
<- calls
  [fn] TestCalculateCost_SemanticCacheDirectHit framework/modelcatalog/pricing_test.go:861 prefix=mc(var) args=2
  [fn] TestCalculateCost_SemanticCacheSemanticHit framework/modelcatalog/pricing_test.go:900 prefix=mc(var) args=2
  [fn] TestCalculateCost_SemanticCacheMiss framework/modelcatalog/pricing_test.go:938 prefix=mc(var) args=2
  [fn] TestCalculateCost_SemanticCacheHitNoEmbeddingInfo framework/modelcatalog/pricing_test.go:959 prefix=mc(var) args=2
  [fn] TestCalculateCost_NilResponse framework/modelcatalog/pricing_test.go:969 prefix=mc(var) args=2
  [fn] TestCalculateCost_ProviderComputedCostPassthrough framework/modelcatalog/pricing_test.go:986 prefix=mc(var) args=2
  [fn] TestCalculateCost_NoUsageData framework/modelcatalog/pricing_test.go:996 prefix=mc(var) args=2
  [fn] TestCalculateCost_ChatComplet
... (2646 more chars)
```


---

## Case 6: bifrost — PASS
# semantic-search lab v3: what does CalculateCost call?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: framework
intent: callees; kind: intent_symbol; keywords: ['CalculateCost', 'call']

## Commands executed
- [ok, 36ms, matches=10] symbol-exact: srcwalk discover CalculateCost --as symbol --scope framework --limit 10 --budget 3000

## Best candidates
1. `framework/modelcatalog/pricing.go:28-45` `CalculateCost` — score=140.0, source=definition, kind=fn
2. `framework/streaming/audio.go:117-199` — score=80.0, source=next-context, kind=context-target
3. `framework/modelcatalog/pricing_test.go:837-863` — score=70.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:28-45 (ok, 39ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:28-45
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:28-45 CalculateCost

## Flow Map
shape: 1 entry, 3 decisions, 0 loops, 3 exits, 3 actions
N1 entry :28-45 entry
  definitions: result parameter :28; scopes parameter :28
  next -> N2 decision :29-31 result == nil
N2 decision :29-31 result == nil
  reads: result condition :29
  true -> N3 return :30 return 0
  false -> N4 action :33 var s PricingLookupScopes
N3 return :30 return 0
N4 action :33 var s PricingLookupScopes
  writes: s assignment_lhs :33
  next -> N5 decision :34-36 scopes != nil
N5 decision :34-36 scopes != nil
  reads: scopes condition :34
  true -> N6 action :35 s = *scopes
  false -> N7 action :39 result.GetExtraFields()
N6 action :35 s = *scopes
  writes: s assignment_lhs :35
  rea
... (2540 more chars)
```

### Expansion 2: trace-callees:CalculateCost (ok, 38ms)
```text
# Callees: CalculateCost (framework/modelcatalog/pricing.go)

L39 result.GetExtraFields()
L41 ->ret mc.calculateCostWithCache(arg1=result, arg2=cacheDebug, arg3=s)
L44 ->ret mc.calculateBaseCost(arg1=result, arg2=s)

> Caveat: detailed call sites can be long. Retry with --budget <N>, or omit --detailed for resolved callee summaries.
```


---

## Case 7: bifrost — PASS
# semantic-search lab v3: deps of framework/modelcatalog/pricing.go
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: deps; kind: file_deps; keywords: ['modelcatalog', 'framework', 'pricing', 'deps', 'pric']

## Commands executed
- [ok, 42ms] file-deps: srcwalk deps framework/modelcatalog/pricing.go --budget 3500

## Best candidates
1. `framework/modelcatalog/pricing.go:1` — score=90.0, source=file-deps, kind=file

## Evidence expansion
### Expansion 1: deps:framework/modelcatalog/pricing.go (ok, 36ms)
```text
# Deps: framework/modelcatalog/pricing.go — 2 local, 0 external, 1 dependent

## Uses (local)
framework/modelcatalog/
  overrides.go                 applyPricingOverrides
  utils.go                     makeKey, normalizeRequestType, normalizeStreamRequestType

## Uses (external)
(none)

## Used by
framework/modelcatalog/
  pricing_test.go:247          TestComputeEmbeddingCost_Basic → computeEmbeddingCost
  pricing_test.go:254          TestComputeEmbeddingCost_NilUsage → computeEmbeddingCost
  pricing_test.go:271          TestComputeRerankCost_Basic → computeRerankCost
  pricing_test.go:288          TestComputeRerankCost_WithSearchCost → computeRerankCost
  pricing_test.go:294          TestComputeRerankCost_NilUsage → computeRerankCost
  pricing_test.go:314          TestComputeSpeechCost_TokensPreferredOverDuration → computeSpeechCost
  pricing_test.go:331          TestComputeSpeechCost_O
... (2902 more chars)
```


---

## Case 8: bifrost — PASS
# semantic-search lab v3: tests for semantic cache
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: tests
intent: test; kind: test; keywords: ['semantic', 'tests', 'cache', 'test']

## Commands executed
- [ok, 213ms, matches=5574] test-text: srcwalk discover semantic,tests,cache,test --match any --as text --scope tests --limit 12 --budget 3000

## Best candidates
1. `tests/integrations/typescript/package-lock.json:4162-5383` — score=75.0, source=next-show, kind=text-hit
2. `tests/governance/test_utils.go:11-434` — score=75.0, source=next-show, kind=text-hit
3. `tests/e2e/core/utils/test-helpers.ts:1-166` — score=75.0, source=next-show, kind=text-hit

## Evidence expansion
### Expansion 1: context:tests/integrations/typescript/package-lock.json:4162-5383 (ok, 3ms)
```text
# Context Packet: tests/integrations/typescript/package-lock.json:4162-5383

(not a code file)
```

### Expansion 2: context:tests/governance/test_utils.go:11-434 (ok, 11ms)
```text
# Context Packet: tests/governance/test_utils.go:11-434
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- tests/governance/test_utils.go:11-434

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L67 ->ret fmt.Errorf(arg1="unknown model: %s", arg2=model)
- L70 float64(arg1=inputTokens)
- L71 float64(arg1=outputTokens)
- L93 url = fmt.Sprintf(arg1="http://localhost:8080%s", arg2=req.Path)
- L97 bodyBytes, err = json.Marshal(arg1=req.Body)
- L99 t.Fatalf(arg1="Failed to marshal request body: %v", arg2=err)
- L101 body = bytes.NewReader(arg1=bodyBytes)
- L104 httpReq, err = http.NewRequest(arg1=req.Method, arg2=url, arg3=body)
- L106 t.Fatalf(arg1="Failed to create HTTP request: %v", arg2=err)
- L109 httpReq.
... (641 more chars)
```

### Expansion 3: context:tests/e2e/core/utils/test-helpers.ts:1-166 (ok, 13ms)
```text
# Context Packet: tests/e2e/core/utils/test-helpers.ts:1-166
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- tests/e2e/core/utils/test-helpers.ts:1-166

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L7 page.waitForLoadState(arg1='networkidle', arg2={ timeout })
- L14 setTimeout(arg1=resolve, arg2=ms)
- L29 ->ret fn()
- L33 wait(arg1=delay)
- L45 ->ret Math.random().toString(36).substring(2).padEnd(length, '0').substring(arg1=0, arg2=length)
- L52 Date.now()
- L52 randomString(arg1=4)
- L64 toast = page.locator(selector).first()
- L65 expect(toast).toBeVisible(arg1={ timeout: 10000 })
- L66 expect(toast).toContainText(arg1=expectedText)
- L73 expect(page).toHaveURL(arg1=pattern)
- L85 page.locator(tr
... (498 more chars)
```


---

## Case 9: bifrost — PASS
# semantic-search lab v3: where is unicorn payment teleport implemented?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: definition; kind: intent_symbol; keywords: ['implemented', 'teleport', 'unicorn', 'payment']

## Commands executed
- [ok, 103ms, matches=10] symbol-exact: srcwalk discover implemented --as symbol --scope . --limit 10 --budget 3000
- [ok, 108ms, matches=10] symbol-lower: srcwalk discover implemented --as symbol --scope . --limit 10 --budget 2500
- [ok, 356ms] symbol-glob: srcwalk discover '*implemented*' --as symbol --scope . --limit 10 --budget 2500
- [ok, 82ms, matches=48] text-any: srcwalk discover implemented,teleport,unicorn,payment --match any --as text --scope . --limit 10 --budget 3000

## Best candidates
1. `framework/plugins/soplugin.go:54-54` `HTTPTransportPreHook` — score=40.0, source=next-show, kind=text-hit
2. `docs/architecture/core/mcp.mdx:901-901` — score=35.0, source=next-show, kind=text-hit
3. `docs/mcp/code-mode.mdx:590-590` — score=35.0, source=next-show, kind=text-hit

## Evidence expansion
### Expansion 1: context:framework/plugins/soplugin.go:54-54 (ok, 37ms)
```text
# Context Packet: framework/plugins/soplugin.go:54-54
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/plugins/soplugin.go:52-57 HTTPTransportPreHook

## Flow Map
shape: 1 entry, 1 decision, 0 loops, 2 exits, 0 actions
N1 entry :52-57 entry
  definitions: ctx parameter :52; req parameter :52
  next -> N2 decision :53-55 dp.httpTransportPreHook == nil
N2 decision :53-55 dp.httpTransportPreHook == nil
  reads: dp.httpTransportPreHook condition :53
  true -> N3 return :54 return nil, nil
  false -> N4 return :56 return dp.httpTransportPreHook(ctx, req)
N3 return :54 return nil, nil
N4 return :56 return dp.httpTransportPreHook(ctx, req)
  calls: dp.httpTransportPreHook :56
  reads: ctx call_arg :56; req call_arg :56

## Exits
- :54 return nil, nil
- :56 return dp.httpTransportPreHook(ctx, req)

## Call Neighborhood
### Callees (or
... (621 more chars)
```

### Expansion 2: context:docs/architecture/core/mcp.mdx:901-901 (ok, 4ms)
```text
# Context Packet: docs/architecture/core/mcp.mdx:901-901

(not a code file)
```

### Expansion 3: context:docs/mcp/code-mode.mdx:590-590 (ok, 3ms)
```text
# Context Packet: docs/mcp/code-mode.mdx:590-590

(not a code file)
```


---

## Case 10: uno — PASS
# semantic-search lab v3: src/Uno.Foundation/Rect.cs
repo: /Users/bean/Documents/Develope/uno
scope: .
intent: general; kind: file; keywords: ['Foundation', 'Rect', 'Uno', 'src']

## Commands executed
- [ok, 5ms] file-show: srcwalk show src/Uno.Foundation/Rect.cs --budget 3500
- [ok, 61ms] file-discover: srcwalk discover src/Uno.Foundation/Rect.cs --as file --scope . --limit 8 --budget 2500

## Best candidates
1. `src/Uno.Foundation/Rect.cs:1` — score=85.0, source=file-show, kind=file

## Evidence expansion
### Expansion 1: context:src/Uno.Foundation/Rect.cs:1 (ok, 30ms)
```text
# Context Packet: src/Uno.Foundation/Rect.cs:1
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.Foundation/Rect.cs:1-1

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

> Next: srcwalk show src/Uno.Foundation/Rect.cs:1-1 -C 20
```


---

## Case 11: uno — PASS
# semantic-search lab v3: Rect
repo: /Users/bean/Documents/Develope/uno
scope: .
intent: general; kind: symbol; keywords: ['Rect']

## Commands executed
- [ok, 2649ms, matches=10] symbol-exact: srcwalk discover Rect --as symbol --scope . --limit 10 --budget 3000

## Best candidates
1. `src/Uno.UWP/Graphics/Interop/Direct2D/D2D1RoundedRect.cs:8-8` `Rect` — score=145.0, source=definition, kind=definition
2. `src/Uno.Foundation/FoundationFeatureConfiguration.cs:15-31` `Rect` — score=130.0, source=definition, kind=class
3. `src/Uno.UI.RuntimeTests/UITests/_Engine/QueryResult.cs:22-22` `Rect` — score=120.0, source=definition, kind=property

## Evidence expansion
### Expansion 1: context:src/Uno.UWP/Graphics/Interop/Direct2D/D2D1RoundedRect.cs:8-8 (ok, 23ms)
```text
# Context Packet: src/Uno.UWP/Graphics/Interop/Direct2D/D2D1RoundedRect.cs:8-8
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.UWP/Graphics/Interop/Direct2D/D2D1RoundedRect.cs:8-8

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

> Next: srcwalk show src/Uno.UWP/Graphics/Interop/Direct2D/D2D1RoundedRect.cs:8-8 -C 20
```

### Expansion 2: context:src/Uno.Foundation/FoundationFeatureConfiguration.cs:15-31 (ok, 23ms)
```text
# Context Packet: src/Uno.Foundation/FoundationFeatureConfiguration.cs:15-31
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.Foundation/FoundationFeatureConfiguration.cs:15-31

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

> Next: srcwalk show src/Uno.Foundation/FoundationFeatureConfiguration.cs:15-31 -C 20
```

### Expansion 3: context:src/Uno.UI.RuntimeTests/UITests/_Engine/QueryResult.cs:22-22 (ok, 23ms)
```text
# Context Packet: src/Uno.UI.RuntimeTests/UITests/_Engine/QueryResult.cs:22-22
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.UI.RuntimeTests/UITests/_Engine/QueryResult.cs:22-22

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L22 _element.TransformToVisual(null).TransformBounds(arg1=new Rect(default, _element.RenderSize))

### Resolved local callees
  [fn] Rect src/Uno.UI.RuntimeTests/UITests/_Engine/QueryResult.cs:22-22  public AppRect Rect => _element.TransformToVisual(null).TransformBounds(new Rect(default, _element.RenderSize));


### Callers
- not available for non-symbol range targets

> Caveat: static context packet is capped; verify exact edges with trace commands.

> Next: srcwalk
... (71 more chars)
```


---

## Case 12: uno — PASS
# semantic-search lab v3: how does remote control server start?
repo: /Users/bean/Documents/Develope/uno
scope: src
intent: general; kind: general; keywords: ['control', 'remote', 'server', 'start']

## Commands executed
- [ok, 1344ms, matches=16277] text-any: srcwalk discover control,remote,server,start --match any --as text --scope src --limit 12 --budget 3000

## Best candidates
1. `src/Uno.UI/UI/Xaml/Controls/Control/Control.cs:88-1056` — score=55.0, source=next-show, kind=text-hit
2. `src/Uno.UI.DevServer.Cli/Mcp/Setup/server-definitions.json:7-26` — score=55.0, source=next-show, kind=text-hit
3. `src/SourceGenerators/Uno.UI.SourceGenerators/HotRestart/HotRestartGenerator.cs:12-97` — score=55.0, source=next-show, kind=text-hit

## Evidence expansion
### Expansion 1: context:src/Uno.UI/UI/Xaml/Controls/Control/Control.cs:88-1056 (ok, 48ms)
```text
# Context Packet: src/Uno.UI/UI/Xaml/Controls/Control/Control.cs:88-1056
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.UI/UI/Xaml/Controls/Control/Control.cs:88-1056

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L92 this.GetValue(arg1=DefaultStyleResourceUriProperty)
- L93 this.SetValue(arg1=DefaultStyleResourceUriProperty, arg2=value)
- L100 DependencyProperty.Register(arg1=nameof(DefaultStyleResourceUri), arg2=typeof(Uri), arg3=typeof(Control), arg4=new FrameworkPropertyMetadata(default(Uri)))
- L116 CreateIsEnabledProperty()
- L120 GetIsEnabledValue()
- L121 SetIsEnabledValue(arg1=value)
- L127 UpdateHitTest()
- L130 _isEnabledChangedEventArgs = new IsEnabledChangedEventArgs()
- L133 O
... (529 more chars)
```

### Expansion 2: context:src/Uno.UI.DevServer.Cli/Mcp/Setup/server-definitions.json:7-26 (ok, 4ms)
```text
# Context Packet: src/Uno.UI.DevServer.Cli/Mcp/Setup/server-definitions.json:7-26

(not a code file)
```

### Expansion 3: context:src/SourceGenerators/Uno.UI.SourceGenerators/HotRestart/HotRestartGenerator.cs:12-97 (ok, 26ms)
```text
# Context Packet: src/SourceGenerators/Uno.UI.SourceGenerators/HotRestart/HotRestartGenerator.cs:12-97
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/SourceGenerators/Uno.UI.SourceGenerators/HotRestart/HotRestartGenerator.cs:12-97

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L23 DesignTimeHelper.IsDesignTime(arg1=context)
- L24 PlatformHelper.IsIOS(arg1=context)
- L25 PlatformHelper.IsUnoHead(arg1=context)
- L27 generator = new Generator(arg1=context)
- L28 generator.Run()
- L43 IsGenerationEnabled()
- L48 mauiAppDelegate = _context.Compilation.GetTypeByMetadataName(arg1="Microsoft.Maui.MauiUIApplicationDelegate")
- L58 appType = GetApplicationDefinitionType()
- L69 nameof(arg1=HotRestartGene
... (592 more chars)
```


---

## Case 13: uno — PASS
# semantic-search lab v3: who calls StartCommandAsync?
repo: /Users/bean/Documents/Develope/uno
scope: src
intent: callers; kind: intent_symbol; keywords: ['StartCommandAsync', 'calls', 'call']

## Commands executed
- [ok, 435ms, matches=2] symbol-exact: srcwalk discover StartCommandAsync --as symbol --scope src --limit 10 --budget 3000

## Best candidates
1. `src/Uno.UI.RemoteControl.Host/Program.Command.cs:20-222` `StartCommandAsync` — score=140.0, source=definition, kind=fn
2. `src/Uno.UI.RemoteControl.Host/Program.cs:32-296` — score=80.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:src/Uno.UI.RemoteControl.Host/Program.Command.cs:20-222 (ok, 178ms)
```text
# Context Packet: src/Uno.UI.RemoteControl.Host/Program.Command.cs:20-222
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.UI.RemoteControl.Host/Program.Command.cs:20-222 StartCommandAsync

## Flow Map
shape: linear structural flow; no branch nodes detected by supported parser
entry: N1 entry :20-222 entry
  definitions: httpPort parameter :20; parentPID parameter :20; solution parameter :20; +4 more
action: N2 action :108 Assembly.GetExecutingAssembly()
  calls: Assembly.GetExecutingAssembly :108

## Exits
- :222 end

## Call Neighborhood
### Callees (ordered)
- L24 string.IsNullOrWhiteSpace(arg1=workingDir)
- L26 workingDir = Directory.GetCurrentDirectory()
- L29 string.IsNullOrWhiteSpace(arg1=solution)
- L31 solutionFiles = Directory.EnumerateFiles(workingDir, "*.sln").Concat(Directory.EnumerateFiles(workingDir, "*.slnx")).To
... (2093 more chars)
```

### Expansion 2: trace-callers:StartCommandAsync (ok, 289ms)
```text
# Trace callers: StartCommandAsync — 1 call site

[symbol] StartCommandAsync
<- calls
  [fn] Program.Main src/Uno.UI.RemoteControl.Host/Program.cs:78 args=7


(~40 tokens)

> Next: <path>:<line> | --expand[=N] | --count-by args|path | --filter 'args:N prefix:NAME' | --depth N.
```


---

## Case 14: uno — PASS
# semantic-search lab v3: overview of src/Uno.UI.RemoteControl.Host
repo: /Users/bean/Documents/Develope/uno
scope: src/Uno.UI.RemoteControl.Host
intent: overview; kind: overview; keywords: ['RemoteControl', 'overview', 'Host', 'Uno', 'src']

## Commands executed
- [ok, 31ms] overview: srcwalk overview --scope src/Uno.UI.RemoteControl.Host --symbols

## Notes
- No parseable candidates. Returning best raw command output only.

## Best candidates
- none parsed

## Evidence expansion
### Expansion 1: overview (ok, 31ms)
```text
# Overview: src/Uno.UI.RemoteControl.Host (depth auto→3, sizes ~= tokens)
# Note: respects .gitignore, .git/info/exclude, core.excludesFile, .ignore (+ parents); dotfiles included; built-in SKIP_DIRS still apply (target, node_modules, …). Use `srcwalk <path>` to inspect an ignored file directly.
Extensibility/  ~4.8k
  Uno.Utils.DependencyInjection/  ~2.6k
    ServiceCollectionServiceExtensions.cs: mod Uno@13, class ServiceCollectionServiceExtensions@15-115, fn AddFromAttributes@22-25, ... +3
    AttributeDataExtensions.cs: mod Uno@5, class AttributeDataExtensions@7-114, fn TryCreate@15-16, ... +1
    ServiceAttribute.cs: mod Uno@5, class ServiceAttribute@12-48, fn ServiceAttribute@19-22
    ServiceCollectionExtensionAttribute.cs: mod Uno@5, class ServiceCollectionExtensionAttribute@16-23
  AddIns.cs: mod Uno@14, class AddIns@17-171, fn Discover@21-127, ... +2
  AddInsExtensions.cs: mod
... (2365 more chars)
```


---

## Case 15: uno — PASS
# semantic-search lab v3: tests for InitializeComponent analyzer
repo: /Users/bean/Documents/Develope/uno
scope: src
intent: test; kind: test; keywords: ['InitializeComponent', 'analyzer', 'tests', 'test']

## Commands executed
- [ok, 1008ms, matches=7601] test-text: srcwalk discover InitializeComponent,analyzer,tests,test --match any --as text --scope src --limit 12 --budget 3000

## Best candidates
1. `src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:10-125` — score=80.0, source=next-show, kind=text-hit
2. `src/SamplesApp/SamplesApp.UITests/RuntimeTests.cs:95-106` `RunRuntimeTests` — score=80.0, source=next-show, kind=text-hit
3. `src/SamplesApp/UITests.Shared/Windows_Storage/NativeStorageRuntimeTests.xaml:8-20` — score=80.0, source=next-show, kind=text-hit

## Evidence expansion
### Expansion 1: context:src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:10-125 (ok, 26ms)
```text
# Context Packet: src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:10-125
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:10-125

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L36 new PackageIdentity(arg1="Uno.WinUI", arg2="5.2.161")
- L38 new PackageIdentity(arg1="Uno.UI", arg2="5.2.161")
- L41 _net80WithUno = ReferenceAssemblies.Net.Net80.AddPackages(arg1=_unoPackage)
- L65 new Verify.Test
- L86 VerifyAsync(arg1=("Test.cs", code), arg2=("XamlCodeGenerator.cs", InitComponentImpl))
- L87 VerifyAsync(arg1=("XamlCodeGenerator.cs", InitComponentImpl), arg2=("Test.cs", code))
- L110 VerifyAsync(arg1=("Test.cs", code), arg2=("Xa
... (611 more chars)
```

### Expansion 2: context:src/SamplesApp/SamplesApp.UITests/RuntimeTests.cs:95-106 (ok, 186ms)
```text
# Context Packet: src/SamplesApp/SamplesApp.UITests/RuntimeTests.cs:95-106
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/SamplesApp/SamplesApp.UITests/RuntimeTests.cs:30-110 RunRuntimeTests

## Flow Map
shape: 1 entry, 1 decision, 0 loops, 1 exit, 6 actions, 1 summary
N1 entry :30-110 entry
  next -> N2 summary :35-93 pre-target statements x14
N2 summary :35-93 pre-target statements x14
  next -> N3 action :95 TestContext.AddTestAttachment(await ArchiveResults(unitTestsControl), "runtimetests-results.zip…
N3 action :95 TestContext.AddTestAttachment(await ArchiveResults(unitTestsControl), "runtimetests-results.zip…
  calls: TestContext.AddTestAttachment :95
  reads: ArchiveResults call_arg :95; unitTestsControl call_arg :95
  next -> N4 action :97 GetValue(nameof(unitTestsControl), unitTestsControl, "FailedTestCountForUITest")
N4
... (2010 more chars)
```

### Expansion 3: context:src/SamplesApp/UITests.Shared/Windows_Storage/NativeStorageRuntimeTests.xaml:8-20 (ok, 4ms)
```text
# Context Packet: src/SamplesApp/UITests.Shared/Windows_Storage/NativeStorageRuntimeTests.xaml:8-20

(not a code file)
```


---

## Case 16: srcwalk — PASS
# semantic-search lab v3: how does discover rank results?
repo: /Users/bean/Documents/Develope/Ultra-lab/tilth
scope: src
intent: general; kind: general; keywords: ['discover', 'results', 'result', 'rank']

## Commands executed
- [ok, 39ms, matches=698] text-any: srcwalk discover discover,results,result,rank --match any --as text --scope src --limit 12 --budget 3000

## Best candidates
1. `src/search/display/glob_result.rs:45-73` — score=55.0, source=next-show, kind=text-hit
2. `src/search/display/glob_result.rs:1` — score=45.0, source=ranked-file, kind=file
3. `src/search/io.rs:130-132` — score=40.0, source=next-show, kind=text-hit

## Evidence expansion
### Expansion 1: context:src/search/display/glob_result.rs:45-73 (ok, 12ms)
```text
# Context Packet: src/search/display/glob_result.rs:45-73
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/search/display/glob_result.rs:45-73

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L51 header = format!(
- L62 _ = write!(
- L70 append_grouped_files(arg1=&mut out, arg2=&result.files, arg3=scope)
- L72 shown_end = result.files.len()

### Resolved local callees
  [fn] append_grouped_files src/search/display/glob_result.rs:11-43  fn append_grouped_files(out: &mut String, files: &[glob::GlobFileEntry], scope: &Path)
  [fn] SrcwalkError src/error.rs:7-42


### Callers
- not available for non-symbol range targets

> Caveat: static context packet is capped; verify exact edges with trace commands.
... (68 more chars)
```

### Expansion 2: context:src/search/display/glob_result.rs:1 (ok, 10ms)
```text
# Context Packet: src/search/display/glob_result.rs:1
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/search/display/glob_result.rs:1-1

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

> Next: srcwalk show src/search/display/glob_result.rs:1-1 -C 20
```

### Expansion 3: context:src/search/io.rs:130-132 (ok, 11ms)
```text
# Context Packet: src/search/io.rs:130-132
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/search/io.rs:130-132

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

> Next: srcwalk show src/search/io.rs:130-132 -C 20
```


---

## Case 17: srcwalk — PASS
# semantic-search lab v3: who calls rank_matches?
repo: /Users/bean/Documents/Develope/Ultra-lab/tilth
scope: src
intent: callers; kind: intent_symbol; keywords: ['rank_matches', 'rank_matche', 'rank_match', 'calls', 'call']

## Commands executed
- [ok, 18ms] symbol-exact: srcwalk discover rank_matches --as symbol --scope src --limit 10 --budget 3000
- [ok, 20ms] symbol-lower: srcwalk discover rank_matches --as symbol --scope src --limit 10 --budget 2500
- [ok, 39ms] symbol-glob: srcwalk discover '*rank_matches*' --as symbol --scope src --limit 10 --budget 2500
- [ok, 23ms, matches=96] text-any: srcwalk discover rank_matches,rank_matche,rank_match,calls --match any --as text --scope src --limit 10 --budget 3000

## Best candidates
1. `src/search/callers/single/callsite_filter_tests.rs:19-106` — score=45.0, source=next-show, kind=text-hit
2. `src/search/callers/single/callsite_filter_tests.rs:1` — score=35.0, source=ranked-file, kind=file

## Evidence expansion
### Expansion 1: context:src/search/callers/single/callsite_filter_tests.rs:19-106 (ok, 13ms)
```text
# Context Packet: src/search/callers/single/callsite_filter_tests.rs:19-106
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/search/callers/single/callsite_filter_tests.rs:19-106

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L21 filters = parse_callsite_filters(Some("args:2 prefix:client receiver:client caller:main")).expect(arg1="valid filters")
- L22 assert_eq!(filters.len(), 4)
- L23 assert_eq!(filters[0].field, "args")
- L24 assert_eq!(filters[0].value, "2")
- L25 assert_eq!(filters[1].field, "receiver")
- L26 assert_eq!(filters[2].field, "receiver")
- L31 err = parse_callsite_filters(Some("unknown:x")).expect_err(arg1="invalid field")
- L32 assert!(err.to_string().contains("unsupported filt
... (666 more chars)
```

### Expansion 2: trace-callers:rank_matches (ok, 9ms)
```text
# Callers of "rank_matches" in src — no call sites found

> Caveat: direct by-name search only; misses dynamic dispatch, reflection, macros.
> Next: use `srcwalk discover rank_matches` or search interface/trait/implementor names.
```

