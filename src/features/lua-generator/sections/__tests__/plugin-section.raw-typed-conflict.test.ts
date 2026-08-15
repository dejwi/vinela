import { describe, expect, it } from 'vitest'
import type { PluginConfigValue } from '@/shared/types'
import type {
  PluginSectionInput,
  ResolvedPluginForGeneration,
} from '../../types'
import { generatePluginSection } from '../plugin-section'

function makePlugin(
  config: Record<string, PluginConfigValue>,
): ResolvedPluginForGeneration {
  return {
    plugin: {
      id: 'snacks',
      schemaId: 'snacks-nvim',
      enabled: true,
      config,
    },
    schema: {
      id: 'snacks-nvim',
      pluginName: 'snacks.nvim',
      pluginRepo: 'folke/snacks.nvim',
      version: '1.5.0',
      setup: { requirePath: 'snacks' },
      functions: [],
      options: [
        {
          key: 'picker.sourcesRaw',
          emitKey: 'picker.sources',
          label: 'Sources Raw',
          type: 'lua',
          default: '{}',
        },
        {
          key: 'picker.sources.files.hidden',
          label: 'Files Hidden',
          type: 'boolean',
          default: false,
        },
        {
          key: 'picker.layout',
          label: 'Layout',
          type: 'string',
        },
      ],
    },
  }
}

function run(config: Record<string, PluginConfigValue>) {
  const input: PluginSectionInput = {
    resolvedPlugins: [makePlugin(config)],
    themePluginIds: new Set(),
  }
  return generatePluginSection(input)
}

describe('plugin-section raw/typed subtree conflict', () => {
  it('hard-fails when raw and typed descendant are both user-set', () => {
    const result = run({
      'picker.sourcesRaw': '{ files = { hidden = true } }',
      'picker.sources.files.hidden': true,
    })

    const error = result.diagnostics.find((d) => d.severity === 'error')
    expect(error?.message).toContain('picker.sourcesRaw')
    expect(error?.message).toContain('picker.sources.files.hidden')
    expect(error?.message).toContain('emits "picker.sources"')
  })

  it('allows raw only', () => {
    const result = run({
      'picker.sourcesRaw': '{ files = { hidden = true } }',
    })
    const output = result.code.join('\n')
    expect(
      result.diagnostics.filter((d) => d.severity === 'error'),
    ).toHaveLength(0)
    expect(output).toContain('sources = { files = { hidden = true } }')
  })

  it('allows typed only', () => {
    const result = run({
      'picker.sources.files.hidden': true,
    })
    const output = result.code.join('\n')
    expect(
      result.diagnostics.filter((d) => d.severity === 'error'),
    ).toHaveLength(0)
    expect(output).toContain('sources = {')
    expect(output).toContain('files = { hidden = true }')
  })

  it('treats empty raw string as not-set', () => {
    const result = run({
      'picker.sourcesRaw': '',
      'picker.sources.files.hidden': true,
    })
    expect(
      result.diagnostics.filter((d) => d.severity === 'error'),
    ).toHaveLength(0)
  })

  it('treats canonical empty raw table as not-set', () => {
    const result = run({
      'picker.sourcesRaw': '{}',
      'picker.sources.files.hidden': true,
    })
    expect(
      result.diagnostics.filter((d) => d.severity === 'error'),
    ).toHaveLength(0)
  })

  it('does not conflict for non-descendant sibling key', () => {
    const result = run({
      'picker.sourcesRaw': '{ files = { hidden = true } }',
      'picker.layout': 'vertical',
    })
    expect(
      result.diagnostics.filter((d) => d.severity === 'error'),
    ).toHaveLength(0)
  })
})
