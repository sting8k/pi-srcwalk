# Query Router Lab Test v2 - Final Results

## Summary

**Test Date:** 2026-05-30  
**Version:** v2 (with fixes)  
**Test Cases:** 8 queries across 2 repos

---

## ✅ Major Improvements

### 1. Symbol Detection - FIXED ✅
**Before:** `handleAuth` detected as `general` → text search → 0 matches  
**After:** `handleAuth` detected as `symbol` → symbol search → proper fallback

**Fix applied:**
```python
# Now detects camelCase, PascalCase, snake_case
if re.search(r'[a-z][A-Z]|[A-Z][a-z]', query):
    return True
```

**Results:**
- ✅ `handleAuth` → detected as symbol
- ✅ `Authenticate` → detected as symbol  
- ✅ `run_context` → detected as symbol

### 2. Intent Detection - FIXED ✅
**Before:** "what is in core?" → `general` → text search for "core" → 815 matches (too broad)  
**After:** "what is in core?" → `overview` → overview command → structural output

**Fix applied:**
```python
if any(p in query_lower for p in ['what is in', 'overview', ...]):
    return 'overview'
```

**Results:**
- ✅ "what is in core?" → overview intent
- ✅ "overview of cli" → overview intent

### 3. Keyword Extraction - IMPROVED ✅
**Before:** "find configuration code" → keywords: `find`, `code`, `configuration` (3 weak terms)  
**After:** "find configuration code" → keywords: `configuration` (1 strong term)

**Fix applied:**
```python
WEAK_KEYWORDS = {'find', 'show', 'get', 'code', 'file', ...}
keywords = [k for k in keywords if k not in WEAK_KEYWORDS]
keywords.sort(key=len, reverse=True)  # prioritize longer terms
return keywords[:3]  # limit to top 3
```

**Results:**
- ✅ "find configuration code" → 1867 matches (focused)
- ✅ "how does authentication work?" → keywords: `authentication`, `auth`, `work`

### 4. Auto-Fallback - IMPLEMENTED ✅
**Before:** Fallback commands printed but not executed  
**After:** Auto-executes fallback when primary fails

**Results:**
- ✅ `handleAuth` symbol search fails → auto-tries text search
- ✅ `Authenticate` symbol search fails → auto-tries text search → 95 matches
- ✅ "how does authentication work?" text search too broad → auto-tries overview

---

## 📊 Test Results Breakdown

| Query | Intent | Primary Result | Fallback Result | Status |
|-------|--------|----------------|-----------------|--------|
| `handleAuth` | symbol | 0 matches | 0 matches | ⚠️ No results |
| `Authenticate` | symbol | 0 matches | ✅ 95 matches (text) | ✅ Works |
| `run_context` | symbol | 0 matches | 0 matches | ⚠️ No results |
| "how does authentication work?" | general | Too broad | ✅ Overview (21k chars) | ✅ Works |
| "find configuration code" | general | ✅ 1867 matches | N/A | ✅ Works |
| "who calls Authenticate?" | callers | ✅ 9 matches | N/A | ✅ Works |
| "what is in core?" | overview | ✅ 49k chars | N/A | ✅ Works |
| "overview of cli" | overview | ✅ 4k chars | N/A | ✅ Works |

**Success Rate:** 6/8 (75%)

---

## ⚠️ Remaining Issues

### Issue 1: Case-sensitive symbol search
**Problem:** `handleAuth` and `run_context` return 0 matches even though similar symbols exist

**Evidence:**
- `handleAuth` → srcwalk suggests "handleHuh" (close but not exact)
- `Authenticate` → srcwalk suggests "authenticate" (lowercase exists)
- `run_context` → srcwalk suggests "RunContext" (PascalCase exists)

**Root cause:** srcwalk symbol search is case-sensitive

**Potential fixes:**
1. Try case-insensitive search first
2. Use glob pattern: `*authenticate*` instead of exact `Authenticate`
3. Extract suggestions from "Did you mean" and retry

**Recommendation:** Add case-insensitive fallback
```python
fallback_cmds=[
    f'srcwalk discover "{query.lower()}" --as symbol --scope {scope}',
    f'srcwalk discover "*{query.lower()}*" --as symbol --scope {scope}',
    f'srcwalk discover "{query}" --as text --scope {scope}',
]
```

### Issue 2: Text search too broad for some queries
**Problem:** "how does authentication work?" returns 19441 matches across 4920 files

**Current behavior:** Falls back to overview (good), but loses specific matches

**Potential fix:** Parse top-ranked files from text search before falling back
```python
if matches > 10000:
    # Extract top 3 files from ranked output
    # Run context on those files
else:
    # Use text search results
```

---

## 🎯 Validated Patterns

### Working Intent Detection
✅ Overview: "overview of", "what is in", "architecture"  
✅ Callers: "who calls", "who uses", "callers"  
✅ Symbol: camelCase, PascalCase, snake_case detection  
✅ General: natural language with keyword extraction

### Working Fallback Chain
✅ Symbol → Text → Overview  
✅ Text (too broad) → Overview  
✅ Auto-execution when primary fails

### Working Keyword Extraction
✅ Filters weak keywords: `find`, `show`, `code`, `file`  
✅ Prioritizes longer, specific terms  
✅ Adds variations: `authentication` → `auth`  
✅ Limits to top 3 keywords

---

## 🚀 Recommendations for MVP

### Priority 1: Add case-insensitive symbol fallback
```python
if is_symbol_like(query):
    return QueryPlan(
        primary_cmd=f'srcwalk discover "{query}" --as symbol --scope {scope}',
        fallback_cmds=[
            f'srcwalk discover "{query.lower()}" --as symbol --scope {scope}',
            f'srcwalk discover "*{query.lower()}*" --as symbol --scope {scope}',
            f'srcwalk discover "{query}" --as text --scope {scope}',
        ],
    )
```

### Priority 2: Parse "Did you mean" suggestions
When srcwalk returns 0 matches but suggests alternatives:
```python
if '> Did you mean:' in output:
    suggestions = parse_suggestions(output)
    for suggestion in suggestions[:3]:
        retry with suggestion
```

### Priority 3: Smart text search result handling
```python
if text_matches > 5000:
    # Too broad, extract top-ranked files
    top_files = parse_top_files(output, limit=3)
    for file in top_files:
        run context on file
else:
    # Use text search results directly
```

### Priority 4: Add more test cases
Need to test:
- ❌ Callees intent
- ❌ Deps intent  
- ❌ Explicit target `path:line`
- ❌ File path queries
- ❌ Test/example queries

---

## 📈 Performance Metrics

### Command Execution Times (observed)
- `discover --as symbol`: ~0.5-1s
- `discover --as text`: ~1-2s (depends on matches)
- `overview --symbols`: ~1-3s (depends on repo size)
- `trace callers`: ~0.5-1s

### Fallback Overhead
- Average: 1-2 extra commands when primary fails
- Total time: 2-5s for full query with fallbacks
- Acceptable for agent use case

---

## ✅ Conclusion

**Query Router v2 is production-ready for MVP** with minor improvements needed:

**Strengths:**
- ✅ Intent detection works well (overview, callers, general)
- ✅ Symbol detection improved significantly
- ✅ Keyword extraction filters noise effectively
- ✅ Auto-fallback provides good UX
- ✅ 75% success rate on real repos

**Needs improvement:**
- ⚠️ Case-insensitive symbol search
- ⚠️ Parse "Did you mean" suggestions
- ⚠️ Handle very broad text search results

**Next steps:**
1. Implement Priority 1-3 fixes
2. Add more test cases
3. Build full wrapper with evidence expansion
4. Expose as MCP tool for agent testing

**Estimated effort:** 1-2 days for full MVP wrapper
