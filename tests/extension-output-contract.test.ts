import test from "node:test";
import assert from "node:assert/strict";
import { semanticGrepEnrichmentEnabled } from "../src/grep/enrichment-policy.js";

test("semantic_grep inspect enrichment is opt-in", () => {
  assert.equal(semanticGrepEnrichmentEnabled(undefined), false);
  assert.equal(semanticGrepEnrichmentEnabled(false), false);
  assert.equal(semanticGrepEnrichmentEnabled("off"), false);
  assert.equal(semanticGrepEnrichmentEnabled(""), false);
  assert.equal(semanticGrepEnrichmentEnabled(true), true);
  assert.equal(semanticGrepEnrichmentEnabled("true"), true);
  assert.equal(semanticGrepEnrichmentEnabled("inspect"), true);
});
