import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { bm25Search } from "../src/index/bm25.js";

async function fixtureRepo(files: Record<string, string>): Promise<string> {
  const repo = await mkdtemp(path.join(os.tmpdir(), "pi-srcwalk-bm25-memory-test-"));
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(repo, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, text, "utf8");
  }
  return repo;
}

function repeatedText(prefix: string, lines: number): string {
  return `${Array.from({ length: lines }, (_, idx) => `${prefix} configuration navigation payload ${idx}`).join("\n")}\n`;
}

test("BM25 falls back to bounded-memory streaming when index acceleration budget is exceeded", async () => {
  const previous = process.env.PI_SRCWALK_BM25_MAX_INDEX_MB;
  process.env.PI_SRCWALK_BM25_MAX_INDEX_MB = "1";
  try {
    const repo = await fixtureRepo({
      "src/a.ts": repeatedText("alpha", 9000),
      "src/b.ts": repeatedText("beta", 9000),
      "src/c.ts": `${repeatedText("gamma", 9000)}export const oversizedStreamingNeedle = "configuration navigation";\n`,
    });

    const { result, candidates, notes, index } = await bm25Search(repo, ".", "oversized streaming needle configuration navigation", 5);

    assert.equal(index.stats.retrievalMode, "streaming");
    assert.match(result.output, /retrieval_mode=streaming/);
    assert.match(notes.join("\n"), /PRF disabled/);
    assert.ok(candidates.some((candidate) => candidate.target.startsWith("src/c.ts:")));
  } finally {
    if (previous === undefined) delete process.env.PI_SRCWALK_BM25_MAX_INDEX_MB;
    else process.env.PI_SRCWALK_BM25_MAX_INDEX_MB = previous;
  }
});
