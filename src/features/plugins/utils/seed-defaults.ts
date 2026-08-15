import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import { seedOptionValue } from './seed-option-value'

export function seedWithLuaDefaults(
  stored: Record<string, PluginConfigValue>,
  options: readonly SchemaOption[],
): Record<string, PluginConfigValue> {
  const seeded: Record<string, PluginConfigValue> = { ...stored }

  for (const option of options) {
    const optionResult = seedOptionValue(stored[option.key], option)
    if (optionResult.hasValue && optionResult.value !== undefined) {
      seeded[option.key] = optionResult.value
    }
  }

  return seeded
}
