import { describe, expect, it } from 'vitest'
import type { PluginSchema } from '@/shared/types'
import formatterSchemaJson from '../formatter-nvim.json'

describe('formatter-nvim schema', () => {
  const schema = formatterSchemaJson as PluginSchema

  it('uses mapping-table presets with formatter-specific emit metadata', () => {
    const presets = schema.options.find((option) => option.key === 'presets')
    expect(presets?.type).toBe('mapping-table')
    if (!presets || presets.type !== 'mapping-table') {
      return
    }

    expect(presets.emit.targetKey).toBe('filetype')
    expect(presets.emit.keyColumn).toBe('filetype')
    expect(presets.emit.valueColumn).toBe('preset')
    expect(presets.emit.outputKeyMap?.['*']).toBe('any')

    const presetColumn = presets.columns.find(
      (column) => column.key === 'preset',
    )
    expect(presetColumn?.autoFill?.kind).toBe('value-by-column')
    expect(presetColumn?.autoFill?.sourceColumn).toBe('filetype')
    expect(presetColumn?.autoFill?.values['javascript']).toBe('prettierd')
  })
})
