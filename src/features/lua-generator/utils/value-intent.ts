import { getEmittedOptionDefaultValue } from '@/features/plugins/utils/option-default'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'

function isConfigObject(
  value: PluginConfigValue | undefined,
): value is Record<string, PluginConfigValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getUserConfigValueAtPath(
  config: Readonly<Record<string, PluginConfigValue>>,
  path: string,
): PluginConfigValue | undefined {
  const flatValue = config[path]
  if (flatValue !== undefined) {
    return flatValue
  }

  const segments = path.split('.')
  let current: Readonly<Record<string, PluginConfigValue>> | PluginConfigValue =
    config

  for (const segment of segments) {
    if (!isConfigObject(current)) {
      return undefined
    }

    const next: PluginConfigValue | undefined = current[segment]
    if (next === undefined) {
      return undefined
    }

    current = next
  }

  return current
}

export function isMeaningfulUserOptionValue(
  value: PluginConfigValue | undefined,
  option: SchemaOption | undefined,
): boolean {
  if (option === undefined) {
    return false
  }

  if (value === undefined || value === null) {
    return false
  }

  if (option.type === 'lua') {
    const normalizedValue = typeof value === 'string' ? value.trim() : ''
    if (
      normalizedValue === '' ||
      normalizedValue === '{}' ||
      normalizedValue === 'nil'
    ) {
      return false
    }
  }

  if (
    (option.type === 'array' || option.type === 'mapping-table') &&
    Array.isArray(value) &&
    value.length === 0
  ) {
    return false
  }

  const defaultValue = getEmittedOptionDefaultValue(option)
  if (
    option.defaultEmission !== 'explicit-only' &&
    defaultValue !== undefined &&
    value === defaultValue
  ) {
    return false
  }

  return true
}
