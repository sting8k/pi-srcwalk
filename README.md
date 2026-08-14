# pi-srcwalk

A Pi extension that registers [`srcwalk`](https://github.com/sting8k/srcwalk) as a first-class agent tool — so AI coding agents get structural code intelligence without shelling out through `bash`.

`srcwalk` is a CLI for symbol search, callers/callees, deps, overviews, and source reads. This package exposes it as a single raw passthrough tool: **no semantic layer, no wrapping heuristics — the agent calls the tool, the CLI runs, raw output comes back.**

## The tool

**`srcwalk`** — run any `srcwalk` command directly.

| Need | Command in `args` |
|---|---|
| Read repo orientation | `overview` |
| Understand one symbol | `context executeSearch` |
| Who calls a symbol | `trace callers executeSearch` |
| What a symbol calls | `trace callees buildOrLoadIndex` |
| Search symbols/text/files | `discover bm25 --as symbol` or `discover "foo" --as text` |
| Read exact source | `show src/index/cache.ts:154-259` |
| Review changes | `review --staged` |
| Learn the CLI | `guide` |

Example tool call:

```ts
srcwalk({ args: "context executeSearch --scope src" })
```

Multiple independent lookups go in one call as a batch:

```ts
srcwalk({ args: ["context executeSearch --scope src", "trace callers buildOrLoadIndex"] })
```

- `args` is a single command line, or an array of up to 6 independent command lines run concurrently and returned in order (single string = one command, unchanged).
- Runs with the open repo as cwd (`--scope .` resolves there).
- Output is returned verbatim (stdout + stderr). `srcwalk` self-bounds output via `--budget` (default 6000 tokens); add `--no-budget` only when full output is truly needed.
- Non-zero exits are prefixed with `[srcwalk exit N]`; a missing binary returns install instructions.
- Batch output uses `--- $ srcwalk <cmd> ---` headers; failures stay inline and never stop the rest of the batch.
- No shell: `|`, `>`, `<`, `;`, `&` outside quotes are rejected with a hint to use the batch array instead.

## Install

```bash
pi install npm:@sting8k/pi-srcwalk

# or load the local checkout during development
pi -e ./extensions/pi-srcwalk/index.ts
```

Prerequisite: the `srcwalk` CLI on PATH (`npm install -g srcwalk`, or `npx srcwalk`).

After `/reload` in Pi, the `srcwalk` tool is available. Use it instead of `bash` for code-structure reads.

## How it works

```text
Agent (Pi)
  └─ srcwalk tool ({ args: "..." })
       └─ split args (quote-aware) → spawn srcwalk (no shell)
            └─ raw stdout+stderr returned verbatim
```

- **Quote-aware arg splitting** — double/single quotes group tokens, backslash escapes work, unterminated quotes are rejected with a clear error. A leading `srcwalk` token is tolerated and stripped.
- **No shell** — args go to `spawn` as an argv array, so there is no shell injection surface; the tool can only ever run the `srcwalk` binary.
- **Bounded execution** — 45s timeout and `AbortSignal` support; partial output is preserved on abort/timeout.
- **Stale-contract cleanup** — old pi-srcwalk versions injected a `semantic_*` contract block into the system prompt; this version no longer injects anything and only removes that stale block if present.

## Project structure

```text
pi-srcwalk/
├── package.json                     # Pi package manifest
├── extensions/pi-srcwalk/index.ts   # Pi extension entrypoint (1 tool: srcwalk)
├── src/
│   ├── args.ts                      # quote-aware argv splitting + normalization
│   └── runner.ts                    # spawn srcwalk, timeout/abort, output collection
└── tests/
    ├── args.test.ts                 # splitter/normalizer unit tests
    └── runner.test.ts               # runner smoke tests
```

## Design principles

1. **Raw passthrough, not a semantic layer** — the agent talks to the CLI directly; the extension adds no heuristics to maintain.
2. **Verbatim evidence** — return the CLI's own output, not a paraphrase.
3. **Self-bounded by default** — `srcwalk`'s own `--budget` governs output size; the tool passes everything through untouched.
4. **Zero runtime deps** — pure TypeScript, no Python, no database, no native modules.

## License

MIT
