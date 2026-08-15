import { describe, expect, it } from 'vitest'
import { assertSchemaShape } from '@/features/lua-generator/utils/schema-shape-invariants'
import { validateSchema } from '@/shared/lib/schema-validation'
import builtinSchemas from '../index'

describe('all built-in schemas pass validation and shape invariants', () => {
  it('validates every runtime built-in schema with schema id diagnostics', () => {
    expect(builtinSchemas.length).toBeGreaterThan(0)

    const failures: string[] = []
    for (const schema of builtinSchemas) {
      const validation = validateSchema(schema)
      if (!validation.valid) {
        const messages = validation.errors
          .map((error) => `  - ${error.message}`)
          .join('\n')
        failures.push(`validateSchema("${schema.id}") failed:\n${messages}`)
      }

      try {
        assertSchemaShape(schema)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`assertSchemaShape("${schema.id}") failed: ${message}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(failures.join('\n\n'))
    }
  })
})
