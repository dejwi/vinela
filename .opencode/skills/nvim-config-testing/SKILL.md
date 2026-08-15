---
name: nvim-config-testing
description: Generate and validate nvim-settings Lua configs with the repo CLI and isolated Neovim headless runs.
compatibility: opencode
---

# nvim-config-testing

Use this when working on generated Lua output, headless config validation, or the checked-in `example-vinela-project/` fixture.

## Default commands

```sh
bun run config:generate -- --project example-vinela-project --out-dir temp/generated/example-vinela-project --json
bun run config:test -- --init temp/generated/example-vinela-project/init.lua --mode syntax --json
bun run config:check -- --project example-vinela-project --mode startup --reuse-cache --json
bun run config:check -- --project example-vinela-project --mode startup --fresh --json
```

## Guidance

- Read JSON reports before guessing.
- Do not edit generated `init.lua` directly.
- Fix the source project data, schema, or generator code instead.
- `config:generate` uses a scratch project copy by default.
- `config:test` only validates an existing generated file.
- `config:check` is the recommended staged workflow.
- Use `--reuse-cache` for fast cached startup iteration.
- Use `--fresh` for full clean plugin bootstrap validation.
- Do not describe cached startup as clean-machine proof unless JSON shows `cachePolicy: 'isolated-fresh-cleared'`.
- For startup failures, inspect the full startup artifacts before classifying the issue.
- Generated-config testing should validate schema/generator behavior, not justify named-plugin compatibility branches in core code. Prefer schema fixes or new generic schema capabilities.

## Report triage

- `generation-report.json`: generator diagnostics and project write events
- `syntax-report.json`: parse/load failures
- `source-report.json`: runtime source failures without startup config mode
- `startup-report.json`: isolated startup smoke failures
- `combined-report.json`: first failing stage, per-stage report paths, and top-level `validationSummary`

## Startup failure checklist

For `config:check -- --mode startup --fresh --json` failures, inspect artifacts in this order:

1. `combined-report.json`
   - `firstFailureStage`
   - `firstFailureReportPath`
   - startup `failureKind` / `errorSummary`
   - `validationSummary.startupPolicy.cachePolicy`
   - `latestReportDir`
2. `generation-report.json`
   - `success`
   - `initLuaPath`
   - generator diagnostics
   - `effectiveProjectPath` / `projectCopyPath` when present
3. Generated `init.lua`
   - Open the file at `initLuaPath`
   - Inspect `vim.pack.add(...)`, plugin `require(...).setup(...)`, generated keymaps/callables, and any referenced error lines
4. `startup-report.json`
   - `failureKind`, `errorSummary`, `errorExcerpt`
   - `stdoutPath`, `stderrPath`, `verboseLogPath`, `startuptimeLogPath`, `nvimReportPath`
   - `validationPolicy.xdgDataHome`, `xdgStateHome`, `xdgCacheHome`, `packRoot`, `nonInteractiveInstall`
5. Full `startup-stderr.log`
   - Read the entire file, not just `errorExcerpt`
   - For `module-not-found`, identify the missing module, first requester, and whether the trace points at generated `init.lua`, a plugin path under `packRoot`, or both
6. Supporting logs when needed
   - `startup-stdout.log`
   - `startup-verbose.log`
   - `startup-startuptime.log`
   - `startup-nvim-report.json`

Classification guardrails:

- Missing plugin dependency: generated-config install metadata or dependency coverage.
- Wrong generated module/API name: generator/schema emission.
- Module exists under `packRoot` but is missing from runtimepath: inspect `startup-verbose.log` and treat as startup/load-order or harness behavior.
- Install/network failure: environment/network, with the exact log lines quoted.

Do not classify `module-not-found` from `failureKind` alone; the missing module and requester from `startup-stderr.log` are required evidence.

## Policy triage

- `validationSummary.startupPolicy.cachePolicy === 'isolated-fresh-cleared'`
  - Full fresh bootstrap run.
- `validationSummary.startupPolicy.cachePolicy === 'isolated-reused'`
  - Cached startup iteration.
- `validationSummary.startupPolicy.nonInteractiveInstall === true`
  - Fresh startup used the test prelude to avoid interactive `vim.pack.add()` confirmation.
