import test from "node:test";
import assert from "node:assert/strict";
import { runSrcwalk } from "../src/runner.js";

test("runner: runs srcwalk version successfully", { timeout: 15_000 }, async () => {
  const result = await runSrcwalk(process.cwd(), ["version"]);
  assert.equal(result.binaryNotFound, false);
  assert.equal(result.exitCode, 0);
  assert.match(result.output, /srcwalk/i);
});

test("runner: returns an exit code and output on CLI errors", { timeout: 15_000 }, async () => {
  const result = await runSrcwalk(process.cwd(), ["definitely-not-a-command"]);
  assert.equal(result.binaryNotFound, false);
  assert.notEqual(result.exitCode, 0);
});
