import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  executeSemanticGrep,
  formatSemanticGrepResult,
  selectSemanticGrepEnrichmentTargets,
  type SemanticGrepMatch,
} from "../src/grep/semantic-grep.js";

async function fixtureRepo(files: Record<string, string>): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pi-srcwalk-grep-test-"));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(repo, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, text, "utf8");
  }
  return repo;
}

test("semantic_grep prunes and matches a literal ticket identifier", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "const ticket = 'ABC-212';\n",
    "src/b.ts": "const ticket = 'XYZ-999';\n",
  });

  const result = await executeSemanticGrep({ repo, scopes: ["."], pattern: "ABC-212", literal: true });

  assert.equal(result.backend, "trigram-index");
  assert.deepEqual(result.anchors, ["ABC-212"]);
  assert.equal(result.stats.indexedFiles, 2);
  assert.equal(result.stats.candidateFiles, 1);
  assert.equal(result.stats.searchedFiles, 1);
  assert.equal(result.stats.totalMatches, 1);
  assert.deepEqual(result.matches.map((match) => `${match.path}:${match.line}`), ["src/a.ts:1"]);
});

test("semantic_grep defaults to regex mode while literal mode treats dots exactly", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "const one = 'user.email';\nconst two = 'userXemail';\n",
  });

  const regexResult = await executeSemanticGrep({ repo, scopes: ["."], pattern: "user.email" });
  const literalResult = await executeSemanticGrep({ repo, scopes: ["."], pattern: "user.email", literal: true });

  assert.equal(regexResult.literal, false);
  assert.equal(regexResult.stats.totalMatches, 2);
  assert.equal(literalResult.literal, true);
  assert.equal(literalResult.stats.totalMatches, 1);
  assert.equal(literalResult.matches[0]?.text.trim(), "const one = 'user.email';");
});

test("semantic_grep falls back to full scan for regex alternation", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "alpha\nbeta\n",
    "src/b.ts": "gamma\n",
  });

  const result = await executeSemanticGrep({ repo, scopes: ["."], pattern: "alpha|gamma", regex: true });

  assert.equal(result.backend, "full-scan");
  assert.match(result.notes.join("\n"), /alternation/);
  assert.equal(result.stats.searchedFiles, 2);
  assert.equal(result.stats.totalMatches, 2);
});

test("semantic_grep globstar matches root files and nested files", async () => {
  const repo = await fixtureRepo({
    "root.ts": "ABC-212 at root\n",
    "nested/child.ts": "ABC-212 nested\n",
    "notes.md": "ABC-212 markdown\n",
  });

  const result = await executeSemanticGrep({ repo, scopes: ["."], glob: "**/*.ts", pattern: "ABC-212", literal: true });

  assert.deepEqual(result.matches.map((match) => match.path).sort(), ["nested/child.ts", "root.ts"]);
  assert.equal(result.stats.totalMatches, 2);
});

test("semantic_grep reports invalid regex without scanning candidate lines", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "anything\n",
  });

  const result = await executeSemanticGrep({ repo, scopes: ["."], pattern: "(" });

  assert.equal(result.backend, "invalid-regex");
  assert.match(result.error ?? "", /Invalid regular expression/);
  assert.equal(result.stats.candidateFiles, 0);
  assert.equal(result.stats.searchedFiles, 0);
  assert.equal(result.stats.totalMatches, 0);
});

test("formatSemanticGrepResult groups shown matches by file", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "ABC-212 first\nABC-212 second\n",
    "src/b.ts": "ABC-212 third\n",
  });

  const result = await executeSemanticGrep({ repo, scopes: ["."], pattern: "ABC-212", literal: true, maxResults: 3 });
  const formatted = formatSemanticGrepResult(result);

  assert.match(formatted, /## Matches by file/);
  assert.match(formatted, /### src\/a\.ts — 2 shown/);
  assert.match(formatted, /### src\/b\.ts — 1 shown/);
});

test("selectSemanticGrepEnrichmentTargets keeps the top ranked grep matches", () => {
  const matches: SemanticGrepMatch[] = [
    { path: "src/a.ts", line: 1, text: "first", before: [], after: [] },
    { path: "src/a.ts", line: 2, text: "second", before: [], after: [] },
    { path: "src/b.ts", line: 1, text: "third", before: [], after: [] },
    { path: "src/c.ts", line: 1, text: "fourth", before: [], after: [] },
  ];

  const selected = selectSemanticGrepEnrichmentTargets({ matches }, 3);

  assert.deepEqual(selected.targets.map((target) => target.target), ["src/a.ts:1", "src/a.ts:2", "src/b.ts:1"]);
  assert.match(selected.skipped.map((skip) => skip.reason).join("\n"), /limit reached \(3\)/);
});

test("selectSemanticGrepEnrichmentTargets skips non-repo-relative paths", () => {
  const matches: SemanticGrepMatch[] = [
    { path: "/abs/a.ts", line: 1, text: "first", before: [], after: [] },
    { path: "../parent.ts", line: 3, text: "second", before: [], after: [] },
  ];

  const selected = selectSemanticGrepEnrichmentTargets({ matches }, 3);

  assert.equal(selected.targets.length, 0);
  assert.equal(selected.skipped.length, 2);
  assert.match(selected.skipped.map((s) => s.reason).join("\n"), /outside the repo/);
});

test("formatSemanticGrepResult renders skipped entries even with no inspected items", () => {
  const formatted = formatSemanticGrepResult(
    { repo: "test", scopes: ["src"], pattern: "foo", glob: undefined, literal: true, ignoreCase: false, backend: "trigram-index", anchors: [], stats: { cacheHit: false, cacheLocation: "memory:x", indexedFiles: 1, candidateFiles: 1, searchedFiles: 1, matchedFiles: 1, totalMatches: 1, truncated: false, buildMs: 1, queryMs: 1, sizeBytes: 100 }, notes: [], matches: [{ path: "src/a.ts", line: 1, text: "foo", before: [], after: [] }] },
    {
      mode: "inspect",
      relation: "all",
      inspectId: "rskip-u1",
      status: "partial",
      requested: 2,
      inspected: 0,
      skipped: [
        { target: "/abs/a.ts:1", reason: "match path is outside the repo" },
        { target: "../parent.ts:3", reason: "match path is outside the repo" },
      ],
      elapsedMs: 5,
      items: [],
    },
  );

  assert.match(formatted, /## Inspect enrichment/);
  assert.match(formatted, /status: partial/);
  assert.match(formatted, /outside the repo/);
  assert.doesNotMatch(formatted, /### \w+ —/);
});

test("formatSemanticGrepResult appends inspect enrichment when provided", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "needle\n",
  });

  const result = await executeSemanticGrep({ repo, scopes: ["."], pattern: "needle", literal: true });
  const formatted = formatSemanticGrepResult(result, {
    mode: "inspect",
    relation: "all",
    inspectId: "rabc-u1",
    status: "complete",
    requested: 1,
    inspected: 1,
    skipped: [],
    elapsedMs: 12,
    items: [{
      target: "src/a.ts:1",
      symbol: "runNeedle",
      output: "# semantic-inspect: runNeedle",
      targets: ["src/a.ts:1"],
    }],
  });

  assert.match(formatted, /## Matches by file/);
  assert.match(formatted, /## Inspect enrichment/);
  assert.match(formatted, /inspect_id: rabc-u1/);
  assert.match(formatted, /### runNeedle — src\/a\.ts:1/);
});

test("semantic_grep reports cache and search metrics on repeated calls", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "ABC-212 first\nABC-212 second\n",
    "src/b.ts": "noise\n",
  });

  const first = await executeSemanticGrep({ repo, scopes: ["."], pattern: "ABC-212", literal: true });
  const second = await executeSemanticGrep({ repo, scopes: ["."], pattern: "ABC-212", literal: true });

  assert.equal(first.stats.cacheHit, false);
  assert.equal(second.stats.cacheHit, true);
  assert.equal(second.stats.indexedFiles, 2);
  assert.equal(second.stats.candidateFiles, 1);
  assert.equal(second.stats.searchedFiles, 1);
  assert.equal(second.stats.matchedFiles, 1);
  assert.equal(second.stats.totalMatches, 2);
  assert.equal(second.stats.truncated, false);
});

test("semantic_grep reports truncation metrics when maxResults is lower than total matches", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "ABC-212 one\nABC-212 two\nABC-212 three\n",
  });

  const result = await executeSemanticGrep({ repo, scopes: ["."], pattern: "ABC-212", literal: true, maxResults: 2 });

  assert.equal(result.stats.indexedFiles, 1);
  assert.equal(result.stats.candidateFiles, 1);
  assert.equal(result.stats.searchedFiles, 1);
  assert.equal(result.stats.matchedFiles, 1);
  assert.equal(result.stats.totalMatches, 3);
  assert.equal(result.stats.truncated, true);
  assert.equal(result.matches.length, 2);
});
