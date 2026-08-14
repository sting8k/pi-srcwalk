import test from "node:test";
import assert from "node:assert/strict";
import { splitArgs, normalizeSrcwalkArgs } from "../src/args.js";

test("splitArgs: simple whitespace splitting", () => {
  assert.deepEqual(splitArgs("context foo --scope src"), ["context", "foo", "--scope", "src"]);
  assert.deepEqual(splitArgs("  overview  "), ["overview"]);
});

test("splitArgs: double quotes group tokens", () => {
  assert.deepEqual(splitArgs('context "foo bar"'), ["context", "foo bar"]);
  assert.deepEqual(splitArgs('"a b" c "d e"'), ["a b", "c", "d e"]);
});

test("splitArgs: single quotes group tokens literally", () => {
  assert.deepEqual(splitArgs("discover 'foo bar' --as text"), ["discover", "foo bar", "--as", "text"]);
  assert.deepEqual(splitArgs("'a b'"), ["a b"]);
});

test("splitArgs: backslash escapes", () => {
  assert.deepEqual(splitArgs("a b\\ c d"), ["a", "b c", "d"]);
  assert.deepEqual(splitArgs('a "b\\"c" d'), ["a", 'b"c', "d"]);
  assert.deepEqual(splitArgs("a\\ b"), ["a b"]);
});

test("splitArgs: empty quoted tokens are preserved", () => {
  assert.deepEqual(splitArgs('a "" b'), ["a", "", "b"]);
  assert.deepEqual(splitArgs("a '' b"), ["a", "", "b"]);
});

test("splitArgs: unterminated quotes are rejected", () => {
  assert.throws(() => splitArgs('"abc'), /Unterminated double quote/);
  assert.throws(() => splitArgs("'abc"), /Unterminated single quote/);
});

test("normalizeSrcwalkArgs: strips a leading srcwalk token", () => {
  const a = normalizeSrcwalkArgs("srcwalk context foo");
  assert.deepEqual(a, { tokens: ["context", "foo"] });
  const b = normalizeSrcwalkArgs("context foo");
  assert.deepEqual(b, { tokens: ["context", "foo"] });
});

test("normalizeSrcwalkArgs: rejects empty input with a guide hint", () => {
  const empty = normalizeSrcwalkArgs("");
  assert.ok("error" in empty);
  assert.match(empty.error, /srcwalk guide/);

  const whitespace = normalizeSrcwalkArgs("   ");
  assert.ok("error" in whitespace);

  const onlyPrefix = normalizeSrcwalkArgs("srcwalk");
  assert.ok("error" in onlyPrefix);
});

test("normalizeSrcwalkArgs: surfaces unterminated quote errors", () => {
  const result = normalizeSrcwalkArgs("context 'oops");
  assert.ok("error" in result);
  assert.match(result.error, /Unterminated single quote/);
});

test("splitArgs: double-quote backslash is literal except before quote/backslash (POSIX)", () => {
  // "\\d+" stays \d+ — the common regex case
  assert.deepEqual(splitArgs('discover "\\d+" --as text'), ["discover", "\\d+", "--as", "text"]);
  // backslash before a plain char is literal
  assert.deepEqual(splitArgs('a "b\\c" d'), ["a", "b\\c", "d"]);
  // \" still escapes to a double quote
  assert.deepEqual(splitArgs('a "b\\"c" d'), ["a", 'b"c', "d"]);
  // \\ still escapes to a single backslash
  assert.deepEqual(splitArgs('a "b\\\\c" d'), ["a", "b\\c", "d"]);
});

test("splitArgs: quoted newlines are preserved", () => {
  assert.deepEqual(splitArgs('"a\nb"'), ["a\nb"]);
  assert.deepEqual(splitArgs("'a\nb'"), ["a\nb"]);
});
