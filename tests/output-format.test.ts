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
