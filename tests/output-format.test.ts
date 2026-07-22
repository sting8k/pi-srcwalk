import test from "node:test";
import assert from "node:assert/strict";
import { formatResult } from "../src/output/format.js";
import type { Candidate, CommandResult, QueryPlan, SearchResult } from "../src/domain/types.js";

function command(label: string, parseAs: CommandResult["command"]["parseAs"], output: string): CommandResult {
  return {
    command: { label, args: ["show"], purpose: "test", parseAs },
    output,
    code: 0,
    elapsedMs: 3,
  };
}

function candidate(target: string, score: number, symbol: string): Candidate {
  return {
    target,
    score,
    symbol,
    source: "test",
    commandLabel: "test-command",
    kind: "fn",
    evidence: [`evidence for ${symbol}`],
  };
}

const basePlan: QueryPlan = {
  query: "group output",
  rawQuery: "group output",
  repo: "/repo",
  scope: "src",
  intent: "general",
  queryKind: "general",
  keywords: ["group", "output"],
  commands: [],
  maxResults: 3,
  detail: "normal",
  shouldTraceCallers: false,
  shouldTraceCallees: false,
  shouldGetDeps: false,
  shouldAssess: false,
};

test("formatResult groups candidates by file while preserving global candidate ids", () => {
  const result: SearchResult = {
    plan: basePlan,
    commandResults: [],
    candidates: [
      candidate("src/a.ts:10-20", 9, "first"),
      candidate("src/b.ts:5-8", 8, "second"),
      candidate("src/a.ts:30-40", 7, "third"),
    ],
    expansions: [],
    notes: [],
    confidence: {
      level: "high",
      abstained: false,
      reason: "test",
      topScore: 9,
      topGap: 1,
      topFileCluster: 2,
      pathKeywordCoverage: 1,
    },
  };

  const formatted = formatResult(result);

  assert.match(formatted, /## Best candidate files/);
  assert.match(formatted, /### src\/a\.ts — 2 hits, best=9\.0/);
  assert.match(formatted, /\[1\] 10-20: first/);
  assert.match(formatted, /\[3\] 30-40: third/);
  assert.match(formatted, /### src\/b\.ts — 1 hit, best=8\.0/);
  assert.match(formatted, /\[2\] 5-8: second/);
});

test("formatResult groups normal evidence expansions by file and trace label", () => {
  const result: SearchResult = {
    plan: basePlan,
    commandResults: [],
    candidates: [],
    expansions: [
      command("context:src/a.ts:10-20", "context", "context a"),
      command("show:src/a.ts:30-40", "show", "show a"),
      command("callers:runThing", "trace", "trace callers"),
      command("callees:runThing", "trace", "trace callees"),
    ],
    notes: [],
    confidence: {
      level: "medium",
      abstained: false,
      reason: "test",
      topScore: 0,
      topGap: 0,
      topFileCluster: 0,
      pathKeywordCoverage: 0,
    },
  };

  const formatted = formatResult(result);

  assert.match(formatted, /## Evidence expansion/);
  assert.match(formatted, /### src\/a\.ts — 2 expansions/);
  assert.match(formatted, /- \[ok, 3ms\] context 10-20 — context a/);
  assert.match(formatted, /- \[ok, 3ms\] show 30-40 — show a/);
  assert.match(formatted, /### callers — 1 expansion/);
  assert.match(formatted, /### callees — 1 expansion/);
});

test("formatResult keeps cache and command telemetry verbose-only", () => {
  const result: SearchResult = {
    plan: basePlan,
    commandResults: [command("context:src/a.ts:1-2", "context", "context a")],
    candidates: [],
    expansions: [],
    notes: [
      "TS memory cache built for scope `src`: 12 chunks, estimated 0.10MB at memory:abc123, prepare 8ms, query 2ms.",
      "Extra fusion skipped: strong BM25 cluster; preserves strong BM25 cluster.",
      "TS BM25 streaming mode scanned 3 discovered files / 12 chunks with incomplete coverage because the walk cap was reached; PRF disabled to stay memory bounded.",
    ],
    confidence: {
      level: "low",
      abstained: true,
      reason: "test",
      topScore: 0,
      topGap: 0,
      topFileCluster: 0,
      pathKeywordCoverage: 0,
    },
    cache: {
      cacheKind: "memory",
      cacheLocation: "memory:abc123",
      cacheHit: true,
      chunks: 12,
      files: 3,
      fingerprint: "deadbeef",
      buildMs: 8,
      queryMs: 2,
      sizeBytes: 1024,
    },
  };

  const concise = formatResult(result);
  const verbose = formatResult(result, true);

  assert.doesNotMatch(concise, /## Cache/);
  assert.doesNotMatch(concise, /cache_hit: true/);
  assert.doesNotMatch(concise, /## Commands executed/);
  assert.doesNotMatch(concise, /TS memory cache/);
  assert.doesNotMatch(concise, /Extra fusion skipped/);
  assert.match(concise, /incomplete coverage because the walk cap was reached/);
  assert.match(verbose, /## Cache/);
  assert.match(verbose, /cache_hit: true/);
  assert.match(verbose, /estimated_mem_mb:/);
  assert.match(verbose, /## Commands executed/);
  assert.match(verbose, /TS memory cache/);
  assert.match(verbose, /Extra fusion skipped/);
  assert.match(verbose, /context:src\/a\.ts:1-2/);
});
