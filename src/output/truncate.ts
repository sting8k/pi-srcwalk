import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TruncatedText {
  text: string;
  truncated: boolean;
  fullOutputPath?: string;
  totalLines: number;
  outputLines: number;
}

export async function truncateForTool(text: string, maxLines = 2000, maxBytes = 50 * 1024): Promise<TruncatedText> {
  const lines = text.split("\n");
  let bytes = 0;
  const kept: string[] = [];
  for (const line of lines) {
    const next = Buffer.byteLength(line + "\n", "utf8");
    if (kept.length >= maxLines || bytes + next > maxBytes) break;
    kept.push(line);
    bytes += next;
  }
  const truncated = kept.length < lines.length || Buffer.byteLength(text, "utf8") > maxBytes;
  if (!truncated) return { text, truncated: false, totalLines: lines.length, outputLines: lines.length };
  const dir = await mkdtemp(path.join(os.tmpdir(), "pi-srcwalk-"));
  const fullOutputPath = path.join(dir, "semantic-tool-output.md");
  await writeFile(fullOutputPath, text, "utf8");
  const suffix = `\n\n[Output truncated: showing ${kept.length} of ${lines.length} lines. Full output saved to: ${fullOutputPath}]`;
  return { text: kept.join("\n") + suffix, truncated: true, fullOutputPath, totalLines: lines.length, outputLines: kept.length };
}
