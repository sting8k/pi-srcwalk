#!/usr/bin/env python3
"""
Query Router Lab Test v2
Fixed version based on lab results
"""

import subprocess
import re
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class QueryPlan:
    query: str
    intent: str
    keywords: List[str]
    primary_cmd: str
    fallback_cmds: List[str]
    should_trace_callers: bool = False
    should_trace_callees: bool = False
    should_get_deps: bool = False


# Weak keywords to filter out
WEAK_KEYWORDS = {
    'find', 'show', 'get', 'make', 'create', 'build', 'see',
    'code', 'file', 'function', 'class', 'method',  # too generic
    'look', 'check', 'view', 'display',
}


def is_symbol_like(query: str) -> bool:
    """Detect symbol-like query: camelCase, PascalCase, snake_case"""
    query = query.strip()
    
    # Must be single token
    if ' ' in query:
        return False
    
    # camelCase or PascalCase (mixed case)
    if re.search(r'[a-z][A-Z]|[A-Z][a-z]', query):
        return True
    
    # snake_case
    if re.match(r'^[a-z_][a-z0-9_]*$', query) and '_' in query:
        return True
    
    # SCREAMING_SNAKE_CASE
    if re.match(r'^[A-Z_][A-Z0-9_]*$', query) and '_' in query:
        return True
    
    # Contains :: or -> (namespace/pointer syntax)
    if '::' in query or '->' in query:
        return True
    
    return False


def is_file_path(query: str) -> bool:
    """Detect file/path query"""
    query = query.strip()
    # Has / or file extension
    if '/' in query:
        return True
    if re.search(r'\.\w{1,4}$', query):  # .rs, .ts, .py, etc
        return True
    return False


def has_target_location(query: str) -> bool:
    """Detect explicit target like path:line"""
    return bool(re.search(r'[\w./-]+\.\w+:\d+', query))


def extract_keywords(query: str) -> List[str]:
    """Extract keywords from natural language query"""
    stop_words = {'how', 'does', 'the', 'a', 'an', 'is', 'are', 'what', 'where', 
                  'who', 'when', 'why', 'this', 'that', 'it', 'of', 'for', 'to',
                  'in', 'on', 'at', 'by', 'with', 'from'}
    
    # Remove punctuation
    query = re.sub(r'[?!.,;:]', '', query.lower())
    tokens = query.split()
    
    # Filter stop words and short tokens
    keywords = [t for t in tokens if t not in stop_words and len(t) > 2]
    
    # Filter weak keywords
    keywords = [k for k in keywords if k not in WEAK_KEYWORDS]
    
    # Add variations
    expanded = []
    for kw in keywords:
        expanded.append(kw)
        # "ranking" → "rank"
        if kw.endswith('ing') and len(kw) > 4:
            expanded.append(kw[:-3])
        # "searches" → "search"
        if kw.endswith('es') and len(kw) > 3:
            expanded.append(kw[:-2])
        # "authentication" → "auth"
        if kw.endswith('ication') and len(kw) > 8:
            expanded.append(kw[:4])
    
    # Dedupe and sort by length (longer = more specific)
    keywords = list(set(expanded))
    keywords.sort(key=len, reverse=True)
    
    # Limit to top 3
    return keywords[:3]


def detect_intent(query: str) -> str:
    """Detect query intent"""
    query_lower = query.lower()
    
    # Overview patterns
    if any(p in query_lower for p in ['overview', 'architecture', 'structure', 'map',
                                       'what is in', 'show me the structure', 'list files']):
        return 'overview'
    
    # Caller patterns
    if any(p in query_lower for p in ['who calls', 'who uses', 'callers', 'used by', 
                                       'usage of', 'where is it used']):
        return 'callers'
    
    # Callee patterns
    if any(p in query_lower for p in ['what calls', 'callees', 'call flow', 
                                       'what does it call', 'downstream']):
        return 'callees'
    
    # Deps patterns
    if any(p in query_lower for p in ['deps', 'dependencies', 'imports', 
                                       'what imports', 'what does it import']):
        return 'deps'
    
    # Definition patterns
    if any(p in query_lower for p in ['where is', 'defined', 'definition', 
                                       'implementation', 'where can i find']):
        return 'definition'
    
    # Test patterns
    if any(p in query_lower for p in ['test', 'tests', 'spec', 'example']):
        return 'test'
    
    return 'general'


def route_query(query: str, scope: str = ".") -> QueryPlan:
    """
    Main Query Router logic - FIXED VERSION
    """
    # Priority 1: Explicit target
    if has_target_location(query):
        target = re.search(r'[\w./-]+\.\w+:\d+(-\d+)?', query).group(0)
        intent = detect_intent(query)
        return QueryPlan(
            query=query,
            intent='explicit_target',
            keywords=[],
            primary_cmd=f'srcwalk context {target} --scope {scope}',
            fallback_cmds=[],
            should_trace_callers='call' in intent,
            should_trace_callees='callee' in intent,
            should_get_deps='dep' in intent,
        )
    
    # Priority 2: File/path
    if is_file_path(query):
        return QueryPlan(
            query=query,
            intent='file',
            keywords=[],
            primary_cmd=f'srcwalk show {query.strip()}',
            fallback_cmds=[f'srcwalk discover "{query.strip()}" --as file --scope {scope}'],
        )
    
    intent = detect_intent(query)
    
    # Priority 3: Overview intent
    if intent == 'overview':
        return QueryPlan(
            query=query,
            intent='overview',
            keywords=[],
            primary_cmd=f'srcwalk overview --scope {scope} --symbols',
            fallback_cmds=[],
        )
    
    # Priority 4: Callers intent
    if intent == 'callers':
        keywords = extract_keywords(query)
        symbol = keywords[0] if keywords else query.split()[-1]  # last word often the symbol
        return QueryPlan(
            query=query,
            intent='callers',
            keywords=keywords,
            primary_cmd=f'srcwalk discover "{symbol}" --as symbol --scope {scope}',
            fallback_cmds=[f'srcwalk trace callers {symbol} --scope {scope}'],
            should_trace_callers=True,
        )
    
    # Priority 5: Callees intent
    if intent == 'callees':
        keywords = extract_keywords(query)
        symbol = keywords[0] if keywords else query.split()[-1]
        return QueryPlan(
            query=query,
            intent='callees',
            keywords=keywords,
            primary_cmd=f'srcwalk discover "{symbol}" --as symbol --scope {scope}',
            fallback_cmds=[f'srcwalk trace callees {symbol} --detailed --scope {scope}'],
            should_trace_callees=True,
        )
    
    # Priority 6: Deps intent
    if intent == 'deps':
        keywords = extract_keywords(query)
        # Try to find file in query
        file_match = re.search(r'[\w./-]+\.\w+', query)
        if file_match:
            file = file_match.group(0)
            return QueryPlan(
                query=query,
                intent='deps',
                keywords=keywords,
                primary_cmd=f'srcwalk deps {file}',
                fallback_cmds=[],
                should_get_deps=True,
            )
        else:
            symbol = keywords[0] if keywords else query.split()[-1]
            return QueryPlan(
                query=query,
                intent='deps',
                keywords=keywords,
                primary_cmd=f'srcwalk discover "{symbol}" --as symbol --scope {scope}',
                fallback_cmds=[],
                should_get_deps=True,
            )
    
    # Priority 7: Symbol-like (FIXED)
    if is_symbol_like(query):
        return QueryPlan(
            query=query,
            intent='symbol',
            keywords=[query.strip()],
            primary_cmd=f'srcwalk discover "{query.strip()}" --as symbol --scope {scope}',
            fallback_cmds=[f'srcwalk discover "{query.strip()}" --as text --scope {scope}'],
        )
    
    # Priority 8: Natural language / default
    keywords = extract_keywords(query)
    if not keywords:
        # No good keywords, try overview
        return QueryPlan(
            query=query,
            intent='general_fallback',
            keywords=[],
            primary_cmd=f'srcwalk overview --scope {scope} --symbols',
            fallback_cmds=[],
        )
    
    keyword_str = ','.join(keywords)
    
    return QueryPlan(
        query=query,
        intent='general',
        keywords=keywords,
        primary_cmd=f'srcwalk discover "{keyword_str}" --match any --as text --scope {scope}',
        fallback_cmds=[
            f'srcwalk discover "*{keywords[0]}*" --as symbol --scope {scope}',
            f'srcwalk overview --scope {scope} --symbols',
        ],
    )


def run_srcwalk(cmd: str) -> tuple[str, int]:
    """Execute srcwalk command and return output"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout + result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "Command timed out", -1
    except Exception as e:
        return f"Error: {e}", -1


def is_empty_result(output: str, code: int) -> bool:
    """Check if srcwalk returned empty/no useful results"""
    if code != 0:
        return True
    if not output or len(output.strip()) < 50:
        return True
    if '0 matches' in output:
        return True
    return False


def test_query(query: str, scope: str, repo_name: str):
    """Test a single query"""
    print(f"\n{'='*80}")
    print(f"REPO: {repo_name}")
    print(f"QUERY: {query}")
    print(f"SCOPE: {scope}")
    print(f"{'='*80}")
    
    # Route query
    plan = route_query(query, scope)
    
    print(f"\n📋 Query Plan:")
    print(f"  Intent: {plan.intent}")
    print(f"  Keywords: {plan.keywords}")
    print(f"  Primary: {plan.primary_cmd}")
    if plan.fallback_cmds:
        print(f"  Fallback: {plan.fallback_cmds}")
    
    # Execute primary
    print(f"\n🔍 Executing primary command...")
    output, code = run_srcwalk(plan.primary_cmd)
    
    if not is_empty_result(output, code):
        print(f"✅ Success ({len(output)} chars)")
        # Show first 500 chars
        preview = output[:500]
        print(f"\nPreview:\n{preview}")
        if len(output) > 500:
            print(f"... ({len(output) - 500} more chars)")
    else:
        print(f"❌ Primary failed or empty (code={code})")
        if output:
            print(f"Output: {output[:200]}")
        
        # Auto-execute fallback
        if plan.fallback_cmds:
            print(f"\n🔄 Auto-executing fallback...")
            for i, fb_cmd in enumerate(plan.fallback_cmds, 1):
                if not fb_cmd:
                    continue
                print(f"\n  Fallback {i}: {fb_cmd}")
                fb_output, fb_code = run_srcwalk(fb_cmd)
                if not is_empty_result(fb_output, fb_code):
                    print(f"  ✅ Fallback success ({len(fb_output)} chars)")
                    preview = fb_output[:400]
                    print(f"  Preview:\n{preview}")
                    if len(fb_output) > 400:
                        print(f"  ... ({len(fb_output) - 400} more chars)")
                    break
                else:
                    print(f"  ❌ Fallback {i} failed")


def main():
    """Run lab tests"""
    print("🧪 Query Router Lab Test v2 (FIXED)")
    print("Testing improved Query Router logic\n")
    
    # Test cases - expanded
    test_cases = [
        # Symbol detection tests
        ("handleAuth", "~/Documents/Develope/uno", "uno"),
        ("Authenticate", "~/Documents/Develope/uno", "uno"),
        ("run_context", "~/Documents/Develope/Bifrost/bifrost", "bifrost"),
        
        # Natural language tests
        ("how does authentication work?", "~/Documents/Develope/uno", "uno"),
        ("find configuration code", "~/Documents/Develope/Bifrost/bifrost", "bifrost"),
        
        # Intent detection tests
        ("who calls Authenticate?", "~/Documents/Develope/uno", "uno"),
        ("what is in core?", "~/Documents/Develope/Bifrost/bifrost/core", "bifrost/core"),
        ("overview of cli", "~/Documents/Develope/Bifrost/bifrost/cli", "bifrost/cli"),
    ]
    
    for query, scope, repo_name in test_cases:
        test_query(query, scope, repo_name)
    
    print(f"\n{'='*80}")
    print("🏁 Lab test v2 complete")


if __name__ == '__main__':
    main()
