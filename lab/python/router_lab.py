#!/usr/bin/env python3
"""
Query Router Lab Test
Test Query Router logic với srcwalk CLI trên real repos
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


def is_symbol_like(query: str) -> bool:
    """Detect symbol-like query: single token, CamelCase, snake_case"""
    query = query.strip()
    # Single word, no spaces
    if ' ' not in query and len(query) > 0:
        # CamelCase or snake_case or contains ::
        if re.match(r'^[A-Z][a-zA-Z0-9]*$', query):  # CamelCase
            return True
        if re.match(r'^[a-z_][a-z0-9_]*$', query):  # snake_case
            return True
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
                  'who', 'when', 'why', 'this', 'that', 'it', 'of', 'for', 'to'}
    
    # Remove punctuation
    query = re.sub(r'[?!.,;:]', '', query.lower())
    tokens = query.split()
    
    keywords = [t for t in tokens if t not in stop_words and len(t) > 2]
    
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
    
    return list(set(expanded))  # dedupe


def detect_intent(query: str) -> str:
    """Detect query intent"""
    query_lower = query.lower()
    
    if any(p in query_lower for p in ['who calls', 'who uses', 'callers', 'used by', 'usage of']):
        return 'callers'
    if any(p in query_lower for p in ['what calls', 'callees', 'call flow', 'what does it call']):
        return 'callees'
    if any(p in query_lower for p in ['deps', 'dependencies', 'imports', 'what imports']):
        return 'deps'
    if any(p in query_lower for p in ['where is', 'defined', 'definition', 'implementation']):
        return 'definition'
    if any(p in query_lower for p in ['test', 'tests', 'spec', 'example']):
        return 'test'
    if any(p in query_lower for p in ['overview', 'architecture', 'structure', 'map']):
        return 'overview'
    
    return 'general'


def route_query(query: str, scope: str = ".") -> QueryPlan:
    """
    Main Query Router logic
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
    
    # Priority 3: Callers intent
    if intent == 'callers':
        keywords = extract_keywords(query)
        symbol = keywords[0] if keywords else query.split()[0]
        return QueryPlan(
            query=query,
            intent='callers',
            keywords=keywords,
            primary_cmd=f'srcwalk discover "{symbol}" --as symbol --scope {scope}',
            fallback_cmds=[f'srcwalk trace callers {symbol} --scope {scope}'],
            should_trace_callers=True,
        )
    
    # Priority 4: Callees intent
    if intent == 'callees':
        keywords = extract_keywords(query)
        symbol = keywords[0] if keywords else query.split()[0]
        return QueryPlan(
            query=query,
            intent='callees',
            keywords=keywords,
            primary_cmd=f'srcwalk discover "{symbol}" --as symbol --scope {scope}',
            fallback_cmds=[f'srcwalk trace callees {symbol} --detailed --scope {scope}'],
            should_trace_callees=True,
        )
    
    # Priority 5: Deps intent
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
            symbol = keywords[0] if keywords else query.split()[0]
            return QueryPlan(
                query=query,
                intent='deps',
                keywords=keywords,
                primary_cmd=f'srcwalk discover "{symbol}" --as symbol --scope {scope}',
                fallback_cmds=[],
                should_get_deps=True,
            )
    
    # Priority 6: Overview intent
    if intent == 'overview':
        return QueryPlan(
            query=query,
            intent='overview',
            keywords=[],
            primary_cmd=f'srcwalk overview --scope {scope} --symbols',
            fallback_cmds=[],
        )
    
    # Priority 7: Symbol-like
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
        keywords = [query.strip()]
    
    keyword_str = ','.join(keywords[:5])  # limit to 5 keywords
    
    return QueryPlan(
        query=query,
        intent='general',
        keywords=keywords,
        primary_cmd=f'srcwalk discover "{keyword_str}" --match any --as text --scope {scope}',
        fallback_cmds=[
            f'srcwalk discover "*{keywords[0]}*" --as symbol --scope {scope}' if keywords else '',
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
    print(f"  Trace callers: {plan.should_trace_callers}")
    print(f"  Trace callees: {plan.should_trace_callees}")
    print(f"  Get deps: {plan.should_get_deps}")
    
    # Execute primary
    print(f"\n🔍 Executing primary command...")
    output, code = run_srcwalk(plan.primary_cmd)
    
    if code == 0 and output.strip():
        print(f"✅ Success ({len(output)} chars)")
        # Show first 500 chars
        preview = output[:500]
        print(f"\nPreview:\n{preview}")
        if len(output) > 500:
            print(f"... ({len(output) - 500} more chars)")
    else:
        print(f"❌ Failed or empty (code={code})")
        if output:
            print(f"Output: {output[:300]}")
        
        # Try fallback
        if plan.fallback_cmds:
            print(f"\n🔄 Trying fallback...")
            for fb_cmd in plan.fallback_cmds:
                if not fb_cmd:
                    continue
                print(f"  Command: {fb_cmd}")
                fb_output, fb_code = run_srcwalk(fb_cmd)
                if fb_code == 0 and fb_output.strip():
                    print(f"  ✅ Fallback success ({len(fb_output)} chars)")
                    preview = fb_output[:300]
                    print(f"  Preview: {preview}")
                    break
                else:
                    print(f"  ❌ Fallback failed (code={fb_code})")


def main():
    """Run lab tests"""
    print("🧪 Query Router Lab Test")
    print("Testing Query Router logic with srcwalk CLI on real repos\n")
    
    # Test cases
    test_cases = [
        # Repo 1: uno
        ("handleAuth", "~/Documents/Develope/uno", "uno"),
        ("how does authentication work?", "~/Documents/Develope/uno", "uno"),
        ("who calls Authenticate?", "~/Documents/Develope/uno", "uno"),
        
        # Repo 2: bifrost
        ("overview of cli", "~/Documents/Develope/Bifrost/bifrost/cli", "bifrost/cli"),
        ("what is in core?", "~/Documents/Develope/Bifrost/bifrost/core", "bifrost/core"),
        ("find configuration code", "~/Documents/Develope/Bifrost/bifrost", "bifrost"),
    ]
    
    for query, scope, repo_name in test_cases:
        test_query(query, scope, repo_name)
    
    print(f"\n{'='*80}")
    print("🏁 Lab test complete")


if __name__ == '__main__':
    main()
