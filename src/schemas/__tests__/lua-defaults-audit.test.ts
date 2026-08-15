import { describe, expect, it } from 'vitest'
import type { PluginSchema, SchemaOption } from '@/shared/types'
import autoSessionSchema from '../auto-session.json'
import formatterSchema from '../formatter-nvim.json'

function getAllLuaOptions(options: readonly SchemaOption[]): SchemaOption[] {
  const result: SchemaOption[] = []

  for (const option of options) {
    if (option.type === 'lua') {
      result.push(option)
      continue
    }

    if (option.type === 'object') {
      result.push(...getAllLuaOptions(option.properties))
    }
  }

  return result
}

function hasCommentOnlyLine(luaSource: string): boolean {
  return luaSource.split('\n').some((line) => line.trim().startsWith('--'))
}

describe('audited lua defaults are functional and comment-line-free', () => {
  const auditedSchemas: readonly PluginSchema[] = [
    autoSessionSchema as PluginSchema,
    formatterSchema as PluginSchema,
  ]

  for (const schema of auditedSchemas) {
    it(`${schema.id}: each lua default omits comment-only lines`, () => {
      const luaOptions = getAllLuaOptions(schema.options)

      for (const luaOption of luaOptions) {
        if (luaOption.type !== 'lua' || luaOption.default === undefined) {
          continue
        }

        expect(hasCommentOnlyLine(luaOption.default)).toBe(false)
      }
    })
  }
})
