# pi-srcwalk

A thin [Pi](https://github.com/earendil-works/pi-mono) extension that exposes the [`srcwalk`](https://github.com/sting8k/srcwalk) CLI as one agent tool. Pi sends a command, the extension spawns `srcwalk` directly without a shell, and the CLI output comes back unchanged.

## Features

- One `srcwalk` tool for discovery, source reads, callers/callees, dependencies, reviews, and other CLI commands.
- Raw CLI output with no semantic wrapper or extension-level token cap.
- Up to six independent commands per call, run with concurrency three and returned in input order.
- Quote-aware arguments, abort/timeout support, clear exit errors, and no shell execution.
- No runtime dependencies beyond Pi and the `srcwalk` CLI.

## Installation

Requires Node.js 22.19 or newer and `srcwalk` on `PATH`.

```sh
npm install -g srcwalk
pi install npm:@sting8k/pi-srcwalk
```

Reload Pi after installation. For local development, load the checkout directly:

```sh
pi -e ./extensions/pi-srcwalk/index.ts
```

## Usage

Ask Pi to inspect the repository as usual. The extension adds a first-class `srcwalk` tool and tells the agent to prefer it over shell text tools for code navigation.

A typical tool call looks like this:

```ts
srcwalk({ args: "context planBatch --scope src" })
```

Pass the CLI arguments only; a leading `srcwalk` is accepted but unnecessary. Useful commands include:

| Task | `args` |
| --- | --- |
| Learn the CLI | `guide` |
| Orient in a repository | `overview` |
| Understand a symbol | `context planBatch --scope src` |
| Find callers | `trace callers planBatch --scope .` |
| Find symbols or text | `discover planBatch --as symbol --scope src` |
| Read exact source | `show src/batch.ts:22-54` |
| Inspect dependencies | `deps src/batch.ts` |
| Review changes | `review --staged` |

All commands run with Pi's open repository as the working directory. `srcwalk` bounds its own output with `--budget` (6000 tokens by default); use a smaller budget for broad requests and `--no-budget` only when full output is necessary.

## Batch Commands

Send independent lookups as an array to avoid multiple tool turns:

```ts
srcwalk({
  args: [
    "context planBatch --scope src",
    "trace callers runBatch --scope .",
  ],
})
```

A batch accepts up to six commands, runs three at a time, and preserves input order. One failed command does not stop the others. Batch results use `--- $ srcwalk <command> ---` headers.

## Arguments and Errors

Arguments are split into an argv array and passed directly to `srcwalk`; no shell is involved. Single and double quotes group values, backslashes escape characters, and malformed quotes or trailing backslashes are rejected.

Shell operators such as `|`, `>`, `<`, `;`, and `&` are not supported. Use a batch array instead of chaining commands.

Non-zero exits are prefixed with `[srcwalk exit N]`, while preserving stdout and stderr. Commands time out after 45 seconds and preserve partial output on timeout or cancellation. If `srcwalk` is not on `PATH`, the tool returns installation instructions.

## Migrating from v1

Version 2 replaces `semantic_query`, `semantic_grep`, `semantic_inspect`, `semantic_review`, and `semantic_show` with the single `srcwalk` tool. It also removes the extension's semantic index, ranking, cache, routing, and output formatting layers; use the corresponding CLI commands shown above.

Older versions injected a `semantic_*` contract into Pi's prompt. Version 2 removes that stale block automatically.

## License

MIT
