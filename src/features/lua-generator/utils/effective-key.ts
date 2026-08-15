import type { PluginSchema, SchemaOption } from '@/shared/types'

export function effectiveKey(option: SchemaOption): string {
  return option.emitKey ?? option.key
}

export function buildEffectiveKeyMap(
  schema: PluginSchema,
): Map<string, string> {
  const map = new Map<string, string>()
  for (const option of schema.options) {
    map.set(option.key, effectiveKey(option))
  }
  return map
}
