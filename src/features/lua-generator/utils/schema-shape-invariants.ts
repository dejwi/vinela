import type { PluginSchema } from '@/shared/types'
import { effectiveKey } from './effective-key'

const EFFECTIVE_KEY_PATTERN =
  /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/

export class LuaGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LuaGenerationError'
  }
}

export function assertSchemaShape(schema: PluginSchema): void {
  const seenEffectiveKeys = new Map<string, string>()

  for (const option of schema.options) {
    const emittedKey = effectiveKey(option)

    if (!EFFECTIVE_KEY_PATTERN.test(emittedKey)) {
      throw new LuaGenerationError(
        `Schema "${schema.id}": option "${option.key}" has invalid effective key "${emittedKey}".`,
      )
    }

    if (emittedKey.endsWith('.') || emittedKey.includes('..')) {
      throw new LuaGenerationError(
        `Schema "${schema.id}": option "${option.key}" has invalid effective key "${emittedKey}".`,
      )
    }

    const priorOwner = seenEffectiveKeys.get(emittedKey)
    if (priorOwner !== undefined) {
      throw new LuaGenerationError(
        `Schema "${schema.id}": effective key collision "${emittedKey}" between "${priorOwner}" and "${option.key}".`,
      )
    }

    seenEffectiveKeys.set(emittedKey, option.key)
  }
}
