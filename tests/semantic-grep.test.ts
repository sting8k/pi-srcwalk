import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeSemanticGrep, formatSemanticGrepResult } from "../src/grep/semantic-grep.js";

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

  const result = await executeSemanticGrep({ repo, scope: ".", pattern: "ABC-212", literal: true });

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

  const regexResult = await executeSemanticGrep({ repo, scope: ".", pattern: "user.email" });
  const literalResult = await executeSemanticGrep({ repo, scope: ".", pattern: "user.email", literal: true });

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

  const result = await executeSemanticGrep({ repo, scope: ".", pattern: "alpha|gamma", regex: true });

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

  const result = await executeSemanticGrep({ repo, scope: ".", glob: "**/*.ts", pattern: "ABC-212", literal: true });

  assert.deepEqual(result.matches.map((match) => match.path).sort(), ["nested/child.ts", "root.ts"]);
  assert.equal(result.stats.totalMatches, 2);
});

test("semantic_grep reports invalid regex without scanning candidate lines", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "anything\n",
  });

  const result = await executeSemanticGrep({ repo, scope: ".", pattern: "(" });

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

  const result = await executeSemanticGrep({ repo, scope: ".", pattern: "ABC-212", literal: true, maxResults: 3 });
  const formatted = formatSemanticGrepResult(result);

  assert.match(formatted, /## Matches by file/);
  assert.match(formatted, /### src\/a\.ts — 2 shown/);
  assert.match(formatted, /### src\/b\.ts — 1 shown/);
  assert.match(formatted, /```ts\n1\| ABC-212 first/);
});

test("semantic_grep reports cache and search metrics on repeated calls", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "ABC-212 first\nABC-212 second\n",
    "src/b.ts": "noise\n",
  });

  const first = await executeSemanticGrep({ repo, scope: ".", pattern: "ABC-212", literal: true });
  const second = await executeSemanticGrep({ repo, scope: ".", pattern: "ABC-212", literal: true });

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

  const result = await executeSemanticGrep({ repo, scope: ".", pattern: "ABC-212", literal: true, maxResults: 2 });

  assert.equal(result.stats.indexedFiles, 1);
  assert.equal(result.stats.candidateFiles, 1);
  assert.equal(result.stats.searchedFiles, 1);
  assert.equal(result.stats.matchedFiles, 1);
  assert.equal(result.stats.totalMatches, 3);
  assert.equal(result.stats.truncated, true);
  assert.equal(result.matches.length, 2);
});
