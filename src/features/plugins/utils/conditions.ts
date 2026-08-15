import {
  hasPrimitiveDefault,
  type PluginConfigValue,
  type SchemaOption,
} from '@/shared/types'

/**
 * Conditions compare primitive values only.
 * Resolution ignores non-primitive defaults.
 */
type PrimitiveConditionValue = string | number | boolean

export type ResolvedConditionValue =
  | { readonly source: 'stored'; readonly value: PluginConfigValue }
  | { readonly source: 'default'; readonly value: PrimitiveConditionValue }
  | { readonly source: 'absent' }

export function buildOptionIndex(
  options: readonly SchemaOption[],
): Map<string, SchemaOption> {
  const index = new Map<string, SchemaOption>()

  const visit = (optionList: readonly SchemaOption[]): void => {
    for (const option of optionList) {
      index.set(option.key, option)
      if (option.type === 'object') {
        visit(option.properties)
      }
    }
  }

  visit(options)
  return index
}

function isPrimitiveValue(
  value: PluginConfigValue | undefined,
): value is PrimitiveConditionValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

export function resolveConditionValue(
  key: string,
  values: Record<string, PluginConfigValue>,
  index: Map<string, SchemaOption>,
): ResolvedConditionValue {
  const stored = values[key]
  if (stored !== undefined) {
    return { source: 'stored', value: stored }
  }

  const option = index.get(key)
  if (
    option !== undefined &&
    hasPrimitiveDefault(option) &&
    isPrimitiveValue(option.default)
  ) {
    return { source: 'default', value: option.default }
  }

  return { source: 'absent' }
}

function passesCondition(
  condition: { key: string; equals: PrimitiveConditionValue } | undefined,
  values: Record<string, PluginConfigValue>,
  index: Map<string, SchemaOption>,
): boolean {
  if (condition === undefined) return true
  const resolved = resolveConditionValue(condition.key, values, index)
  return resolved.source !== 'absent' && resolved.value === condition.equals
}

export function isOptionVisible(
  option: SchemaOption,
  values: Record<string, PluginConfigValue>,
  index: Map<string, SchemaOption>,
): boolean {
  return passesCondition(option.visibleWhen, values, index)
}

export function isOptionEnabled(
  option: SchemaOption,
  values: Record<string, PluginConfigValue>,
  index: Map<string, SchemaOption>,
): boolean {
  return passesCondition(option.enabledWhen, values, index)
}

export function computeVisibleCounts(
  options: readonly SchemaOption[],
  values: Record<string, PluginConfigValue>,
  index: Map<string, SchemaOption>,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const option of options) {
    if (!isOptionVisible(option, values, index)) {
      continue
    }
    const group = option.group ?? 'General'
    counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return counts
}
