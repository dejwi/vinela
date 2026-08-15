import type {
  PluginConfigValue,
  SchemaObjectOption,
  SchemaOption,
  SchemaPluginKeymapOption,
} from '@/shared/types'
import { canonicalDeepEqual } from './canonical-deep-equal'
import type { OptionIdentity } from './option-identity'
import { identityToOverrideKey } from './option-identity'

export { canonicalDeepEqual } from './canonical-deep-equal'

function isConfigObject(
  value: PluginConfigValue | undefined,
): value is Record<string, PluginConfigValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * BOUNDARY INVARIANTS — `as PluginConfigValue` casts in this module
 *
 * `SchemaArrayOption.default` is typed `unknown[]`, `SchemaMappingTableOption.default`
 * is typed as string-valued row objects, and `SchemaObjectOption.default` is typed
 * `Record<string, unknown>` at the schema-typing layer. At runtime they MUST be
 * structurally compatible with the `PluginConfigValue` union, because:
 *
 *  1. Schema validators (see `validateConfig` / schema-loader) reject any `default`
 *     whose contents are not JSON-shaped (string / number / boolean / null / array of
 *     same / plain object of same).
 *  2. `cloneConfigValue` is total over JSON-shaped values and produces a value of type
 *     `PluginConfigValue` unconditionally.
 *  3. The cast is local to the cloner call — `unknown` does not leak elsewhere.
 *
 * If the schema validator is weakened, the casts in this module become unsafe and
 * should be replaced with a runtime guard.
 */

function cloneConfigValue(value: PluginConfigValue): PluginConfigValue {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((entry) => cloneConfigValue(entry))
  }

  const output: Record<string, PluginConfigValue> = {}
  for (const [key, entry] of Object.entries(value)) {
    output[key] = cloneConfigValue(entry)
  }
  return output
}

export function getOptionDefaultValue(
  option: SchemaOption,
): PluginConfigValue | undefined {
  switch (option.type) {
    case 'plugin-keymap':
      return { preset: option.defaultPreset }
    case 'array':
      return option.default === undefined
        ? undefined
        : cloneConfigValue(option.default as PluginConfigValue)
    case 'mapping-table':
      return option.default === undefined
        ? undefined
        : cloneConfigValue(option.default as PluginConfigValue)
    case 'object':
      return option.default === undefined
        ? undefined
        : cloneConfigValue(option.default as PluginConfigValue)
    case 'select':
      if (option.multi === true) {
        return option.default === undefined ? undefined : [...option.default]
      }
      return option.default
    case 'string':
    case 'number':
    case 'boolean':
    case 'color':
    case 'keysequence':
    case 'lua':
      return option.default
    default: {
      const _exhaustive: never = option
      throw new Error(`Unhandled option type: ${String(_exhaustive)}`)
    }
  }
}

export function getEmittedOptionDefaultValue(
  option: SchemaOption,
): PluginConfigValue | undefined {
  if (option.defaultEmission === 'explicit-only') {
    return undefined
  }

  return getOptionDefaultValue(option)
}

function getDefaultEffectiveValue(
  option: SchemaOption,
): PluginConfigValue | undefined {
  switch (option.type) {
    case 'boolean':
      return option.default ?? false
    case 'select':
      if (option.multi === true) {
        return option.default === undefined ? [] : [...option.default]
      }
      return option.default
    case 'plugin-keymap':
      return getOptionDefaultValue(option)
    case 'object':
      return getDefaultResetValue(option)
    case 'array':
    case 'mapping-table':
      return getOptionDefaultValue(option)
    case 'string':
    case 'number':
    case 'color':
    case 'keysequence':
    case 'lua':
      return option.default
    default: {
      const _exhaustive: never = option
      throw new Error(`Unhandled option type: ${String(_exhaustive)}`)
    }
  }
}

function stripPluginKeymapForCompare(
  value: PluginConfigValue | undefined,
  option: SchemaPluginKeymapOption,
): PluginConfigValue {
  const base: Record<string, PluginConfigValue> = {
    preset: option.defaultPreset,
  }

  if (!isConfigObject(value)) {
    return base
  }

  const presetValue = value['preset']
  base['preset'] =
    typeof presetValue === 'string' ? presetValue : option.defaultPreset

  const rawOverrides = value['overrides']
  if (isConfigObject(rawOverrides) && Object.keys(rawOverrides).length > 0) {
    base['overrides'] = cloneConfigValue(rawOverrides)
  }

  const rawMeta = value['_meta']
  if (isConfigObject(rawMeta)) {
    const rawLinks = rawMeta['rebindLinks']
    if (isConfigObject(rawLinks) && Object.keys(rawLinks).length > 0) {
      base['_meta'] = { rebindLinks: cloneConfigValue(rawLinks) }
    }
  }

  return base
}

function getObjectEffectiveValue(
  option: SchemaObjectOption,
  value: PluginConfigValue | undefined,
): PluginConfigValue | undefined {
  const currentValue = isConfigObject(value) ? value : undefined
  const output: Record<string, PluginConfigValue> = {}
  let hasAnyValue = false

  for (const child of option.properties) {
    const childValue = getEffectiveValue(child, currentValue?.[child.key])
    if (childValue !== undefined) {
      output[child.key] = childValue
      hasAnyValue = true
    }
  }

  if (hasAnyValue) {
    return output
  }

  if (option.default !== undefined) {
    return getOptionDefaultValue(option)
  }

  return undefined
}

export function getEffectiveValue(
  option: SchemaOption,
  value: PluginConfigValue | undefined,
): PluginConfigValue | undefined {
  switch (option.type) {
    case 'boolean':
      return typeof value === 'boolean' ? value : (option.default ?? false)
    case 'select':
      if (option.multi === true) {
        if (Array.isArray(value)) {
          return value
        }
        return option.default === undefined ? [] : [...option.default]
      }
      return typeof value === 'string' ? value : option.default
    case 'plugin-keymap':
      return stripPluginKeymapForCompare(value, option)
    case 'object':
      return getObjectEffectiveValue(option, value)
    case 'string':
    case 'number':
    case 'array':
    case 'mapping-table':
    case 'color':
    case 'keysequence':
    case 'lua':
      return value
    default: {
      const _exhaustive: never = option
      throw new Error(`Unhandled option type: ${String(_exhaustive)}`)
    }
  }
}

export function getDefaultResetValue(
  option: SchemaOption,
): PluginConfigValue | undefined {
  if (option.defaultEmission === 'explicit-only') {
    return undefined
  }

  switch (option.type) {
    case 'plugin-keymap':
      return getOptionDefaultValue(option)
    case 'array':
    case 'mapping-table':
      return getOptionDefaultValue(option)
    case 'object':
      return getOptionDefaultValue(option)
    case 'select':
      if (option.multi === true) {
        return option.default === undefined ? [] : [...option.default]
      }
      return option.default
    case 'string':
    case 'number':
    case 'boolean':
    case 'color':
    case 'keysequence':
    case 'lua':
      return option.default
    default: {
      const _exhaustive: never = option
      throw new Error(`Unhandled option type: ${String(_exhaustive)}`)
    }
  }
}

export function valueMatchesDefault(
  option: SchemaOption,
  value: PluginConfigValue | undefined,
): boolean {
  if (option.defaultEmission === 'explicit-only') {
    return value === undefined
  }

  if (option.type === 'object') {
    const currentValue = isConfigObject(value) ? value : undefined
    for (const child of option.properties) {
      if (!valueMatchesDefault(child, currentValue?.[child.key])) {
        return false
      }
    }
    if (option.default === undefined) {
      return true
    }
  }

  const effective = getEffectiveValue(option, value)
  const defaultEffective = getDefaultEffectiveValue(option)
  return canonicalDeepEqual(effective, defaultEffective)
}

export function canResetOption(
  option: SchemaOption,
  value: PluginConfigValue | undefined,
  hasLuaInclusionOverride: boolean,
): boolean {
  return !valueMatchesDefault(option, value) || hasLuaInclusionOverride
}

export function hasAnyOverrideUnderPrefix(
  map: Record<string, boolean> | undefined,
  prefix: string,
): boolean {
  if (map === undefined) {
    return false
  }
  const nestedPrefix = `${prefix}.`
  for (const key of Object.keys(map)) {
    if (key === prefix || key.startsWith(nestedPrefix)) {
      return true
    }
  }
  return false
}

export function forEachDescendantLuaKey(
  identity: OptionIdentity,
  fn: (key: string) => void,
): void {
  if (identity.option.type !== 'object') {
    return
  }

  const walk = (option: SchemaOption, parentPath: string): void => {
    const key = `${parentPath}.${option.key}`
    if (option.type === 'lua') {
      fn(key)
      return
    }
    if (option.type === 'object') {
      for (const child of option.properties) {
        walk(child, key)
      }
    }
  }

  const rootKey = identityToOverrideKey(identity)
  for (const child of identity.option.properties) {
    walk(child, rootKey)
  }
}
