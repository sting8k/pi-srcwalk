import { STOP_WORDS, WEAK_KEYWORDS } from "../router/constants.js";

const TOKEN_RE = /[A-Za-z_][A-Za-z0-9_]*|[0-9]+/g;
const CAMEL_BOUNDARY_RE = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g;

export function splitIdentifier(token: string): string[] {
  const parts: string[] = [];
  for (const piece of token.split(/[_\-./\\]+/)) {
    if (!piece) continue;
    parts.push(...piece.split(CAMEL_BOUNDARY_RE).filter(Boolean));
  }
  return parts;
}

export function stemLight(token: string): string {
  const t = token.toLowerCase();
  const suffixes: Array<[string, string, number]> = [
    ["ization", "ize", 9],
    ["isation", "ize", 9],
    ["ication", "y", 9],
    ["ing", "", 6],
    ["ed", "", 5],
    ["ies", "y", 5],
    ["es", "", 5],
    ["s", "", 5],
  ];
  for (const [suffix, replacement, minLen] of suffixes) {
    if (t.length >= minLen && t.endsWith(suffix)) return t.slice(0, -suffix.length) + replacement;
  }
  return t;
}

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.match(TOKEN_RE) ?? []) {
    for (const part of splitIdentifier(raw)) {
      const low = part.toLowerCase();
      if (low.length <= 2 || STOP_WORDS.has(low) || WEAK_KEYWORDS.has(low)) continue;
      out.push(low);
      const stem = stemLight(low);
      if (stem !== low && stem.length > 2) out.push(stem);
    }
  }
  return out;
}
