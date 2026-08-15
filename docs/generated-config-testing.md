# Generated Config Testing CLI

Use the repository CLI to generate `init.lua` from a project folder and validate it in isolated headless Neovim runs.

## Commands

```sh
bun run config:generate -- --project example-vinela-project --out-dir temp/generated/example-vinela-project --json
bun run config:test -- --init temp/generated/example-vinela-project/init.lua --mode syntax --json
bun run config:check -- --project example-vinela-project --mode startup --reuse-cache --json
bun run config:check -- --project example-vinela-project --mode startup --fresh --json
```

## Validation levels

- `syntax`
  - Parse/loadfile validation only.
  - No plugin bootstrap or startup execution.
- `source`
  - Executes generated Lua inside an already-started minimal Neovim.
  - Useful runtime smoke, but not canonical plugin-startup proof.
- cached `startup`
  - `--reuse-cache` keeps isolated reusable plugin roots for fast iteration.
  - Can catch plugin setup/runtime regressions, but can miss first-install/bootstrap failures.
- fresh bootstrapped `startup`
  - `--fresh` clears the startup stage XDG roots immediately before launch.
  - Injects a startup-test-only `vim.pack.add()` prelude that defaults missing `confirm` to `false`.
  - This is the clean-machine local proof for plugin install/load/setup/runtime.
  - This intentionally catches unpinned default-branch plugin breakage and missing `vim.pack` dependency/install metadata that cached local startups can hide.

## Workflow

- `config:generate`
  - Generates `init.lua` plus `generation-report.json`.
  - Uses a scratch project copy by default.
  - Fails with `project-write-denied` if direct read-only mode encounters a migration/write.
- `config:test`
  - Validates an existing generated file only.
  - Modes: `syntax`, `source`, `startup`.
  - Uses isolated XDG directories and stage-prefixed logs.
  - Exit codes: `0` success, `1` validation failure, `2` bad args, `4` missing `nvim`, `5` timeout, `6` unsupported Neovim version.
- `config:check`
  - Runs staged workflows.
  - Default pipelines:
    - `--mode syntax` → `generation -> syntax`
    - `--mode source` → `generation -> syntax -> source`
    - `--mode startup` → `generation -> syntax -> startup`

## Reports

- Canonical run outputs live under `temp/nvim-config-test/runs/<slug>/<run-id>/`.
- Latest copies live under `temp/nvim-config-test/latest/<slug>/`.
- Always inspect JSON reports first:
  - `generation-report.json`
  - `syntax-report.json`
  - `source-report.json`
  - `startup-report.json`
  - `combined-report.json`

Combined workflow reports always include:

- `firstFailureStage`
- per-stage `reportPath`
- per-stage `validationPolicy`
- canonical `combinedReportPath`
- top-level `validationSummary`
- `latestReportDir`

Key policy fields:

- `validationSummary.startupPolicy.cachePolicy`
  - `isolated-reused` means cached iteration.
  - `isolated-fresh-cleared` means full fresh bootstrap validation.
- `validationSummary.startupPolicy.nonInteractiveInstall`
  - Must be `true` for trustworthy `startup --fresh` runs.
- `validationPolicy.xdgDataHome` / `packRoot`
  - Show the isolated plugin tree used for that stage.

## Startup failure artifact triage

Open artifacts in this order before classifying a `startup` failure:

1. `combined-report.json`
   - Check `firstFailureStage`, `firstFailureReportPath`, startup `failureKind`, `errorSummary`, `validationSummary.startupPolicy.cachePolicy`, and `latestReportDir`.
2. `generation-report.json`
   - Confirm generation succeeded.
   - Read `initLuaPath` instead of guessing the generated file location.
   - Note generator diagnostics plus `effectiveProjectPath` / `projectCopyPath` when present.
3. Generated `init.lua`
   - Inspect the file at `initLuaPath`.
   - Review the relevant lines around `vim.pack.add(...)`, plugin `require(...).setup(...)`, generated keymaps/callables, and any line numbers referenced by Neovim.
4. `startup-report.json`
   - Read `failureKind`, `errorSummary`, `errorExcerpt`, `stdoutPath`, `stderrPath`, `verboseLogPath`, `startuptimeLogPath`, `nvimReportPath`, and `validationPolicy`.
5. Full `startup-stderr.log`
   - Read the entire file, especially for `module-not-found` failures.
   - Identify the missing module name, the first requester, and whether Neovim points at generated `init.lua`, a plugin under `packRoot`, or both.
6. Supporting startup logs when needed
   - `startup-stdout.log` for install/clone output.
   - `startup-verbose.log` for runtimepath and load-order clues.
   - `startup-startuptime.log` for sequencing.
   - `startup-nvim-report.json` for structured Neovim-side details.

### Artifact locations

- Canonical run directory: `temp/nvim-config-test/runs/<slug>/<run-id>/`
- Latest report directory: `temp/nvim-config-test/latest/<slug>/`
- Generated `init.lua`: use `generation-report.json -> initLuaPath`
- Startup stage logs: use `startup-report.json -> stdoutPath | stderrPath | verboseLogPath | startuptimeLogPath | nvimReportPath`

### Isolated environment fields

Use `startup-report.json -> validationPolicy` to identify the exact isolated roots used during validation:

- `xdgDataHome`
- `xdgStateHome`
- `xdgCacheHome`
- `packRoot`
- `nonInteractiveInstall`

These fields tell you where plugins were installed, which runtime roots Neovim used, and whether fresh startup used the non-interactive `vim.pack.add()` bootstrap prelude.

### Classification rules for `module-not-found`

- Missing dependency required by an installed plugin: classify as generated-config install metadata or dependency coverage.
- Generated Lua requiring the wrong module/API: classify as generator or schema emission.
- Module exists under `packRoot` but is not on runtimepath: inspect `startup-verbose.log` and classify as startup/load-order or harness runtimepath behavior.
- Install/network failure prevented the module from appearing: classify as environment/network and include the exact `stdout` / `stderr` lines.

Do not classify a startup `module-not-found` failure from `failureKind` alone; the missing module and requester from `startup-stderr.log` are mandatory evidence.

## Notes

- Do not edit generated `init.lua` directly.
- Use `--reuse-cache` for faster startup iteration.
- Use `--fresh` before claiming clean-machine startup works.
- A cached startup pass is not equivalent to a fresh bootstrap pass.
- Local success with a reused plugin cache does not prove a clean machine will install the same plugin revision.
- Mason/blink generation defects are intentionally not fixed by this testing repair; fresh startup should surface them clearly.
- Generated-config testing validates behavior; it should not be used to justify named-plugin compatibility branches in core generator/runtime/storage code. Fix schemas or add generic schema capabilities instead.

## Lua syntax-checker selection (unit-test suite)

Moved out of `AGENTS.md`. lua-generator integration tests need a Neovim-compatible Lua compiler/parser on `PATH` (`nvim`, `luajit`, `luac5.1`, `lua5.1`, or a compatible bare `luac`).

- Selection proves the exact compile/load-only invocation, not just `-v` output.
- Capability probes use a 2s bounded deadline with typed `timeout` rejections and forceful child cleanup.
- Ubuntu 22.04's old Neovim may be rejected for lacking/hanging on `nvim -l`, after which LuaJIT is used.
- CI must install tooling explicitly — Lua 5.4 is **not** an acceptable release oracle.
- `VINELA_LUA_SYNTAX_CHECKER` overrides are authoritative and fail-closed.
- Internal CI installs LuaJIT and runs the complete `bun run test` with `VINELA_LUA_SYNTAX_CHECKER=luajit` on the full-suite step only; generic autodetection/fallback stays covered by detector/runner unit tests.
