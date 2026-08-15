# Capability patterns

## Option declaration

All options require `key`, `label`, and `type`. Common optional fields are `emitKey`, `description`, `required`, `visibleWhen`, `enabledWhen`, `group`, `notices`, and `defaultEmission`.

| Type | Authoring constraints |
|---|---|
| `string` | Optional `uiHint: "input" \| "textarea"`, string default, and min/max length and pattern validation. |
| `number` | Numeric default and min/max/step/integer validation. |
| `boolean` | Boolean default. |
| `select` | `{ value, label }[]`; optional `multi`; a single select has a string default and a multi-select has a `string[]` default. |
| `array` | Item type `string`, `number`, or `select`, plus min/max/unique-item validation. |
| `mapping-table` | Declared columns and the emission contract below. |
| `object` | Recursively declared `properties`; use only for fixed shapes. |
| `color` | Format `hex`, `rgb`, or `hsl`. |
| `keysequence` | Neovim key notation string. |
| `lua` | Trusted string; optional `inputPlaceholder`, `uiHint`, and `expectedReturnType` using `any`, `string`, `number`, `boolean`, `buffer`, `window`, `table`, or `void`. |
| `plugin-keymap` | Declaration contract below. |

Prefer specialized or structured options. Use `lua` only when the contract cannot represent evidenced values.

## Paths, conditions, notices, and default emission

| Field | Contract |
|---|---|
| `emitKey` | A distinct emitted Lua path; conditions still reference the stored `key`; effective emitted paths must be unique. |
| `visibleWhen`, `enabledWhen` | `{ "key": string, "equals": string \| number \| boolean }`, resolved from stored value, then schema default, then absent. `visibleWhen` hides fields; `enabledWhen` keeps module-gated fields visible but disabled. |
| `defaultEmission` | `emit` lets schema defaults emit; `explicit-only` omits the default until the user stores a value. |
| `notices` | `severity: "warning"`; `surfaces` contains `configuration` and/or `generation`; `when` is `{ "kind": "has-explicit-value" }`, `{ "kind": "equals", "value": primitive }`, or `{ "kind": "not-equals", "value": primitive }`; requires `message`; optional `details`, `suggestions`. |

## Option emission

| Field | Contract |
|---|---|
| `emit.include.kind` | `always`, `explicit-only`, `non-default`, or `non-empty`. |
| `emit.valueRule` | `kind: "value-map"`; each `values` entry is `{ "kind": "json", "value": <JSON value> }` or `{ "kind": "lua", "lua": string }`; `onUnknown` is `omit`, `emit-original`, or `warn-and-omit`. |
| `emit.stringRule` | `kind: "path"`; optional booleans `trim`, `omitWhenEmpty`, `expandWithVimFnExpand`, `warnWhenRelative`. |

## Setup and templates

| Setup form | Contract |
|---|---|
| Standard | Required `requirePath`; optional `setupFunction`, `optionMapping: "table" \| "individual"`, `preSetup`, and `postSetup`. |
| Custom rendering | `render.kind: "lua-template"` as below. |

```json
{
  "requirePath": "my-plugin",
  "render": {
    "kind": "lua-template",
    "template": "local config = {{config}}\nrequire({{requirePath}}).bootstrap(config)"
  }
}
```

`{{config}}` is required; `{{requirePath}}` is the only other placeholder. Unknown placeholders are rejected. Raw setup snippets and templates are trusted schema-authored Lua, validated as text rather than executed.

## Mapping tables

| Surface | Contract |
|---|---|
| Columns | `string` or `select`; select columns require `{ value, label }[]`; either may have a type-compatible default. |
| `autoFill` | `kind: "value-by-column"`, `sourceColumn`, own string-to-string `values`, optional `fallback: "preserve" \| "empty" \| "column-default"`. |
| Emission | Required `targetKey`, `keyColumn`, `valueColumn`, `valueTemplate`; optional `outputKeyMap`. Only `{{outputKey}}` and `{{row.<declaredColumnKey>}}` placeholders are allowed. `{{outputKey}}` requires `keyColumn` to be a `select`; `{{row.*}}` may reference only declared `select` columns, never `string` columns. Raw interpolation from unconstrained string columns is rejected; use constrained/select values for Lua fragments. |
| `conflictGroups[]` | `column`, `values[]`, `severity: "warning"`, and `message`. |
| Autofill | Apply after base defaults on row creation; rerun only targets whose `sourceColumn` changed; manual target values persist until that source changes again. |

## Plugin keymaps

| Field | Contract |
|---|---|
| `commands[]` | Required `name`, `label`; optional `description`, `isTerminal`. |
| `presets[]` | Required `id`, `label`; optional `description`; `mappings` from a key string to an array of declared command names. Mapping arrays may be empty. |
| `defaultPreset` | Required; references a declared preset ID. |
| `allowDisable` | Optional. |

A preset with ID `none` and empty mappings is an ordinary author-declared preset for manual configuration, not a reserved sentinel. Do not document stored user-value shape (`preset`, `overrides`, `_meta`), linked-rebind behavior, key normalization, or dialog UX here.

## Generic generation rules

```ts
type GenerationRule =
  | {
      kind: 'conflict'
      left: string
      right: string
      severity: 'warning' | 'error'
      message: string
      when?: 'both-explicit' | 'both-meaningful'
    }
  | {
      kind: 'subtree-gate'
      scope: string
      when: { key: string; equals: string | number | boolean }
      action: 'omit-subtree'
      warnOnExplicitDescendants?: boolean
      message?: string
    }
  | {
      kind: 'subtree-filter'
      scope: string
      mode: 'meaningful-only'
      preserveKeys?: string[]
    }
```

Every rule option reference (`left`, `right`, and `when.key`) must resolve to a declared option in the same schema. Each `scope` must be a valid dot path and may name a parent subtree rather than an option leaf. These rules are generic and never selected by schema ID.

## Generic plugin capabilities

```ts
type PluginCapability =
  | { kind: 'lsp-package-installer'; provider: 'mason-registry' }
  | {
      kind: 'lsp-server-enabler'
      api: 'vim.lsp.enable'
      minNvimVersion: string
    }
```

Require direct upstream evidence before declaring either capability. Do not infer one from plugin names or categories.

## Raw Lua boundaries

Raw Lua is available through `lua` options, `luaCall`, setup snippets/templates, Lua function defaults, mapping-table templates, and mapped Lua values. Prefer structured fields first and copy only evidenced Lua APIs. Validation checks text shape and placeholders only; it never proves Lua syntax, safety, or API correctness.
