import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildPlan } from "../src/router/intent.js";
import type { CommandResult } from "../src/domain/types.js";
import { formatInspectCommandResult } from "../src/output/format.js";
import { boundShowOutput, showTargetStatus, splitShowTargets } from "../src/output/show.js";
import { parseOverviewCandidates } from "../src/srcwalk/parse.js";

function overviewResult(output: string, code = 0): CommandResult {
  return {
    command: { label: "overview", args: ["srcwalk", "overview"], purpose: "test overview", parseAs: "overview" },
    output,
    code,
    elapsedMs: 1,
  };
}

test("buildPlan keeps explicit overview scope immutable while omitted scope infers the path", () => {
  const explicit = buildPlan("overview of src/router", "/repo", "src", 3, "normal");
  assert.equal(explicit.scope, "src");
  assert.deepEqual(explicit.commands[0]?.args.slice(0, 3), ["srcwalk", "overview", "--scope"]);
  assert.equal(explicit.commands[0]?.args[3], "src");

  const rootExplicit = buildPlan("overview of src/router", "/repo", ".", 3, "normal");
  assert.equal(rootExplicit.scope, ".");
  assert.equal(rootExplicit.commands[0]?.args[3], ".");

  const explicitTests = buildPlan("tests for executeSearch", process.cwd(), "src", 3, "normal");
  assert.equal(explicitTests.scope, "src");
  const scopeIndex = explicitTests.commands[0]?.args.indexOf("--scope") ?? -1;
  assert.equal(explicitTests.commands[0]?.args[scopeIndex + 1], "src");

  const omitted = buildPlan("overview of src/router", "/repo");
  assert.equal(omitted.scope, "src/router");
  assert.equal(omitted.commands[0]?.args[3], "src/router");
});

test("formatInspectCommandResult preserves bounded CLI failure output", () => {
  const output = `fatal: unable to inspect symbol\n${"x".repeat(5000)}`;
  const lines = formatInspectCommandResult({ code: 2, output });
  const formatted = lines.join("\n");

  assert.match(formatted, /command failed code=2/);
  assert.match(formatted, /fatal: unable to inspect symbol/);
  assert.match(formatted, /CLI output truncated/);
  assert.ok(formatted.length < 4_200);
});

test("semantic_show target helpers bound lists and classify degraded output", () => {
  assert.deepEqual(splitShowTargets("src/a.ts:1-2,src/b.ts:5").targets, ["src/a.ts:1-2", "src/b.ts:5"]);
  assert.match(splitShowTargets("src/a.ts:1,src/b.ts:2,src/c.ts:3,src/d.ts:4").error ?? "", /max 3 targets/);
  assert.match(splitShowTargets("src/a.ts:1,src/b.ts").error ?? "", /path:line/);

  const exact = "# src/a.ts [section]\n 1  first\n 2  second\n";
  assert.equal(showTargetStatus("src/a.ts:1-2", 0, exact), "ok");
  assert.equal(showTargetStatus("src/a.ts:1-2", 0, "# src/a.ts [outline]\n[1-2] fn alpha"), "degraded (non-exact output)");
  assert.equal(showTargetStatus("src/a.ts:1-2", 7, "fatal: not found"), "code=7");
  assert.match(boundShowOutput("x".repeat(13_000)), /target output truncated/);
});

test("parseOverviewCandidates keeps bounded existing repo-relative files and ranges", async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pi-srcwalk-overview-test-"));
  await mkdir(path.join(repo, "src", "nested.with.dot"), { recursive: true });
  await writeFile(path.join(repo, "src", "a.ts"), "export const a = 1;\n", "utf8");
  await writeFile(path.join(repo, "src", "b.ts"), "export const b = 2;\n", "utf8");

  const result = parseOverviewCandidates(
    overviewResult([
      "# Overview: src",
      "src/",
      "src/a.ts:10-12",
      "src/b.ts",
      "src/nested.with.dot/",
      "../outside.ts:1",
    ].join("\n")),
    repo,
    "src",
    5,
  );

  assert.deepEqual(result.map((candidate) => candidate.target), ["src/a.ts:10-12", "src/b.ts:1"]);
  assert.equal(result.every((candidate) => candidate.kind !== "directory"), true);
  assert.deepEqual(parseOverviewCandidates(overviewResult("src/\nnested.with.dot/", 0), repo, "."), []);
  assert.deepEqual(parseOverviewCandidates(overviewResult("src/a.ts:1", 2), repo, "."), []);
});
