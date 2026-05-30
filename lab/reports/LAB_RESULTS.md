# Query Router Lab Test Results

## Test Date
2026-05-30

## Test Repos
1. `~/Documents/Develope/uno` - .NET project
2. `~/Documents/Develope/Bifrost/bifrost` - Go project (cli + core)

---

## Test Results Summary

### ✅ Working Cases

#### 1. Overview intent detection
**Query:** "overview of cli"
- ✅ Correctly detected `overview` intent
- ✅ Routed to `srcwalk overview --scope ... --symbols`
- ✅ Got useful structural output (4054 chars)
- **Result:** GOOD

#### 2. Natural language with good keywords
**Query:** "how does authentication work?"
- ✅ Extracted keywords: `work`, `authentication`
- ✅ Routed to text search with OR
- ✅ Got 19027 matches across 4843 files
- ✅ Ranked by term coverage
- **Result:** GOOD (but too broad, needs ranking improvement)

#### 3. Caller intent detection
**Query:** "who calls Authenticate?"
- ✅ Correctly detected `callers` intent
- ✅ Routed to symbol discover first
- ✅ Got 9 matches (1 definition, 8 usages)
- ✅ Fallback ready: `trace callers`
- **Result:** GOOD

#### 4. Broad text search
**Query:** "find configuration code"
- ✅ Extracted keywords: `find`, `code`, `configuration`
- ✅ Got 6620 matches across 911 files
- ✅ Ranked by term coverage
- **Result:** WORKS but too broad

---

## ❌ Problem Cases

### 1. Symbol-like query misrouted
**Query:** "handleAuth"
- ❌ Detected as `general` instead of `symbol`
- ❌ Routed to text search instead of symbol search
- ❌ Got 0 matches
- **Root cause:** `is_symbol_like()` failed to detect CamelCase properly
- **Fix needed:** Improve CamelCase detection regex

**Current regex:**
```python
if re.match(r'^[A-Z][a-zA-Z0-9]*$', query):  # CamelCase
```

**Problem:** `handleAuth` starts with lowercase `h`, not uppercase.

**Should be:**
```python
# Mixed case (camelCase or PascalCase)
if re.search(r'[a-z][A-Z]|[A-Z][a-z]', query):
    return True
```

### 2. "what is in core?" - wrong intent
**Query:** "what is in core?"
- ❌ Detected as `general` instead of `overview`
- ❌ Routed to text search for "core"
- ❌ Got 815 matches (too broad, mostly imports)
- **Root cause:** "what is in" pattern not in overview detection
- **Fix needed:** Add pattern `"what is in"` to overview intent

---

## Key Findings

### 1. Intent Detection Issues

**Missing patterns:**
- `"what is in X"` should trigger `overview`
- `"show me X"` should trigger appropriate intent
- `"explain X"` should trigger definition/context

**Current patterns work:**
- ✅ "overview of"
- ✅ "who calls"
- ✅ "how does X work"

### 2. Symbol Detection Issues

**Current logic too strict:**
- Only matches pure CamelCase (PascalCase) starting with uppercase
- Misses camelCase (starting lowercase)
- Misses mixed patterns

**Should detect:**
- `handleAuth` (camelCase)
- `HandleAuth` (PascalCase)
- `run_context` (snake_case) ✅ works
- `QueryPlan` (PascalCase) ✅ works

### 3. Keyword Extraction Issues

**Problem:** Extracts too many weak keywords
- "find configuration code" → `find`, `code`, `configuration`
- "find" and "code" are weak, generic terms
- Results in 6620 matches (too broad)

**Should:**
- Filter out generic verbs: `find`, `show`, `get`, `make`
- Prioritize domain-specific nouns: `configuration`, `authentication`
- Limit to top 2-3 strongest keywords

### 4. Fallback Strategy Works

**Good:**
- Primary fails → fallback ready
- Multiple fallback options available
- No crashes or errors

**Needs:**
- Auto-execute fallback when primary returns 0 matches
- Currently just prints fallback, doesn't run it

---

## Recommendations

### Priority 1: Fix Symbol Detection

```python
def is_symbol_like(query: str) -> bool:
    query = query.strip()
    if ' ' in query:
        return False
    
    # camelCase or PascalCase (mixed case)
    if re.search(r'[a-z][A-Z]|[A-Z][a-z]', query):
        return True
    
    # snake_case
    if re.match(r'^[a-z_][a-z0-9_]*$', query):
        return True
    
    # SCREAMING_SNAKE_CASE
    if re.match(r'^[A-Z_][A-Z0-9_]*$', query):
        return True
    
    # Contains :: or ->
    if '::' in query or '->' in query:
        return True
    
    return False
```

### Priority 2: Improve Intent Detection

```python
INTENT_PATTERNS = {
    "overview": [
        "overview", "architecture", "structure", "map",
        "what is in",  # ADD THIS
        "show me the structure",
        "list files in",
    ],
    # ... rest
}
```

### Priority 3: Better Keyword Filtering

```python
WEAK_KEYWORDS = {
    'find', 'show', 'get', 'make', 'create', 'build',
    'code', 'file', 'function', 'class',  # too generic
}

def extract_keywords(query: str) -> List[str]:
    # ... existing logic ...
    
    # Filter weak keywords
    keywords = [k for k in keywords if k not in WEAK_KEYWORDS]
    
    # Prioritize longer, more specific terms
    keywords.sort(key=len, reverse=True)
    
    return keywords[:3]  # limit to top 3
```

### Priority 4: Auto-execute Fallback

```python
def test_query(query, scope, repo_name):
    # ... existing ...
    
    output, code = run_srcwalk(plan.primary_cmd)
    
    # Check if empty/no matches
    if code == 0 and ('0 matches' in output or len(output) < 100):
        print("⚠️  Primary returned no useful results, trying fallback...")
        for fb_cmd in plan.fallback_cmds:
            # ... auto-execute ...
```

---

## Next Steps

1. **Fix symbol detection** - highest impact
2. **Add missing intent patterns** - easy win
3. **Improve keyword extraction** - reduce noise
4. **Auto-execute fallback** - better UX
5. **Add more test cases** - validate fixes

---

## Test Coverage

Tested intents:
- ✅ Overview
- ✅ Callers
- ✅ General/natural language
- ❌ Callees (not tested)
- ❌ Deps (not tested)
- ❌ Explicit target path:line (not tested)
- ❌ File path (not tested)

Need more test cases for full coverage.
