---
name: vinela-plugin-schema
description: Create, review, fix, or validate a repository-root vinela.schema.json for a Neovim plugin using Vinela's public contract and offline validator.
---

# Vinela plugin schema

Use this skill when a Neovim plugin repository needs a `vinela.schema.json`.

## Sources of truth

In precedence order:

1. `https://raw.githubusercontent.com/dejwi/vinela/main/schema/plugin-schema.schema.json` is the public structural contract and editor-completion source.
2. `assets/vinela.schema.json` is the repository-root starting template.
3. [Authoring guide](references/authoring-guide.md) defines document anatomy, catalogs, evidence requirements, and versioning decisions.
4. [Capability patterns](references/capability-patterns.md) defines how to select and combine setup, option, emission, mapping, keymap, generation-rule, and plugin-capability features.

`scripts/validate-plugin-schema.mjs` is the offline acceptance check shipped with this skill. It enforces embedded structural and semantic snapshots without fetching `$schema`. Prose does not override the JSON Schema or validator. If an evidenced requirement cannot be represented or these sources disagree, report a generic capability/contract gap rather than inventing a field or plugin-specific branch.

## Workflow

1. Locate `vinela.schema.json` at the plugin repository root. If it does not exist, copy `assets/vinela.schema.json` there and replace every placeholder.
2. Build an explicit inventory from the README/help, setup defaults/source, keymap defaults, command registration/parser (subcommands, flags, aliases, bang/range/completion), public Lua exports, and emitted events. Record evidence for each item.
3. Do not invent configuration surfaces, defaults, functions, commands, events, or Lua APIs. Omit anything that cannot be supported by upstream evidence.
4. Model the common/basic configuration first. Add advanced fields only when they are useful and documented.
5. Use specialized controls and exact defaults for every evidenced user-facing field. Model complex command invocations with typed Ex-command params and templates.
6. Keep `$schema` set to `https://raw.githubusercontent.com/dejwi/vinela/main/schema/plugin-schema.schema.json`.
7. Use [the authoring guide](references/authoring-guide.md) for document anatomy, catalogs, evidence requirements, and versioning decisions; use [the capability patterns](references/capability-patterns.md) to select and combine setup, option, emission, mapping, keymap, generation-rule, and plugin-capability features.
8. Compare the finished schema against the inventory before validation. Structural validation is not completeness proof.
9. From this installed skill directory, validate the plugin file:

   ```bash
   node scripts/validate-plugin-schema.mjs /absolute/or/relative/path/to/vinela.schema.json
   ```

   With no path, the validator checks `./vinela.schema.json` relative to the caller's working directory.
10. Fix every diagnostic and rerun until the command exits `0`.
11. Summarize:
   - upstream documentation/source used as evidence;
    - inventory items modeled and every intentional omission;
   - the exact validation command;
   - the final validation result.

## Boundaries

- The validator is offline, reads one file, and uses the contract snapshot embedded in the skill.
- `$schema` is an editor annotation; validation never follows it or accesses the network.
- Raw Lua in schema fields is trusted author content. Validation treats it as text and does not execute it.
- If the contract cannot express an evidenced plugin requirement, report a **generic capability gap**. Do not propose a plugin-id-specific Vinela branch or tell an external agent to modify Vinela core.
