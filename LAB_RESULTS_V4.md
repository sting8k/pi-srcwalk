# Query Router Lab Test v4 - BM25/PRF Run

Total cases: 17
Summary: PASS=17, PARTIAL=0, FAIL=0, elapsed=37534ms


---

## Case 1: bifrost — PASS
# semantic-search lab v4: framework/modelcatalog/pricing.go:28
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: general; kind: explicit_target; keywords: ['modelcatalog', 'framework', 'pricing', 'pric']

## Commands executed
- [ok, 64ms] target-context: srcwalk context framework/modelcatalog/pricing.go:28 --scope . --budget 3500

## Best candidates
1. `framework/modelcatalog/pricing.go:28` `CalculateCost` — score=140.0, source=exact-context, kind=context-target
2. `framework/modelcatalog/pricing.go:48-65` `calculateCostWithCache` — score=90.0, source=definition, kind=fn
3. `framework/modelcatalog/pricing.go:83-135` `calculateBaseCost` — score=90.0, source=definition, kind=fn

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:28 (ok, 56ms)
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

### Expansion 2: context:framework/modelcatalog/pricing.go:48-65 (ok, 35ms)
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

### Expansion 3: context:framework/modelcatalog/pricing.go:83-135 (ok, 41ms)
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
# semantic-search lab v4: framework/modelcatalog/pricing.go
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: general; kind: file; keywords: ['modelcatalog', 'framework', 'pricing', 'pric']

## Commands executed
- [ok, 6ms] file-show: srcwalk show framework/modelcatalog/pricing.go --budget 3500
- [ok, 12ms] file-discover: srcwalk discover framework/modelcatalog/pricing.go --as file --scope . --limit 8 --budget 2500

## Best candidates
1. `framework/modelcatalog/pricing.go:1` — score=85.0, source=file-show, kind=file

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:1 (ok, 14ms)
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
# semantic-search lab v4: CalculateCost
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: general; kind: symbol; keywords: ['CalculateCost']

## Commands executed
- [ok, 95ms, matches=10] symbol-exact: srcwalk discover CalculateCost --as symbol --scope . --limit 10 --budget 3000

## Best candidates
1. `framework/modelcatalog/pricing.go:28-45` `CalculateCost` — score=140.0, source=definition, kind=fn
2. `tests/governance/test_utils.go:64-73` `CalculateCost` — score=125.0, source=definition, kind=fn
3. `framework/streaming/audio.go:117-199` `processAudioStreamingResponse` — score=80.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:28-45 (ok, 55ms)
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

### Expansion 2: context:tests/governance/test_utils.go:64-73 (ok, 44ms)
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
# semantic-search lab v4: how does model pricing cost calculation work?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: framework
intent: general; kind: general; keywords: ['calculation', 'pricing', 'model', 'pric', 'cost']

## Commands executed
- [ok, 570ms] bm25-prf: bm25 search 'how does model pricing cost calculation work?' --scope framework
- [ok, 59ms] symbol-glob: srcwalk discover '*calculation*' --as symbol --scope framework --limit 12 --budget 2500

## Notes
- BM25 index for scope `framework` has 889 chunks; cold build 568ms, query 570ms.

## Best candidates
1. `framework/modelcatalog/pricing.go:771-850` — score=113.2, source=bm25-prf, kind=chunk
2. `framework/modelcatalog/pricing.go:1-80` — score=111.1, source=bm25-prf, kind=chunk
3. `framework/modelcatalog/pricing.go:71-150` — score=104.6, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:771-850 (ok, 24ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:771-850
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:771-850

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L772 base, exists = mc.getBasePricing(arg1=resolvedModelUsed, arg2=provider, arg3=requestType)
- L774 result, _ = mc.applyPricingOverrides(arg1=resolvedModelUsed, arg2=requestType, arg3=*base, arg4=scopes)
- L778 mc.logger.Debug(arg1="pricing not found for resolved model %s, trying alias %s", arg2=resolvedModelUsed, arg3=originalModelRequested)
- L779 base, exists = mc.getBasePricing(arg1=originalModelRequested, arg2=provider, arg3=requestType)
- L782 result, _ = mc.applyPricingOverrides(arg1=resolvedModel
... (1644 more chars)
```

### Expansion 2: context:framework/modelcatalog/pricing.go:1-80 (ok, 24ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:1-80
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:1-80

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L39 result.GetExtraFields()
- L41 ->ret mc.calculateCostWithCache(arg1=result, arg2=cacheDebug, arg3=s)
- L44 ->ret mc.calculateBaseCost(arg1=result, arg2=s)
- L56 ->ret mc.computeCacheEmbeddingCost(arg1=cacheDebug, arg2=scopes)
- L62 baseCost = mc.calculateBaseCost(arg1=result, arg2=scopes)
- L63 embeddingCost = mc.computeCacheEmbeddingCost(arg1=cacheDebug, arg2=scopes)
- L75 pricing = mc.resolvePricing(arg1=*cacheDebug.ProviderUsed, arg2=*cacheDebug.ModelUsed, arg3="", arg4=schemas.EmbeddingRequest, arg5=scope
... (1373 more chars)
```

### Expansion 3: context:framework/modelcatalog/pricing.go:71-150 (ok, 24ms)
```text
# Context Packet: framework/modelcatalog/pricing.go:71-150
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- framework/modelcatalog/pricing.go:71-150

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L75 pricing = mc.resolvePricing(arg1=*cacheDebug.ProviderUsed, arg2=*cacheDebug.ModelUsed, arg3="", arg4=schemas.EmbeddingRequest, arg5=scopes)
- L79 float64(arg1=*cacheDebug.InputTokens)
- L79 tieredInputRate(arg1=pricing, arg2=*cacheDebug.InputTokens)
- L84 extraFields = result.GetExtraFields()
- L89 provider = string(arg1=extraFields.Provider)
- L95 input = extractCostInput(arg1=result)
- L108 requestType = normalizeStreamRequestType(arg1=requestType)
- L111 pricing = mc.resolvePricing(arg1=provider, arg2
... (2251 more chars)
```


---

## Case 5: bifrost — PASS
# semantic-search lab v4: who calls CalculateCost?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: framework
intent: callers; kind: intent_symbol; keywords: ['CalculateCost', 'calls', 'call']

## Commands executed
- [ok, 35ms, matches=10] symbol-exact: srcwalk discover CalculateCost --as symbol --scope framework --limit 10 --budget 3000

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
# semantic-search lab v4: what does CalculateCost call?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: framework
intent: callees; kind: intent_symbol; keywords: ['CalculateCost', 'call']

## Commands executed
- [ok, 37ms, matches=10] symbol-exact: srcwalk discover CalculateCost --as symbol --scope framework --limit 10 --budget 3000

## Best candidates
1. `framework/modelcatalog/pricing.go:28-45` `CalculateCost` — score=140.0, source=definition, kind=fn
2. `framework/streaming/audio.go:117-199` — score=80.0, source=next-context, kind=context-target
3. `framework/modelcatalog/pricing_test.go:837-863` — score=70.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:framework/modelcatalog/pricing.go:28-45 (ok, 37ms)
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

### Expansion 2: trace-callees:CalculateCost (ok, 47ms)
```text
# Callees: CalculateCost (framework/modelcatalog/pricing.go)

L39 result.GetExtraFields()
L41 ->ret mc.calculateCostWithCache(arg1=result, arg2=cacheDebug, arg3=s)
L44 ->ret mc.calculateBaseCost(arg1=result, arg2=s)

> Caveat: detailed call sites can be long. Retry with --budget <N>, or omit --detailed for resolved callee summaries.
```


---

## Case 7: bifrost — PASS
# semantic-search lab v4: deps of framework/modelcatalog/pricing.go
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: deps; kind: file_deps; keywords: ['modelcatalog', 'framework', 'pricing', 'deps', 'pric']

## Commands executed
- [ok, 43ms] file-deps: srcwalk deps framework/modelcatalog/pricing.go --budget 3500

## Best candidates
1. `framework/modelcatalog/pricing.go:1` — score=90.0, source=file-deps, kind=file

## Evidence expansion
### Expansion 1: deps:framework/modelcatalog/pricing.go (ok, 41ms)
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
# semantic-search lab v4: tests for semantic cache
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: tests
intent: test; kind: test; keywords: ['semantic', 'tests', 'cache', 'test']

## Commands executed
- [ok, 686ms] bm25-prf: bm25 search 'tests for semantic cache' --scope tests

## Notes
- BM25 index for scope `tests` has 1194 chunks; cold build 684ms, query 686ms.

## Best candidates
1. `tests/integrations/python/tests/test_anthropic.py:1541-1620` — score=158.0, source=bm25-prf, kind=chunk
2. `tests/integrations/python/tests/test_bedrock.py:1681-1760` — score=156.0, source=bm25-prf, kind=chunk
3. `tests/integrations/python/tests/test_bedrock.py:1611-1690` — score=153.9, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:tests/integrations/python/tests/test_anthropic.py:1541-1620 (ok, 76ms)
```text
# Context Packet: tests/integrations/python/tests/test_anthropic.py:1541-1620
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- tests/integrations/python/tests/test_anthropic.py:1541-1620

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L1543 print(arg1="\nSecond request: Hitting cache with same messages checkpoint...")
- L1544 response2 = anthropic_client.messages.create(arg1=model=format_provider_model(provider, model), arg2=messages=[ { "role": "user", "content": [ {"type": "text", "text": "Here … he dispute resolution methods."}, ], } ], arg3=max_tokens=1024)
- L1563 assert_valid_chat_response(arg1=response2)
- L1564 cache_read_tokens = validate_cache_read(arg1=response2.usage, arg2="Second request"
... (2060 more chars)
```

### Expansion 2: context:tests/integrations/python/tests/test_bedrock.py:1681-1760 (ok, 46ms)
```text
# Context Packet: tests/integrations/python/tests/test_bedrock.py:1681-1760
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- tests/integrations/python/tests/test_bedrock.py:1681-1760

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L1685 pytest.skip(arg1="No providers configured for prompt_caching scenario")
- L1687 print(arg1=f"\n=== Testing Messages Caching for provider {provider} ===")
- L1688 print(arg1="First request: Creating cache with messages checkpoint...")
- L1691 response1 = bedrock_client.converse(arg1=modelId=format_provider_model(provider, model), arg2=messages=[ { "role": "user", "content": [ {"text": "Here is a large lega … in indemnification principles?"}, ], } ])
- L1708 cache_write_
... (1770 more chars)
```

### Expansion 3: context:tests/integrations/python/tests/test_bedrock.py:1611-1690 (ok, 47ms)
```text
# Context Packet: tests/integrations/python/tests/test_bedrock.py:1611-1690
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- tests/integrations/python/tests/test_bedrock.py:1611-1690

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L1611 time.sleep(arg1=2)
- L1613 print(arg1=f"Success: End-to-end batch workflow completed for provider {provider}")
- L1616 str(e).lower()
- L1617 pytest.skip(arg1=f"Batch API not authorized: {e}")
- L1620 pytest.mark.parametrize(arg1="provider,model", arg2=get_cross_provider_params_for_scenario("prompt_caching"))
- L1626 pytest.skip(arg1="No providers configured for prompt_caching scenario")
- L1628 print(arg1=f"\n=== Testing System Message Caching for provider {provider}
... (1650 more chars)
```


---

## Case 9: bifrost — PASS
# semantic-search lab v4: where is unicorn payment teleport implemented?
repo: /Users/bean/Documents/Develope/Bifrost/bifrost
scope: .
intent: definition; kind: intent_symbol; keywords: ['implemented', 'teleport', 'unicorn', 'payment']

## Commands executed
- [ok, 10688ms] bm25-prf: bm25 search 'where is unicorn payment teleport implemented?' --scope .
- [ok, 110ms, matches=10] symbol-exact: srcwalk discover implemented --as symbol --scope . --limit 10 --budget 3000

## Notes
- BM25 index for scope `.` has 10871 chunks; cold build 10676ms, query 10688ms.

## Best candidates
1. `docs/contributing/adding-a-provider.mdx:841-920` — score=98.0, source=bm25-prf, kind=chunk
2. `docs/contributing/adding-a-provider.mdx:911-990` — score=95.2, source=bm25-prf, kind=chunk
3. `docs/contributing/adding-a-provider.mdx:701-780` — score=90.7, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:docs/contributing/adding-a-provider.mdx:841-920 (ok, 7ms)
```text
# Context Packet: docs/contributing/adding-a-provider.mdx:841-920

(not a code file)
```

### Expansion 2: context:docs/contributing/adding-a-provider.mdx:911-990 (ok, 7ms)
```text
# Context Packet: docs/contributing/adding-a-provider.mdx:911-990

(not a code file)
```

### Expansion 3: context:docs/contributing/adding-a-provider.mdx:701-780 (ok, 5ms)
```text
# Context Packet: docs/contributing/adding-a-provider.mdx:701-780

(not a code file)
```


---

## Case 10: uno — PASS
# semantic-search lab v4: src/Uno.Foundation/Rect.cs
repo: /Users/bean/Documents/Develope/uno
scope: .
intent: general; kind: file; keywords: ['Foundation', 'Rect', 'Uno', 'src']

## Commands executed
- [ok, 7ms] file-show: srcwalk show src/Uno.Foundation/Rect.cs --budget 3500
- [ok, 55ms] file-discover: srcwalk discover src/Uno.Foundation/Rect.cs --as file --scope . --limit 8 --budget 2500

## Best candidates
1. `src/Uno.Foundation/Rect.cs:1` — score=85.0, source=file-show, kind=file

## Evidence expansion
### Expansion 1: context:src/Uno.Foundation/Rect.cs:1 (ok, 31ms)
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
# semantic-search lab v4: Rect
repo: /Users/bean/Documents/Develope/uno
scope: .
intent: general; kind: symbol; keywords: ['Rect']

## Commands executed
- [ok, 2459ms, matches=10] symbol-exact: srcwalk discover Rect --as symbol --scope . --limit 10 --budget 3000

## Best candidates
1. `src/Uno.UWP/Graphics/Interop/Direct2D/D2D1RoundedRect.cs:8-8` `Rect` — score=145.0, source=definition, kind=definition
2. `src/Uno.Foundation/FoundationFeatureConfiguration.cs:15-31` `Rect` — score=130.0, source=definition, kind=class
3. `src/Uno.UI.RuntimeTests/UITests/_Engine/QueryResult.cs:22-22` `Rect` — score=120.0, source=definition, kind=property

## Evidence expansion
### Expansion 1: context:src/Uno.UWP/Graphics/Interop/Direct2D/D2D1RoundedRect.cs:8-8 (ok, 26ms)
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

### Expansion 2: context:src/Uno.Foundation/FoundationFeatureConfiguration.cs:15-31 (ok, 27ms)
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

### Expansion 3: context:src/Uno.UI.RuntimeTests/UITests/_Engine/QueryResult.cs:22-22 (ok, 28ms)
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
# semantic-search lab v4: how does remote control server start?
repo: /Users/bean/Documents/Develope/uno
scope: src
intent: general; kind: general; keywords: ['control', 'remote', 'server', 'start']

## Commands executed
- [ok, 17791ms] bm25-prf: bm25 search 'how does remote control server start?' --scope src
- [ok, 2064ms, matches=2] symbol-glob: srcwalk discover '*control*' --as symbol --scope src --limit 12 --budget 2500

## Notes
- BM25 index for scope `src` has 32805 chunks; cold build 17764ms, query 17791ms.

## Best candidates
1. `src/Uno.UI.RemoteControl.VS/EntryPoint.TelemetryEventListener.cs:1-65` — score=109.6, source=bm25-prf, kind=chunk
2. `src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:141-220` — score=100.0, source=bm25-prf, kind=chunk
3. `src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:1-80` — score=97.8, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:src/Uno.UI.RemoteControl.VS/EntryPoint.TelemetryEventListener.cs:1-65 (ok, 30ms)
```text
# Context Packet: src/Uno.UI.RemoteControl.VS/EntryPoint.TelemetryEventListener.cs:1-65
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.UI.RemoteControl.VS/EntryPoint.TelemetryEventListener.cs:1-65

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L32 TryForward(arg1=telemetryEvent)
- L36 TryForward(arg1=telemetryEvent)
- L48 _ = client.SendToDevServerAsync(arg1=new HotReloadEventIdeMessage(HotReloadEvent.Completed), arg2=ct.Token)
- L52 _ = client.SendToDevServerAsync(arg1=new HotReloadEventIdeMessage(HotReloadEvent.NoChanges), arg2=ct.Token)
- L56 _ = client.SendToDevServerAsync(arg1=new HotReloadEventIdeMessage(HotReloadEvent.Failed), arg2=ct.Token)
- L60 _ = client.SendToDevServerAsync(arg1
... (322 more chars)
```

### Expansion 2: context:src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:141-220 (ok, 40ms)
```text
# Context Packet: src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:141-220
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:141-220

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L142 events = ParseTelemetryFileIfExists(arg1=filePath)
- L143 started.Should().BeTrue()
- L144 events.Should().NotBeEmpty()
- L145 WriteEventsList(arg1=events)
- L146 AssertHasEvent(arg1=events, arg2="uno/dev-server/app-launch/launched")
- L147 AssertHasEvent(arg1=events, arg2="uno/dev-server/app-launch/connected")
- L150 AssertEventHasProperty(arg1=events, arg2="uno/dev-server/app-launch/connected", arg3="WasIdeIn
... (1006 more chars)
```

### Expansion 3: context:src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:1-80 (ok, 40ms)
```text
# Context Packet: src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:1-80
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.UI.RemoteControl.DevServer.Tests/AppLaunch/AppLaunchIntegrationTests.cs:1-80

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L13 _serverProcessorAssembly = ExternalDllDiscoveryHelper.DiscoverExternalDllPath(arg1=Logger, arg2=typeof(DevServerTestHelper).Assembly, arg3=projectName: "Uno.UI.RemoteControl.Server.Processors", arg4=dllFileName: "Uno.UI.RemoteControl.Server.Processors.dll")
- L21 GlobalClassInitialize<AppLaunchIntegrationTests>(arg1=context)
- L28 Assert.IsNotNull(arg1=solution)
- L29 solution.CreateSolutionFileAsync()
- L31 filePath
... (1122 more chars)
```


---

## Case 13: uno — PASS
# semantic-search lab v4: who calls StartCommandAsync?
repo: /Users/bean/Documents/Develope/uno
scope: src
intent: callers; kind: intent_symbol; keywords: ['StartCommandAsync', 'calls', 'call']

## Commands executed
- [ok, 464ms, matches=2] symbol-exact: srcwalk discover StartCommandAsync --as symbol --scope src --limit 10 --budget 3000

## Best candidates
1. `src/Uno.UI.RemoteControl.Host/Program.Command.cs:20-222` `StartCommandAsync` — score=140.0, source=definition, kind=fn
2. `src/Uno.UI.RemoteControl.Host/Program.cs:32-296` — score=80.0, source=next-context, kind=context-target

## Evidence expansion
### Expansion 1: context:src/Uno.UI.RemoteControl.Host/Program.Command.cs:20-222 (ok, 196ms)
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

### Expansion 2: trace-callers:StartCommandAsync (ok, 294ms)
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
# semantic-search lab v4: overview of src/Uno.UI.RemoteControl.Host
repo: /Users/bean/Documents/Develope/uno
scope: src/Uno.UI.RemoteControl.Host
intent: overview; kind: overview; keywords: ['RemoteControl', 'overview', 'Host', 'Uno', 'src']

## Commands executed
- [ok, 37ms] overview: srcwalk overview --scope src/Uno.UI.RemoteControl.Host --symbols

## Notes
- No parseable candidates. Returning best raw command output only.

## Best candidates
- none parsed

## Evidence expansion
### Expansion 1: overview (ok, 37ms)
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
# semantic-search lab v4: tests for InitializeComponent analyzer
repo: /Users/bean/Documents/Develope/uno
scope: src
intent: test; kind: test; keywords: ['InitializeComponent', 'analyzer', 'tests', 'test']

## Commands executed
- [ok, 38ms] bm25-prf: bm25 search 'tests for InitializeComponent analyzer' --scope src

## Notes
- BM25 index for scope `src` has 32805 chunks; cold build 17764ms, query 38ms.

## Best candidates
1. `src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:211-264` — score=163.0, source=bm25-prf, kind=chunk
2. `src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:141-220` — score=160.8, source=bm25-prf, kind=chunk
3. `src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:71-150` — score=158.8, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:211-264 (ok, 32ms)
```text
# Context Packet: src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:211-264
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:211-264

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L217 VerifyAsync(arg1=("Test.cs", codeWithDiagnostic), arg2=("XamlCodeGenerator.cs", InitComponentImpl))
- L218 VerifyAsync(arg1=("XamlCodeGenerator.cs", InitComponentImplWithDiagnostic), arg2=("Test.cs", code))
- L243 VerifyAsync(arg1=("Test.cs", codeWithDiagnostic), arg2=("XamlCodeGenerator.cs", InitComponentImpl))
- L244 VerifyAsync(arg1=("XamlCodeGenerator.cs", InitComponentImplWithDiagnostic), arg2=("Test.cs", code))
- L261 VerifyAsync(arg1=("T
... (613 more chars)
```

### Expansion 2: context:src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:141-220 (ok, 32ms)
```text
# Context Packet: src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:141-220
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:141-220

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L159 VerifyAsync(arg1=("Test.cs", codeWithDiagnostic), arg2=("XamlCodeGenerator.cs", InitComponentImpl))
- L160 VerifyAsync(arg1=("XamlCodeGenerator.cs", InitComponentImplWithDiagnostic), arg2=("Test.cs", code))
- L188 VerifyAsync(arg1=("Test.cs", codeWithDiagnostic), arg2=("XamlCodeGenerator.cs", InitComponentImpl))
- L189 VerifyAsync(arg1=("XamlCodeGenerator.cs", InitComponentImplWithDiagnostic), arg2=("Test.cs", code))
- L217 VerifyAsync(arg1=("T
... (665 more chars)
```

### Expansion 3: context:src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:71-150 (ok, 31ms)
```text
# Context Packet: src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:71-150
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/Uno.Analyzers.Tests/UnoInitializeComponentAnalyzerTests.cs:71-150

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L86 VerifyAsync(arg1=("Test.cs", code), arg2=("XamlCodeGenerator.cs", InitComponentImpl))
- L87 VerifyAsync(arg1=("XamlCodeGenerator.cs", InitComponentImpl), arg2=("Test.cs", code))
- L110 VerifyAsync(arg1=("Test.cs", code), arg2=("XamlCodeGenerator.cs", InitComponentImpl))
- L111 VerifyAsync(arg1=("XamlCodeGenerator.cs", InitComponentImpl), arg2=("Test.cs", code))
- L130 VerifyAsync(arg1=("Test.cs", code), arg2=("XamlCodeGenerator.cs", InitComponentI
... (576 more chars)
```


---

## Case 16: srcwalk — PASS
# semantic-search lab v4: how does discover rank results?
repo: /Users/bean/Documents/Develope/Ultra-lab/tilth
scope: src
intent: general; kind: general; keywords: ['discover', 'results', 'result', 'rank']

## Commands executed
- [ok, 318ms] bm25-prf: bm25 search 'how does discover rank results?' --scope src
- [ok, 47ms, matches=6] symbol-glob: srcwalk discover '*discover*' --as symbol --scope src --limit 12 --budget 2500

## Notes
- BM25 index for scope `src` has 613 chunks; cold build 318ms, query 318ms.

## Best candidates
1. `src/cli_run.rs:631-710` `run` — score=103.0, source=bm25-prf, kind=chunk
2. `src/commands/find.rs:141-220` `run_text_or_filtered_with_artifact` — score=100.4, source=bm25-prf, kind=chunk
3. `src/commands/find.rs:421-500` — score=96.8, source=bm25-prf, kind=chunk

## Evidence expansion
### Expansion 1: context:src/cli_run.rs:631-710 (ok, 47ms)
```text
# Context Packet: src/cli_run.rs:631-710
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/cli_run.rs:332-818 run

## Flow Map
shape: 1 entry, 17 decisions, 0 loops, 5 exits, 27 actions, 2 summaries
N1 entry :332-818 entry
  definitions: config parameter :332
  next -> N2 summary :333-621 pre-target statements x31
N2 summary :333-621 pre-target statements x31
  next -> N3 decision :623-644 config.access && !matches!(config.mode, Mode::MatchAll)
N3 decision :623-644 config.access && !matches!(config.mode, Mode::MatchAll)
  reads: config.access condition :623; matches condition :623; config condition :623; +3 more
  true -> N4 summary :624-627 pre-target statements x1
  false -> N9 decision :646-672 matches!(config.mode, Mode::Deps)
N4 summary :624-627 pre-target statements x1
  next -> N5 decision :628-631 scopes.len() > 1
N5 decision
... (10744 more chars)
```

### Expansion 2: context:src/commands/find.rs:141-220 (ok, 43ms)
```text
# Context Packet: src/commands/find.rs:141-220
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/commands/find.rs:138-230 run_text_or_filtered_with_artifact

## Flow Map
shape: 1 entry, 6 decisions, 1 loop, 4 exits, 23 actions
N1 entry :138-230 entry
  definitions: query parameter :139; scope parameter :140; budget_tokens parameter :141; +6 more
  next -> N2 action :149 comma_terms(query)
N2 action :149 comma_terms(query)
  calls: comma_terms :149
  writes: terms assignment_lhs :149
  reads: query call_arg :149
  next -> N3 decision :150-155 terms.len() < 2
N3 decision :150-155 terms.len() < 2
  reads: terms.len condition :150
  true -> N4 return :151-154 return Err(SrcwalkError::InvalidQuery { query: query.to_string(), reason: "discover --match any…
  false -> N5 decision :156-161 terms.len() > MAX_TEXT_OR_TERMS
N4 return :151-154 r
... (6547 more chars)
```

### Expansion 3: context:src/commands/find.rs:421-500 (ok, 36ms)
```text
# Context Packet: src/commands/find.rs:421-500
confidence: structural syntax
caveat: source-evidence navigation only; no runtime proof

## Target
- src/commands/find.rs:421-500

## Flow Map
file-level evidence only; structural function map unavailable for this target

## Exits
- not available from structural parser

## Call Neighborhood
### Callees (ordered)
- L421 segment.contains(arg1=".spec.")
- L435 ->ret search::search_content_expanded(arg1=query, arg2=scope, arg3=cache, arg4=&session::Session::new(), arg5=expand, arg6=None, ...)
- L461 terms = comma_terms(arg1=query)
- L462 terms.len()
- L463 ->ret Err(arg1=SrcwalkError::InvalidQuery { query: query.to_string(), reason: "discover … -5 comma-separated terms".to_string(), })
- L468 terms.len()
- L469 ->ret Err(arg1=SrcwalkError::InvalidQuery { query: query.to_string(), reason: "discover --match all supports 2-5 terms".to_string(), })
... (746 more chars)
```


---

## Case 17: srcwalk — PASS
# semantic-search lab v4: who calls rank_matches?
repo: /Users/bean/Documents/Develope/Ultra-lab/tilth
scope: src
intent: callers; kind: intent_symbol; keywords: ['rank_matches', 'rank_matche', 'rank_match', 'calls', 'call']

## Commands executed
- [ok, 21ms] symbol-exact: srcwalk discover rank_matches --as symbol --scope src --limit 10 --budget 3000
- [ok, 22ms] symbol-lower: srcwalk discover rank_matches --as symbol --scope src --limit 10 --budget 2500
- [ok, 41ms] symbol-glob: srcwalk discover '*rank_matches*' --as symbol --scope src --limit 10 --budget 2500
- [ok, 29ms, matches=96] text-any: srcwalk discover rank_matches,rank_matche,rank_match,calls --match any --as text --scope src --limit 10 --budget 3000

## Best candidates
1. `src/search/callers/single/callsite_filter_tests.rs:19-106` — score=45.0, source=next-show, kind=text-hit
2. `src/search/callers/single/callsite_filter_tests.rs:1` — score=35.0, source=ranked-file, kind=file

## Evidence expansion
### Expansion 1: context:src/search/callers/single/callsite_filter_tests.rs:19-106 (ok, 18ms)
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

### Expansion 2: trace-callers:rank_matches (ok, 15ms)
```text
# Callers of "rank_matches" in src — no call sites found

> Caveat: direct by-name search only; misses dynamic dispatch, reflection, macros.
> Next: use `srcwalk discover rank_matches` or search interface/trait/implementor names.
```

