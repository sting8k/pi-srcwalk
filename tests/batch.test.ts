import test from "node:test";
import assert from "node:assert/strict";
import { planBatch, runBatch, MAX_BATCH_COMMANDS } from "../src/batch.js";

test("planBatch: a single string is one command", () => {
  const plan = planBatch("context foo --scope src");
  assert.deepEqual(plan, { commands: [{ raw: "context foo --scope src", tokens: ["context", "foo", "--scope", "src"] }] });
});

test("planBatch: an array plans each command independently", () => {
  const plan = planBatch(["context foo", "trace callers bar"]);
  assert.ok("commands" in plan);
  assert.equal(plan.commands.length, 2);
  assert.deepEqual(plan.commands[0], { raw: "context foo", tokens: ["context", "foo"] });
  assert.deepEqual(plan.commands[1], { raw: "trace callers bar", tokens: ["trace", "callers", "bar"] });
});

test("planBatch: quotes are preserved per command", () => {
  const plan = planBatch(['discover "a && b" --as text']);
  assert.ok("commands" in plan);
  assert.deepEqual(plan.commands[0]!.tokens, ["discover", "a && b", "--as", "text"]);
});

test(`planBatch: rejects more than ${MAX_BATCH_COMMANDS} commands`, () => {
  const plan = planBatch(Array.from({ length: MAX_BATCH_COMMANDS + 1 }, (_, i) => `show file${i}.ts:1`));
  assert.ok("error" in plan);
  assert.match(plan.error, new RegExp(`max ${MAX_BATCH_COMMANDS} per call`));
});

test("planBatch: rejects shell metacharacters outside quotes", () => {
  const pipe = planBatch("context foo | grep bar");
  assert.ok("error" in pipe);
  assert.match(pipe.error, /no shell/);
  assert.match(pipe.error, /array instead/);

  const redirect = planBatch(["context foo", "overview > /tmp/out"]);
  assert.ok("error" in redirect);
  assert.match(redirect.error, /Shell metacharacter '>'/);
});

test("planBatch: rejects empty array and invalid commands", () => {
  const empty = planBatch([]);
  assert.ok("error" in empty);

  const invalid = planBatch(["context 'oops"]);
  assert.ok("error" in invalid);
  assert.match(invalid.error, /Unterminated single quote/);
});

test("runBatch: preserves input order and runs all commands", { timeout: 20_000 }, async () => {
  const plan = planBatch(["version", "show src/args.ts:1-3", "version"]);
  assert.ok("commands" in plan);
  const batch = await runBatch(process.cwd(), plan.commands);
  assert.equal(batch.results.length, 3);
  assert.equal(batch.results[0]!.result.exitCode, 0);
  assert.equal(batch.results[1]!.result.exitCode, 0);
  assert.equal(batch.results[2]!.result.exitCode, 0);
  assert.match(batch.results[0]!.result.output, /srcwalk/i);
  assert.match(batch.results[2]!.result.output, /srcwalk/i);
});

test("runBatch: a failing command mid-batch does not stop the others", { timeout: 20_000 }, async () => {
  const plan = planBatch(["version", "definitely-not-a-command", "show src/runner.ts:1-2"]);
  assert.ok("commands" in plan);
  const batch = await runBatch(process.cwd(), plan.commands);
  assert.equal(batch.results.length, 3);
  assert.equal(batch.results[0]!.result.exitCode, 0);
  assert.notEqual(batch.results[1]!.result.exitCode, 0);
  assert.equal(batch.results[2]!.result.exitCode, 0);
});

test("planBatch: rejects unquoted newlines instead of merging commands", () => {
  const plan = planBatch("context foo\ntrace callers bar");
  assert.ok("error" in plan);
  assert.match(plan.error, /no shell/);
  assert.match(plan.error, /array instead/);
});
