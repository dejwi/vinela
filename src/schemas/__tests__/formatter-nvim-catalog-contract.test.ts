import { describe, expect, it } from 'vitest'
import type { PluginSchema } from '@/shared/types'
import formatterSchemaJson from '../formatter-nvim.json'
import upstream from './fixtures/formatter-nvim-upstream.json'

interface FormatterNvimUpstreamSnapshot {
  source: string
  ref: string
  fetchedAt: string
  filetypes: Record<string, string[]>
}

function normalizeSnapshotFiletype(filetype: string): string {
  return filetype === '*' ? 'any' : filetype
}

describe('formatter-nvim catalog contract (offline, vs vendored upstream snapshot)', () => {
  const schema = formatterSchemaJson as PluginSchema
  const snapshot = upstream as FormatterNvimUpstreamSnapshot

  it('every curated filetype and preset reference exists in the upstream snapshot', () => {
    const presetsOption = schema.options.find(
      (option) => option.key === 'presets',
    )
    expect(presetsOption?.type).toBe('mapping-table')
    if (!presetsOption || presetsOption.type !== 'mapping-table') return
    const filetypeColumn = presetsOption.columns.find(
      (column) => column.key === 'filetype',
    )
    const presetColumn = presetsOption.columns.find(
      (column) => column.key === 'preset',
    )
    if (filetypeColumn?.type !== 'select' || presetColumn?.type !== 'select') {
      return
    }

    for (const filetypeOption of filetypeColumn.options) {
      const snapshotFiletype = normalizeSnapshotFiletype(filetypeOption.value)
      expect(
        snapshot.filetypes[snapshotFiletype],
        `Curated filetype "${filetypeOption.value}" is missing from the vendored formatter.nvim upstream snapshot.`,
      ).toBeDefined()
    }

    const allSnapshotPresets = new Set(Object.values(snapshot.filetypes).flat())

    for (const presetOption of presetColumn.options) {
      expect(
        allSnapshotPresets.has(presetOption.value),
        `Curated preset "${presetOption.value}" is missing from the vendored formatter.nvim upstream snapshot.`,
      ).toBe(true)
    }
  })

  it('every formatter autofill recommendation exists in the vendored upstream snapshot', () => {
    const presetsOption = schema.options.find(
      (option) => option.key === 'presets',
    )
    expect(presetsOption?.type).toBe('mapping-table')
    if (!presetsOption || presetsOption.type !== 'mapping-table') return

    const presetColumn = presetsOption.columns.find(
      (column) => column.key === 'preset',
    )
    expect(presetColumn?.autoFill?.kind).toBe('value-by-column')
    if (presetColumn?.autoFill?.kind !== 'value-by-column') {
      return
    }

    for (const [filetype, recommendedPreset] of Object.entries(
      presetColumn.autoFill.values,
    )) {
      const normalizedFiletype = normalizeSnapshotFiletype(filetype)
      expect(
        snapshot.filetypes[normalizedFiletype]?.includes(recommendedPreset),
        `Recommended formatter "${recommendedPreset}" for filetype "${filetype}" is missing from the vendored formatter.nvim upstream snapshot.`,
      ).toBe(true)
    }
  })

  it('snapshot has at least one filetype with at least one preset', () => {
    const entries = Object.entries(snapshot.filetypes)
    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some(([, presets]) => presets.length > 0)).toBe(true)
  })

  it('snapshot ref is set', () => {
    expect(snapshot.ref).toMatch(
      /^(master|v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)$/,
    )
  })
})
