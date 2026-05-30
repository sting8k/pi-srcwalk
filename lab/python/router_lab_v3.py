#!/usr/bin/env python3
"""
Query Router Lab Test v3

More realistic prototype for a single-tool semantic-srcwalk wrapper:
- multi-strategy routing instead of one brittle if/else command
- minimal parsing of srcwalk text packets
- candidate scoring/ranking
- evidence expansion with context/show/trace/deps
- complex live-test matrix across real repos
"""

from __future__ import annotations

import argparse
import os
import re
import shlex
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


WEAK_KEYWORDS = {
    "find", "show", "get", "make", "create", "build", "see", "look", "check",
    "view", "display", "code", "file", "function", "class", "method", "thing",
    "stuff", "logic", "work", "works", "explain", "tell", "me", "please",
}

STOP_WORDS = {
    "how", "does", "the", "a", "an", "is", "are", "what", "where", "who", "when",
    "why", "this", "that", "it", "of", "for", "to", "in", "on", "at", "by", "with",
    "from", "and", "or", "as", "into", "about", "inside", "around",
}

FILE_EXT_RE = re.compile(r"[\w./-]+\.(?:rs|go|cs|ts|tsx|js|jsx|py|java|kt|swift|cpp|c|h|md|toml|yaml|yml|json)$")
TARGET_RE = re.compile(r"(?P<target>[\w./-]+\.\w+:(?P<line>\d+)(?:-(?P<end>\d+))?)")
CONTEXT_NEXT_RE = re.compile(r"> Next: srcwalk context (?P<target>[^\s`]+)")
SHOW_NEXT_RE = re.compile(r"> Next: srcwalk show (?P<target>[^\s`]+)(?:\s+-C\s+\d+)?")
DEF_INLINE_RE = re.compile(r"\[(?P<kind>[^\]]+)\]\s+(?P<symbol>[A-Za-z_][\w]*)\s+(?P<target>[\w./-]+\.\w+:\d+(?:-\d+)?)")
DEF_GROUP_FILE_RE = re.compile(r"^\s{2}(?P<file>[\w./-]+\.\w+)\s+\[\d+ matches\]")
DEF_GROUP_ITEM_RE = re.compile(r"^\s{4}\[(?P<kind>[^\]]+)\]\s+(?P<symbol>[A-Za-z_][\w]*)\s+:(?P<range>\d+(?:-\d+)?)")
TEXT_RANK_FILE_RE = re.compile(r"^(?P<file>[\w./-]+\.\w+)\s+—\s+(?P<terms>\d+) terms?,")
MATCH_COUNT_RE = re.compile(r"(?:—|,)\s*(?P<count>\d+) matches")
DID_YOU_MEAN_RE = re.compile(r"(?:Did you mean|Closest):\s*(?P<rest>.*)")
SYMBOL_FROM_CONTEXT_RE = re.compile(r"^-\s+[\w./-]+\.\w+:\d+(?:-\d+)?\s+(?P<symbol>[A-Za-z_][\w]*)$", re.MULTILINE)


@dataclass
class SrcwalkCommand:
    label: str
    args: list[str]
    purpose: str
    parse_as: str = "discover"  # discover | context | show | deps | overview | trace

    def display(self) -> str:
        return " ".join(shlex.quote(a) for a in self.args)


@dataclass
class QueryPlan:
    query: str
    repo: Path
    scope: str
    intent: str
    query_kind: str
    keywords: list[str]
    commands: list[SrcwalkCommand]
    max_results: int = 3
    detail: str = "normal"
    should_trace_callers: bool = False
    should_trace_callees: bool = False
    should_get_deps: bool = False
    should_assess: bool = False


@dataclass
class CommandResult:
    command: SrcwalkCommand
    output: str
    code: int
    elapsed_ms: int


@dataclass
class Candidate:
    target: str
    source: str
    command_label: str
    kind: str = "unknown"
    symbol: Optional[str] = None
    score: float = 0.0
    evidence: list[str] = field(default_factory=list)

    @property
    def file(self) -> str:
        return self.target.split(":", 1)[0]


@dataclass
class SearchResult:
    plan: QueryPlan
    command_results: list[CommandResult]
    candidates: list[Candidate]
    expansions: list[CommandResult]
    notes: list[str]


def normalize_repo(path: str) -> Path:
    return Path(os.path.expanduser(path)).resolve()


def has_target_location(query: str) -> bool:
    return bool(TARGET_RE.search(query))


def extract_target(query: str) -> Optional[str]:
    match = TARGET_RE.search(query)
    return match.group("target") if match else None


def is_file_path(query: str) -> bool:
    q = query.strip().strip("`'")
    return "/" in q or bool(FILE_EXT_RE.search(q))


def is_symbol_like(query: str) -> bool:
    q = query.strip().strip("`'")
    if not q or " " in q or "/" in q:
        return False
    if re.search(r"[a-z][A-Z]|[A-Z][a-z]", q):
        return True
    if re.match(r"^[a-z_][a-z0-9_]*$", q) and "_" in q:
        return True
    if re.match(r"^[A-Z_][A-Z0-9_]*$", q) and "_" in q:
        return True
    if "::" in q or "->" in q or "." in q:
        return True
    # Single short lower-case words like "sort" may be symbols in caller/deps intents.
    return False


def detect_intent(query: str) -> str:
    q = query.lower()
    if any(p in q for p in ["overview", "architecture", "structure", "map", "what is in", "list files", "module"]):
        return "overview"
    if any(p in q for p in ["who calls", "who uses", "callers", "used by", "usage of", "where used", "where is it used"]):
        return "callers"
    if any(p in q for p in ["what does", "callee", "callees", "call flow", "downstream", "what happens inside"]):
        return "callees"
    if any(p in q for p in ["deps", "dependencies", "imports", "imported by", "what imports", "what does it import"]):
        return "deps"
    if any(p in q for p in ["impact", "blast radius", "safe to change", "changing"]):
        return "impact"
    if any(p in q for p in ["where is", "defined", "definition", "implementation", "implemented", "where can i find"]):
        return "definition"
    if any(p in q for p in ["test", "tests", "spec", "example", "fixture"]):
        return "test"
    if any(p in q for p in ["similar", "related", "like this", "nearby"]):
        return "related"
    return "general"


def extract_keywords(query: str) -> list[str]:
    q = re.sub(r"[`'\"?!,;:()\[\]{}]", " ", query)
    raw_tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", q)
    expanded: list[str] = []
    for token in raw_tokens:
        low = token.lower()
        if low in STOP_WORDS or low in WEAK_KEYWORDS or len(low) <= 2:
            continue
        expanded.append(token)
        if low != token:
            expanded.append(low)
        if low.endswith("ing") and len(low) > 5:
            expanded.append(low[:-3])
        if low.endswith("es") and len(low) > 4:
            expanded.append(low[:-2])
        if low.endswith("s") and len(low) > 4:
            expanded.append(low[:-1])
        if low.endswith("ication") and len(low) > 8:
            expanded.append(low[:4])
    dedup: list[str] = []
    seen: set[str] = set()
    for kw in expanded:
        key = kw.lower()
        if key not in seen:
            seen.add(key)
            dedup.append(kw)
    dedup.sort(key=lambda s: (len(s), any(c.isupper() for c in s)), reverse=True)
    return dedup[:5]


def strongest_symbol(query: str, keywords: list[str]) -> str:
    explicit = [t for t in re.findall(r"[A-Za-z_][A-Za-z0-9_]*", query) if t.lower() not in STOP_WORDS | WEAK_KEYWORDS]
    symbolish = [t for t in explicit if re.search(r"[A-Z_]|[a-z][A-Z]", t)]
    if symbolish:
        return symbolish[-1]
    return keywords[0] if keywords else explicit[-1] if explicit else query.strip().split()[-1]


def make_cmd(label: str, parts: list[str], purpose: str, parse_as: str = "discover") -> SrcwalkCommand:
    return SrcwalkCommand(label=label, args=["srcwalk", *parts], purpose=purpose, parse_as=parse_as)


def build_plan(query: str, repo: str, scope: str = ".", max_results: int = 3, detail: str = "normal") -> QueryPlan:
    repo_path = normalize_repo(repo)
    intent = detect_intent(query)
    keywords = extract_keywords(query)
    commands: list[SrcwalkCommand] = []
    should_trace_callers = intent in {"callers", "impact"}
    should_trace_callees = intent == "callees"
    should_get_deps = intent in {"deps", "impact"}
    should_assess = intent == "impact"

    if target := extract_target(query):
        commands.append(make_cmd("target-context", ["context", target, "--scope", scope, "--budget", "3500"], "exact target context", "context"))
        return QueryPlan(query, repo_path, scope, intent, "explicit_target", keywords, commands, max_results, detail,
                         should_trace_callers, should_trace_callees, should_get_deps, should_assess)

    if intent == "overview":
        # If query mentions a path, use it as scope; otherwise caller-provided scope.
        path_tokens = [t for t in query.split() if "/" in t]
        overview_scope = path_tokens[-1].strip("`'") if path_tokens else scope
        commands.append(make_cmd("overview", ["overview", "--scope", overview_scope, "--symbols"], "module/project overview", "overview"))
        return QueryPlan(query, repo_path, overview_scope, intent, "overview", keywords, commands, max_results, detail)

    if is_file_path(query):
        file_match = FILE_EXT_RE.search(query.strip().strip("`'"))
        file_or_path = file_match.group(0) if file_match else query.strip().strip("`'")
        if intent == "deps":
            commands.append(make_cmd("file-deps", ["deps", file_or_path, "--budget", "3500"], "exact file deps", "deps"))
            return QueryPlan(query, repo_path, scope, intent, "file_deps", keywords, commands, max_results, detail,
                             should_trace_callers, should_trace_callees, should_get_deps, should_assess)
        commands.append(make_cmd("file-show", ["show", file_or_path, "--budget", "3500"], "exact file read", "show"))
        commands.append(make_cmd("file-discover", ["discover", file_or_path, "--as", "file", "--scope", scope, "--limit", "8", "--budget", "2500"], "file discovery fallback", "discover"))
        return QueryPlan(query, repo_path, scope, intent, "file", keywords, commands, max_results, detail,
                         should_trace_callers, should_trace_callees, should_get_deps, should_assess)

    symbol = strongest_symbol(query, keywords)

    if intent in {"callers", "callees", "deps", "impact", "definition"}:
        commands.append(make_cmd("symbol-exact", ["discover", symbol, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "3000"], "intent symbol lookup", "discover"))
        commands.append(make_cmd("symbol-lower", ["discover", symbol.lower(), "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case fallback", "discover"))
        commands.append(make_cmd("symbol-glob", ["discover", f"*{symbol.lower()}*", "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case/glob fallback", "discover"))
        if keywords:
            commands.append(make_cmd("text-any", ["discover", ",".join(keywords[:4]), "--match", "any", "--as", "text", "--scope", scope, "--limit", "10", "--budget", "3000"], "text fallback", "discover"))
        return QueryPlan(query, repo_path, scope, intent, "intent_symbol", keywords, commands, max_results, detail,
                         should_trace_callers, should_trace_callees, should_get_deps, should_assess)

    if intent == "test":
        test_scope = "tests" if (repo_path / "tests").exists() else scope
        if keywords:
            commands.append(make_cmd("test-text", ["discover", ",".join(keywords[:4]), "--match", "any", "--as", "text", "--scope", test_scope, "--limit", "12", "--budget", "3000"], "test/example text lookup", "discover"))
            commands.append(make_cmd("test-symbol", ["discover", f"*{keywords[0]}*", "--as", "symbol", "--scope", test_scope, "--limit", "12", "--budget", "2500"], "test/example symbol lookup", "discover"))
        return QueryPlan(query, repo_path, test_scope, intent, "test", keywords, commands, max_results, detail)

    if is_symbol_like(query):
        q = query.strip().strip("`'")
        commands.append(make_cmd("symbol-exact", ["discover", q, "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "3000"], "exact symbol lookup", "discover"))
        commands.append(make_cmd("symbol-lower", ["discover", q.lower(), "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "case fallback", "discover"))
        commands.append(make_cmd("symbol-glob", ["discover", f"*{q.lower()}*", "--as", "symbol", "--scope", scope, "--limit", "10", "--budget", "2500"], "glob fallback", "discover"))
        commands.append(make_cmd("symbol-text", ["discover", q, "--as", "text", "--scope", scope, "--limit", "10", "--budget", "2500"], "text fallback", "discover"))
        return QueryPlan(query, repo_path, scope, intent, "symbol", [q], commands, max_results, detail)

    if keywords:
        commands.append(make_cmd("text-any", ["discover", ",".join(keywords[:4]), "--match", "any", "--as", "text", "--scope", scope, "--limit", "12", "--budget", "3000"], "natural language text lookup", "discover"))
        commands.append(make_cmd("symbol-glob", ["discover", f"*{keywords[0].lower()}*", "--as", "symbol", "--scope", scope, "--limit", "12", "--budget", "2500"], "symbol fallback for strongest keyword", "discover"))
    commands.append(make_cmd("overview-fallback", ["overview", "--scope", scope, "--symbols"], "last-resort orientation", "overview"))
    return QueryPlan(query, repo_path, scope, intent, "general", keywords, commands, max_results, detail)


def run_command(repo: Path, command: SrcwalkCommand, timeout: int = 45) -> CommandResult:
    start = time.perf_counter()
    try:
        result = subprocess.run(command.args, cwd=repo, capture_output=True, text=True, timeout=timeout)
        output = (result.stdout or "") + (result.stderr or "")
        code = result.returncode
    except subprocess.TimeoutExpired:
        output = "Command timed out"
        code = -1
    elapsed_ms = int((time.perf_counter() - start) * 1000)
    return CommandResult(command, output, code, elapsed_ms)


def is_empty_result(result: CommandResult) -> bool:
    out = result.output.strip()
    if result.code != 0:
        return True
    if len(out) < 40:
        return True
    if "no matches" in out.lower() or "0 matches" in out.lower():
        return True
    return False


def parse_match_count(output: str) -> int:
    match = MATCH_COUNT_RE.search(output)
    return int(match.group("count")) if match else 0


def add_candidate(candidates: dict[str, Candidate], candidate: Candidate) -> None:
    existing = candidates.get(candidate.target)
    if existing:
        existing.score = max(existing.score, candidate.score)
        existing.evidence.extend(e for e in candidate.evidence if e not in existing.evidence)
        if not existing.symbol and candidate.symbol:
            existing.symbol = candidate.symbol
        if existing.kind == "unknown" and candidate.kind != "unknown":
            existing.kind = candidate.kind
    else:
        candidates[candidate.target] = candidate


def parse_candidates(result: CommandResult) -> list[Candidate]:
    output = result.output
    candidates: dict[str, Candidate] = {}
    current_group_file: Optional[str] = None

    for line in output.splitlines():
        if group := DEF_GROUP_FILE_RE.match(line):
            current_group_file = group.group("file")
            continue
        if current_group_file and (item := DEF_GROUP_ITEM_RE.match(line)):
            target = f"{current_group_file}:{item.group('range')}"
            add_candidate(candidates, Candidate(target, "grouped-definition", result.command.label, item.group("kind"), item.group("symbol"), 45, [line.strip()]))
            continue
        if m := DEF_INLINE_RE.search(line):
            add_candidate(candidates, Candidate(m.group("target"), "definition", result.command.label, m.group("kind"), m.group("symbol"), 50, [line.strip()]))
            continue
        if m := CONTEXT_NEXT_RE.search(line):
            add_candidate(candidates, Candidate(m.group("target"), "next-context", result.command.label, "context-target", None, 60, [line.strip()]))
            continue
        if m := SHOW_NEXT_RE.search(line):
            add_candidate(candidates, Candidate(m.group("target"), "next-show", result.command.label, "text-hit", None, 35, [line.strip()]))
            continue
        if m := TEXT_RANK_FILE_RE.match(line):
            target = f"{m.group('file')}:1"
            add_candidate(candidates, Candidate(target, "ranked-file", result.command.label, "file", None, 20 + int(m.group("terms")) * 5, [line.strip()]))

    return list(candidates.values())


def score_candidates(candidates: list[Candidate], plan: QueryPlan) -> list[Candidate]:
    keyword_lowers = [k.lower() for k in plan.keywords]
    query_lower = plan.query.lower()
    for cand in candidates:
        score = cand.score
        target_lower = cand.target.lower()
        symbol_lower = cand.symbol.lower() if cand.symbol else ""
        if cand.symbol and cand.symbol.lower() in query_lower:
            score += 30
        if any(k in target_lower for k in keyword_lowers):
            score += 15
        if any(k == symbol_lower for k in keyword_lowers):
            score += 25
        if cand.source in {"definition", "grouped-definition"}:
            score += 20
        if cand.source == "next-context":
            score += 15
        is_test_file = any(part in target_lower for part in ["test", "tests", "spec", "fixture"])
        if plan.intent == "test" and is_test_file:
            score += 25
        elif plan.intent != "test" and is_test_file:
            score -= 10
        if target_lower.startswith(("src/", "core/", "framework/", "plugins/")):
            score += 5
        cand.score = score
    return sorted(candidates, key=lambda c: c.score, reverse=True)


def parse_symbol_from_context(output: str) -> Optional[str]:
    match = SYMBOL_FROM_CONTEXT_RE.search(output)
    return match.group("symbol") if match else None


def candidate_to_context_cmd(candidate: Candidate, scope: str, budget: str = "3500") -> SrcwalkCommand:
    return make_cmd(f"context:{candidate.target}", ["context", candidate.target, "--scope", scope, "--budget", budget], "evidence expansion", "context")


def candidate_to_show_cmd(candidate: Candidate, budget: str = "2500") -> SrcwalkCommand:
    return make_cmd(f"show:{candidate.target}", ["show", candidate.target, "-C", "12", "--budget", budget], "raw hit expansion", "show")


def deps_cmd(file: str, budget: str = "2500") -> SrcwalkCommand:
    return make_cmd(f"deps:{file}", ["deps", file, "--budget", budget], "dependency expansion", "deps")


def trace_cmd(kind: str, symbol: str, scope: str) -> SrcwalkCommand:
    parts = ["trace", kind, symbol, "--scope", scope]
    if kind == "callees":
        parts.insert(3, "--detailed")  # will become trace callees --detailed symbol? no, fix below
    if kind == "callees":
        parts = ["trace", "callees", symbol, "--detailed", "--scope", scope]
    return make_cmd(f"trace-{kind}:{symbol}", parts, f"trace {kind}", "trace")


def assess_cmd(symbol: str, scope: str) -> SrcwalkCommand:
    return make_cmd(f"assess:{symbol}", ["assess", symbol, "--scope", scope, "--budget", "3000"], "impact expansion", "trace")


def execute_search(query: str, repo: str, scope: str = ".", max_results: int = 3, detail: str = "normal", command_budget: int = 6) -> SearchResult:
    plan = build_plan(query, repo, scope, max_results, detail)
    command_results: list[CommandResult] = []
    notes: list[str] = []
    candidates: list[Candidate] = []

    # Execute commands until enough candidates or command budget is consumed.
    for command in plan.commands[:command_budget]:
        result = run_command(plan.repo, command)
        command_results.append(result)
        if result.code != 0:
            notes.append(f"{command.label} failed with code {result.code}")
            # continue; fallback commands may recover.
            continue
        parsed = parse_candidates(result)
        candidates.extend(parsed)
        if command.label == "target-context":
            target = extract_target(command.display())
            if target:
                candidates.append(Candidate(target, "exact-context", command.label, "context-target", parse_symbol_from_context(result.output), 120, ["exact target context"]))
        if command.parse_as == "context" and not parsed:
            # Non-discover context output is already useful; synthesize the target candidate.
            target = extract_target(command.display())
            if target:
                candidates.append(Candidate(target, "exact-context", command.label, "context-target", parse_symbol_from_context(result.output), 80, ["exact target context"]))
        if command.parse_as == "show" and not parsed and not is_empty_result(result):
            # File show has no path:line candidate, but output is still useful.
            arg = command.args[2] if len(command.args) > 2 else "file"
            candidates.append(Candidate(arg if ":" in arg else f"{arg}:1", "file-show", command.label, "file", None, 65, ["exact file show"]))
        if command.parse_as == "deps" and not parsed and not is_empty_result(result):
            arg = command.args[2] if len(command.args) > 2 else "file"
            candidates.append(Candidate(arg if ":" in arg else f"{arg}:1", "file-deps", command.label, "file", None, 70, ["exact file deps"]))

        # Optimization: stop early when the first strong strategy already produced
        # enough structural targets. Intent queries still continue because trace/deps
        # need the best symbol/file context and broad text can add disambiguation.
        strong_defs = [c for c in candidates if c.source in {"definition", "grouped-definition", "next-context"}]
        if command.label == "symbol-exact" and strong_defs and plan.intent in {"callers", "callees", "deps", "impact", "definition"}:
            break
        if plan.intent not in {"callers", "callees", "deps", "impact"}:
            if command.label in {"symbol-exact", "target-context", "file-show", "overview"} and strong_defs:
                break
            if len(candidates) >= max_results * 2:
                break

    ranked = score_candidates(candidates, plan)
    # Dedupe after scoring, preserving best order.
    seen: set[str] = set()
    top: list[Candidate] = []
    for cand in ranked:
        if cand.target not in seen:
            seen.add(cand.target)
            top.append(cand)
        if len(top) >= max_results:
            break

    if not top and command_results:
        notes.append("No parseable candidates. Returning best raw command output only.")

    expansions: list[CommandResult] = []
    did_deps = False
    if top:
        if detail == "brief" or plan.intent in {"callers", "callees", "deps", "impact"}:
            context_limit = 1
        else:
            context_limit = max_results
        for cand in top[:context_limit]:
            if cand.source == "file-deps":
                exp = run_command(plan.repo, deps_cmd(cand.file, "3500"))
                did_deps = True
            else:
                cmd = candidate_to_context_cmd(cand, plan.scope)
                exp = run_command(plan.repo, cmd)
                # If context fails for raw text target, show raw lines instead.
                if exp.code != 0:
                    exp = run_command(plan.repo, candidate_to_show_cmd(cand))
            expansions.append(exp)
            if not cand.symbol:
                cand.symbol = parse_symbol_from_context(exp.output)

        primary = top[0]
        symbol = primary.symbol or strongest_symbol(plan.query, plan.keywords)
        if plan.should_trace_callers and symbol:
            expansions.append(run_command(plan.repo, trace_cmd("callers", symbol, plan.scope)))
        if plan.should_trace_callees and symbol:
            expansions.append(run_command(plan.repo, trace_cmd("callees", symbol, plan.scope)))
        if plan.should_get_deps and not did_deps:
            expansions.append(run_command(plan.repo, deps_cmd(primary.file)))
        if plan.should_assess and symbol:
            expansions.append(run_command(plan.repo, assess_cmd(symbol, plan.scope)))
        if detail == "deep" and not plan.should_get_deps:
            expansions.append(run_command(plan.repo, deps_cmd(primary.file)))

    if not expansions and command_results:
        # overview/show fallback already returns useful output; include it as an expansion-like packet.
        last_good = next((r for r in command_results if r.code == 0 and r.output.strip()), command_results[-1])
        expansions.append(last_good)

    return SearchResult(plan, command_results, top, expansions, notes)


def preview(text: str, limit: int = 1200) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + f"\n... ({len(text) - limit} more chars)"


def format_result(result: SearchResult, verbose: bool = False) -> str:
    plan = result.plan
    lines: list[str] = []
    lines.append(f"# semantic-search lab v3: {plan.query}")
    lines.append(f"repo: {plan.repo}")
    lines.append(f"scope: {plan.scope}")
    lines.append(f"intent: {plan.intent}; kind: {plan.query_kind}; keywords: {plan.keywords}")
    lines.append("")
    lines.append("## Commands executed")
    for r in result.command_results:
        status = "ok" if r.code == 0 else f"code={r.code}"
        count = parse_match_count(r.output)
        count_text = f", matches={count}" if count else ""
        lines.append(f"- [{status}, {r.elapsed_ms}ms{count_text}] {r.command.label}: {r.command.display()}")
    lines.append("")
    if result.notes:
        lines.append("## Notes")
        for note in result.notes:
            lines.append(f"- {note}")
        lines.append("")
    lines.append("## Best candidates")
    if not result.candidates:
        lines.append("- none parsed")
    for i, c in enumerate(result.candidates, 1):
        sym = f" `{c.symbol}`" if c.symbol else ""
        lines.append(f"{i}. `{c.target}`{sym} — score={c.score:.1f}, source={c.source}, kind={c.kind}")
    lines.append("")
    lines.append("## Evidence expansion")
    for i, exp in enumerate(result.expansions, 1):
        status = "ok" if exp.code == 0 else f"code={exp.code}"
        lines.append(f"### Expansion {i}: {exp.command.label} ({status}, {exp.elapsed_ms}ms)")
        lines.append("```text")
        lines.append(preview(exp.output, 1800 if verbose else 900))
        lines.append("```")
        lines.append("")
    return "\n".join(lines)


COMPLEX_TESTS = [
    # Bifrost: exact/file/symbol/natural/callers/callees/deps/tests/no-result.
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "framework/modelcatalog/pricing.go:28"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "framework/modelcatalog/pricing.go"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "CalculateCost"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", "framework", "how does model pricing cost calculation work?"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", "framework", "who calls CalculateCost?"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", "framework", "what does CalculateCost call?"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "deps of framework/modelcatalog/pricing.go"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "tests for semantic cache"),
    ("bifrost", "~/Documents/Develope/Bifrost/bifrost", ".", "where is unicorn payment teleport implemented?"),
    # Uno: huge C# repo stress cases.
    ("uno", "~/Documents/Develope/uno", ".", "src/Uno.Foundation/Rect.cs"),
    ("uno", "~/Documents/Develope/uno", ".", "Rect"),
    ("uno", "~/Documents/Develope/uno", "src", "how does remote control server start?"),
    ("uno", "~/Documents/Develope/uno", "src", "who calls StartCommandAsync?"),
    ("uno", "~/Documents/Develope/uno", "src", "overview of src/Uno.UI.RemoteControl.Host"),
    ("uno", "~/Documents/Develope/uno", "src", "tests for InitializeComponent analyzer"),
    # srcwalk itself: dogfood Rust repo.
    ("srcwalk", "~/Documents/Develope/Ultra-lab/tilth", "src", "how does discover rank results?"),
    ("srcwalk", "~/Documents/Develope/Ultra-lab/tilth", "src", "who calls rank_matches?"),
]


def run_complex_lab(selected_repo: Optional[str] = None, limit: Optional[int] = None, verbose: bool = False) -> str:
    chunks: list[str] = []
    tests = [t for t in COMPLEX_TESTS if selected_repo is None or t[0] == selected_repo]
    if limit:
        tests = tests[:limit]
    started = time.perf_counter()
    passed = 0
    partial = 0
    failed = 0

    chunks.append("# Query Router Lab Test v3 - Complex Run")
    chunks.append("")
    chunks.append(f"Total cases: {len(tests)}")
    chunks.append("")

    for idx, (name, repo, scope, query) in enumerate(tests, 1):
        result = execute_search(query, repo, scope, max_results=3, detail="normal")
        has_candidate = bool(result.candidates)
        has_expansion_ok = any(e.code == 0 and e.output.strip() for e in result.expansions)
        if has_candidate and has_expansion_ok:
            passed += 1
            verdict = "PASS"
        elif result.plan.intent == "overview" and has_expansion_ok:
            passed += 1
            verdict = "PASS"
        elif has_expansion_ok:
            partial += 1
            verdict = "PARTIAL"
        else:
            failed += 1
            verdict = "FAIL"
        chunks.append(f"\n---\n\n## Case {idx}: {name} — {verdict}")
        chunks.append(format_result(result, verbose=verbose))

    elapsed = int((time.perf_counter() - started) * 1000)
    chunks.insert(3, f"Summary: PASS={passed}, PARTIAL={partial}, FAIL={failed}, elapsed={elapsed}ms")
    return "\n".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Complex lab for semantic-srcwalk query router")
    parser.add_argument("query", nargs="?", help="Run one query instead of full lab")
    parser.add_argument("--repo", default=".", help="Repository root for one-query mode")
    parser.add_argument("--scope", default=".", help="srcwalk scope")
    parser.add_argument("--max-results", type=int, default=3)
    parser.add_argument("--detail", choices=["brief", "normal", "deep"], default="normal")
    parser.add_argument("--lab", action="store_true", help="Run built-in complex lab")
    parser.add_argument("--only-repo", choices=["bifrost", "uno", "srcwalk"], help="Filter built-in lab")
    parser.add_argument("--limit", type=int, help="Limit built-in lab cases")
    parser.add_argument("--verbose", action="store_true", help="Longer evidence previews")
    args = parser.parse_args()

    if args.lab or not args.query:
        print(run_complex_lab(args.only_repo, args.limit, args.verbose))
        return

    result = execute_search(args.query, args.repo, args.scope, args.max_results, args.detail)
    print(format_result(result, verbose=args.verbose))


if __name__ == "__main__":
    main()
