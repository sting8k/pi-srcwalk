import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  canonicalScopeDisplays,
  isPathInside,
  normalizeScopesInput,
  resolveAndPruneScopes,
} from "../src/grep/semantic-grep-scopes.js";
import { executeSemanticGrep } from "../src/grep/semantic-grep.js";

async function fixtureRepo(files: Record<string, string>): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pi-srcwalk-grep-scope-test-"));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(repo, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, text, "utf8");
  }
  return repo;
}

test("normalizeScopesInput defaults and dedupes", () => {
  assert.deepEqual(normalizeScopesInput(), ["."]);
  assert.deepEqual(normalizeScopesInput([]), ["."]);
  assert.deepEqual(normalizeScopesInput([" src ", "", "src", "src/grep"]), ["src", "src/grep"]);
});

test("isPathInside uses relative containment", () => {
  assert.equal(isPathInside("/repo", "/repo/src"), true);
  assert.equal(isPathInside("/repo/src", "/repo/src/grep"), true);
  assert.equal(isPathInside("/repo/src", "/repo/other"), false);
});

test("resolveAndPruneScopes prunes parent/child overlap and covered files", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "x\n",
    "src/grep/b.ts": "y\n",
    "other/c.ts": "z\n",
  });

  const pruned = await resolveAndPruneScopes(repo, ["src", "src/grep", "src/a.ts", "missing/path"]);
  const displays = canonicalScopeDisplays(pruned);

  assert.deepEqual(displays, ["src"]);
  assert.match(pruned.notes.join("\n"), /nested dir scope pruned/);
  assert.match(pruned.notes.join("\n"), /file scope covered by dir/);
  assert.match(pruned.notes.join("\n"), /missing scope skipped/);
});

test("semantic_grep unions multiple scopes and shares cache for equivalent canonical scopes", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "TOKEN-A\n",
    "other/b.ts": "TOKEN-B\n",
  });

  const union = await executeSemanticGrep({ repo, scopes: ["src", "other"], pattern: "TOKEN", literal: true });
  assert.equal(union.stats.indexedFiles, 2);
  assert.equal(union.stats.totalMatches, 2);
  assert.deepEqual(union.scopes.sort(), ["other", "src"]);

  const first = await executeSemanticGrep({ repo, scopes: ["src", "src/grep"], pattern: "TOKEN-A", literal: true });
  const second = await executeSemanticGrep({ repo, scopes: ["src"], pattern: "TOKEN-A", literal: true });
  assert.equal(first.stats.cacheHit, false);
  assert.equal(second.stats.cacheHit, true);
  assert.deepEqual(second.scopes, ["src"]);
});

test("semantic_grep keeps request-specific scope notes out of cached indexes", async () => {
  const repo = await fixtureRepo({
    "src/a.ts": "TOKEN-A\n",
  });

  const withMissing = await executeSemanticGrep({ repo, scopes: ["src", "missing"], pattern: "TOKEN-A", literal: true });
  const clean = await executeSemanticGrep({ repo, scopes: ["src"], pattern: "TOKEN-A", literal: true });

  assert.match(withMissing.notes.join("\n"), /missing scope skipped: missing/);
  assert.equal(clean.stats.cacheHit, true);
  assert.doesNotMatch(clean.notes.join("\n"), /missing scope skipped/);
});

test("semantic_grep allows parent-relative and absolute scopes", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "pi-srcwalk-grep-scope-parent-"));
  const repo = path.join(parent, "repo");
  const external = path.join(parent, "external");
  await mkdir(path.join(repo, "src"), { recursive: true });
  await mkdir(external, { recursive: true });
  await writeFile(path.join(repo, "src/a.ts"), "TOKEN-IN\n", "utf8");
  await writeFile(path.join(external, "b.ts"), "TOKEN-OUT\n", "utf8");

  const result = await executeSemanticGrep({
    repo,
    scopes: ["src", "../external", path.join(external, "b.ts")],
    pattern: "TOKEN",
    literal: true,
  });

  assert.equal(result.stats.indexedFiles, 2);
  assert.equal(result.stats.totalMatches, 2);
  assert.deepEqual(result.matches.map((match) => match.path).sort(), [path.join(external, "b.ts"), "src/a.ts"]);
  assert.match(result.notes.join("\n"), /file scope covered by dir/);
});

test("semantic_grep returns no files for all-missing scopes with a note", async () => {
  const repo = await fixtureRepo({ "src/a.ts": "TOKEN\n" });
  const result = await executeSemanticGrep({ repo, scopes: ["does-not-exist"], pattern: "TOKEN", literal: true });
  assert.equal(result.stats.indexedFiles, 0);
  assert.equal(result.stats.totalMatches, 0);
  assert.match(result.notes.join("\n"), /missing scope skipped/);
});