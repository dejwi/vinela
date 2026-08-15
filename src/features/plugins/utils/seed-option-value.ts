import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import { getOptionDefaultValue } from './option-default'

function isPrimitiveConfigValue(item: unknown): item is PluginConfigValue {
  return (
    typeof item === 'string' ||
    typeof item === 'number' ||
    typeof item === 'boolean'
  )
}

function isConfigObject(
  value: PluginConfigValue | undefined,
): value is Record<string, PluginConfigValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

export interface SeededOptionResult {
  hasValue: boolean
  value: PluginConfigValue | undefined
}

function seedLuaOption(
  storedValue: PluginConfigValue | undefined,
  option: Extract<SchemaOption, { type: 'lua' }>,
): SeededOptionResult {
  if (storedValue !== undefined) {
    return { hasValue: true, value: storedValue }
  }

  if (isNonEmptyString(option.default)) {
    if (option.defaultEmission === 'explicit-only') {
      return { hasValue: false, value: undefined }
    }

    return { hasValue: true, value: option.default }
  }

  return { hasValue: false, value: undefined }
}

function seedPluginKeymapOption(
  storedValue: PluginConfigValue | undefined,
  option: Extract<SchemaOption, { type: 'plugin-keymap' }>,
): SeededOptionResult {
  if (storedValue !== undefined) {
    return { hasValue: true, value: storedValue }
  }

  return {
    hasValue: true,
    value: getOptionDefaultValue(option) as PluginConfigValue,
  }
}

function seedArrayOption(
  storedValue: PluginConfigValue | undefined,
  option: Extract<SchemaOption, { type: 'array' }>,
): SeededOptionResult {
  if (storedValue !== undefined) {
    return { hasValue: true, value: storedValue }
  }

  if (option.default !== undefined && Array.isArray(option.default)) {
    if (option.defaultEmission === 'explicit-only') {
      return { hasValue: false, value: undefined }
    }

    return {
      hasValue: true,
      value: option.default.filter(isPrimitiveConfigValue),
    }
  }

  return { hasValue: false, value: undefined }
}

function seedObjectOption(
  storedValue: PluginConfigValue | undefined,
  option: Extract<SchemaOption, { type: 'object' }>,
): SeededOptionResult {
  if (storedValue !== undefined && !isConfigObject(storedValue)) {
    return { hasValue: true, value: storedValue }
  }

  const existingObject = isConfigObject(storedValue) ? storedValue : undefined
  const nextObject: Record<string, PluginConfigValue> =
    existingObject !== undefined ? { ...existingObject } : {}
  let hasAnyValue = existingObject !== undefined

  for (const childOption of option.properties) {
    const childStoredValue = existingObject?.[childOption.key]
    const childResult = seedOptionValue(childStoredValue, childOption)

    if (!childResult.hasValue || childResult.value === undefined) {
      continue
    }

    hasAnyValue = true
    if (nextObject[childOption.key] !== childResult.value) {
      nextObject[childOption.key] = childResult.value
    }
  }

  if (!hasAnyValue) {
    return { hasValue: false, value: undefined }
  }

  return { hasValue: true, value: nextObject }
}

export function seedOptionValue(
  storedValue: PluginConfigValue | undefined,
  option: SchemaOption,
): SeededOptionResult {
  if (storedValue !== undefined && option.type !== 'object') {
    return { hasValue: true, value: storedValue }
  }

  if (option.type === 'lua') {
    return seedLuaOption(storedValue, option)
  }

  if (option.type === 'plugin-keymap') {
    return seedPluginKeymapOption(storedValue, option)
  }

  if (option.type === 'array') {
    return seedArrayOption(storedValue, option)
  }

  if (option.type !== 'object') {
    return { hasValue: storedValue !== undefined, value: storedValue }
  }

  return seedObjectOption(storedValue, option)
}
