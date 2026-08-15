import { expect } from 'vitest'
import type { GenerationResult } from '@/features/lua-generator/types'

/**
 * Narrow a successful {@link GenerationResult} and return its init Lua output.
 * Asserts success via Vitest and throws with diagnostic context on failure.
 */
export function requireSuccessfulInitLua(result: GenerationResult): string {
  if (result.success !== true) {
    const messages = result.diagnostics.map((d) => d.message).join('; ')
    throw new Error(
      `Expected successful generation result with initLua, but generation failed: ${messages}`,
    )
  }
  expect(result.success).toBe(true)
  return result.initLua
}
