# Authoring guide

## Repository-root document

Author exactly `<plugin-repository>/vinela.schema.json`. Start with this minimal document and replace every placeholder:

```json
{
  "$schema": "https://raw.githubusercontent.com/dejwi/vinela/main/schema/plugin-schema.schema.json",
  "id": "replace-with-plugin-id",
  "pluginName": "Replace with plugin name",
  "pluginRepo": "https://github.com/replace-owner/replace-repository",
  "version": "1.0.0",
  "options": [],
  "functions": []
}
```

Required authoring fields are `$schema`, `id`, `pluginName`, `pluginRepo`, `version`, `options`, and `functions`. `$schema` is required by the skill workflow for editor support even though validation treats it as an annotation. `id` is schema identity; use ordinary kebab-style IDs or namespaced IDs such as `github:owner/repository`. `pluginRepo` must be an HTTP(S) repository URL. Keep `options` and `functions` as `[]` when empty.

Optional top-level fields:

- installation: `pack`, `dependencies`;
- generation/configuration: `setup`, `generationRules`, `capabilities`;
- callable/command/event catalogs: `functionTemplates`, `events`, `exCommands`, `exCommandTemplates`;
- discovery metadata: `description`, `author`, `stars`, `category`, `tags`, `tagline`, `iconUrl`.

Category literals are `editor`, `lsp`, `ui`, `navigation`, `git`, `debugging`, `syntax`, and `utility`.

`pack.name` optionally overrides the `vim.pack` package name. `pack.version` is `{ "mode": "ref" | "semver-range", "value": string }`. Top-level `version` versions the Vinela schema, while `pack.version` recommends a plugin install target.

## Schema version

- patch: wording, labels, evidence corrections, or defaults corrected without adding/removing authoring surfaces;
- minor: additive options, functions, commands, events, templates, or metadata;
- major: removed/renamed keys or changed meanings/shapes that invalidate existing schema consumers.

Schema `version` is informational today. It does not select validator/runtime behavior and is not the plugin release version.

## Evidence inventory

Before authoring, inventory README/help, setup defaults/source, default keymaps, command registration/parser, public Lua exports, and emitted events. For commands, inventory subcommands, aliases, flags, bang/range behavior, completion, accepted paths/value sets, and examples.

Every modeled default, callable, command, event, and raw Lua API needs upstream evidence in the final report. List unsupported or low-value surfaces as intentional omissions. Model common/basic configuration first; do not infer APIs or defaults. If the contract has a gap, report a generic capability gap rather than adding a schema-ID branch.

## Functions

Each function requires `name`, `params`, and `luaCall`. Optional `returns` is one of `any`, `string`, `number`, `boolean`, `buffer`, `window`, `table`, or `void`. Use positional `$params` or named `$params.<name>` placeholders, never both in one `luaCall`. Named placeholders support only identifier parameter names matching `[A-Za-z_][A-Za-z0-9_]*`; if any declared parameter name is dotted, such as `layout.preset`, `luaCall` must use positional `$params` because `$params.layout.preset` is parsed as `$params.layout` and fails validation. Catalog metadata is `description`, `label`, `shortDescription`, `whatItDoes`, `technicalNote`, `isPopular`, `aliases`, `category`, `example`, `sourceDoc`, and `relatedCommand`.

Each parameter requires `name` and `type`, where `type` uses those same eight port-type literals. Optional fields are `optional`, `description`, `tier: "basic" | "advanced"`, `group`, `allowedValues`, matching `allowedValueDescriptions`, `multi`, recursive `objectShape`, `defaultValue`, `portLabel`, and `example`. `multi: true` requires evidenced `allowedValues`. Dotted names such as `layout.preset` represent nested table paths. A catch-all `opts` parameter augments structured fields; structured fields win on duplicate keys.

Do not use `paramEmission` yet. It is validator-accepted public structure with no current runtime consumer. Its accepted shape is `{ "unsetOptional": "emit-nil" | "omit-trailing" }`; omit it until generic runtime support is documented.

## Function templates

Each template requires `key`, `baseFunctionName`, `label`, `shortDescription`, and `defaults`. `baseFunctionName` must equal a declared `functions[].name`, and every defaults key must equal a parameter on that base function.

```ts
type FunctionDefault =
  | { kind: 'scalar'; value: string | number | boolean }
  | { kind: 'lua'; lua: string }
  | { kind: 'multiselect'; values: string[] }
  | { kind: 'object'; entries: Record<string, FunctionDefault> }
```

Optional metadata is `whatItDoes`, `aliases`, and `isPopular`.

```json
{
  "key": "find-files-hidden",
  "baseFunctionName": "find_files",
  "label": "Find hidden files",
  "shortDescription": "Search hidden files with selected roots.",
  "defaults": {
    "hidden": { "kind": "scalar", "value": true },
    "roots": { "kind": "multiselect", "values": ["cwd"] }
  }
}
```

## Ex commands

Each command requires `name`, `description`, `template`, `example`, and `sourceDoc`. Optional catalog fields are `label`, `shortDescription`, `category`, `whatItDoes`, `technicalNote`, `isPopular`, and `aliases`.

Each parameter requires `name`, `placeholder`, and `description`. `type` is `string`, `number`, `boolean`, `file-path`, `directory-path`, or `select`. Optional fields are `label`, `optional`, type-compatible `defaultValue`, `allowedValues`, matching `allowedValueDescriptions`, `tier: "basic" | "advanced"`, `group`, and `escape: "ex-argument"`. Its emission is `{ "kind": "value" }`, `{ "kind": "flag", "token": string }` for booleans only, or `{ "kind": "option", "prefix": string }` for non-booleans only.

`{paramName}` placeholders in `template` must match declared params. `example` is literal presentation text, not generated output.

```json
{
  "name": "OpenFile",
  "description": "Open a file with optional behavior.",
  "template": ":OpenFile{force} {line} {file}",
  "example": ":OpenFile! --line 12 /tmp/example\\ file.lua",
  "sourceDoc": ":help :OpenFile",
  "params": [
    { "name": "force", "placeholder": "", "description": "Force open.", "type": "boolean", "emit": { "kind": "flag", "token": "!" } },
    { "name": "line", "placeholder": "12", "description": "Line number.", "type": "number", "emit": { "kind": "option", "prefix": "--line" } },
    { "name": "file", "placeholder": "/tmp/file", "description": "File to open.", "type": "file-path", "escape": "ex-argument", "emit": { "kind": "value" } }
  ]
}
```

A `flag` contributes only its token, while an `option` contributes `prefix + " " + escapedValue`; template whitespace around placeholders is preserved except at command ends. `{force}` is adjacent to `:OpenFile` so it renders `:OpenFile!`; `--line` renders `--line 12`, not `--line=12`.

## Ex-command templates

Each template requires `key`, `baseCommandName`, `label`, `shortDescription`, and `defaults`. `baseCommandName` must equal a declared `exCommands[].name`; defaults are scalar values keyed by base-command parameter name. Optional fields are `example`, `whatItDoes`, `aliases`, and `isPopular`.

Defaults overlay base parameter defaults. A template `example`, when present, overrides only presentation text; otherwise the base example is inherited. Never derive examples from defaults.

## Events and metadata

`events` contains only exact custom event names evidenced in plugin docs/source; do not claim trigger/runtime integration status. `author` and non-negative integer `stars` are fallback external-schema metadata. `tagline` is at most 120 characters. `iconUrl` is HTTP(S).

Built-in metadata snapshot refresh remains internal in `docs/metadata-seeding.md`.

## Validation and final review

```bash
node scripts/validate-plugin-schema.mjs /path/to/plugin/vinela.schema.json
```

The validator checks the embedded structural contract, Vinela semantic checks, and Lua emission-key invariants. It does not use the network, compare upstream sources, install plugins, run Neovim, or execute raw Lua.

Require exit `0`, then compare the final schema with the inventory. Report evidence, modeled surfaces, intentional omissions, the exact command, and its result. Do not reproduce validator error codes or individual structural rules: diagnostics and generated validator snapshots are authoritative.
