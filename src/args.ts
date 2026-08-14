/**
 * Quote-aware splitting of a raw srcwalk command line into argv tokens.
 *
 * Rules:
 * - Whitespace separates tokens.
 * - Single quotes preserve their content literally.
 * - Double quotes preserve content; backslash is literal except before `"` and
 *   `\\` (POSIX rule — so `"\\d+"` stays `\d+`, the common regex case).
 * - Backslash outside quotes escapes the next character.
 * - Unterminated quotes are rejected with a clear error instead of being
 *   silently swallowed.
 */
export function splitArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let tokenStarted = false;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (quote !== null) {
      if (ch === quote) {
        quote = null;
        tokenStarted = true;
      } else if (ch === "\\" && quote === '"') {
        const next = input[i + 1];
        if (next === '"' || next === "\\") {
          i++;
          current += input[i]!;
        } else {
          current += ch;
        }
        tokenStarted = true;
      } else {
        current += ch;
        tokenStarted = true;
      }
      continue;
    }

    if (ch === " " || ch === "\t") {
      if (tokenStarted) {
        tokens.push(current);
        current = "";
        tokenStarted = false;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      tokenStarted = true;
    } else if (ch === "\\") {
      i++;
      if (i < input.length) current += input[i]!;
      tokenStarted = true;
    } else {
      current += ch;
      tokenStarted = true;
    }
  }

  if (quote !== null) {
    throw new Error(`Unterminated ${quote === '"' ? "double" : "single"} quote in args: ${input}`);
  }
  if (tokenStarted) tokens.push(current);
  return tokens;
}

/**
 * Find the first shell metacharacter (|, >, <, ;, &) that appears outside
 * quotes. The tool never runs a shell, so these are rejected with a clear
 * hint instead of being passed through as literal argv.
 */
export function findShellMetachar(input: string): string | undefined {
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quote !== null) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"') i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "|" || ch === ">" || ch === "<" || ch === ";" || ch === "&" || ch === "\n" || ch === "\r") return ch;
  }
  return undefined;
}

export type NormalizedArgs = { tokens: string[] } | { error: string };

/**
 * Normalize a raw args string into argv tokens for `srcwalk`.
 *
 * Accepts a leading `srcwalk` token (agents often type the full command) and
 * rejects empty input with a hint pointing at the built-in guide.
 */
export function normalizeSrcwalkArgs(args: string): NormalizedArgs {
  const trimmed = args.trim();
  if (!trimmed) {
    return { error: "No srcwalk arguments provided. Run `srcwalk guide` or `srcwalk --help` for usage." };
  }

  let tokens: string[];
  try {
    tokens = splitArgs(trimmed);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  if (tokens[0] === "srcwalk") tokens = tokens.slice(1);
  if (tokens.length === 0) {
    return { error: "No srcwalk arguments provided. Run `srcwalk guide` or `srcwalk --help` for usage." };
  }
  return { tokens };
}
