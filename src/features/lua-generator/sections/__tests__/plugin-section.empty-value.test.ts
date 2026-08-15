import { describe, expect, it } from 'vitest'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import type {
  PluginSectionInput,
  ResolvedPluginForGeneration,
} from '../../types'
import { generatePluginSection } from '../plugin-section'
import { expectFieldOmitted, expectRawLuaField } from './lua-output-helpers'

function createResolvedPlugin(
  options: SchemaOption[],
  config: Record<string, PluginConfigValue>,
  luaFieldOverrides?: Record<string, boolean>,
): ResolvedPluginForGeneration {
  return {
    plugin: {
      id: 'test-plugin',
      schemaId: 'test-plugin',
      enabled: true,
      config,
      ...(luaFieldOverrides !== undefined && { luaFieldOverrides }),
    },
    schema: {
      id: 'test-plugin',
      pluginName: 'Test Plugin',
      pluginRepo: 'owner/test-plugin',
      version: '1.0.0',
      setup: { requirePath: 'test-plugin' },
      functions: [],
      options,
    },
  }
}

function runSinglePlugin(plugin: ResolvedPluginForGeneration): {
  code: string
  diagnostics: ReturnType<typeof generatePluginSection>['diagnostics']
} {
  const input: PluginSectionInput = {
    resolvedPlugins: [plugin],
    themePluginIds: new Set(),
  }
  const result = generatePluginSection(input)
  return { code: result.code.join('\n'), diagnostics: result.diagnostics }
}

describe('plugin section empty lua value behavior', () => {
  const luaOption: SchemaOption = {
    key: 'handler',
    label: 'Handler',
    type: 'lua',
    default: 'function() return nil end',
  }

  it('omits empty string with no override', () => {
    const result = runSinglePlugin(
      createResolvedPlugin([luaOption], { handler: '' }),
    )
    expectFieldOmitted(result.code, 'handler')
  })

  it('omits empty string even when override is true', () => {
    const result = runSinglePlugin(
      createResolvedPlugin([luaOption], { handler: '' }, { handler: true }),
    )
    expect(result.code).not.toContain('handler = nil')
    expectFieldOmitted(result.code, 'handler')
  })

  it('omits empty string when override is false', () => {
    const result = runSinglePlugin(
      createResolvedPlugin([luaOption], { handler: '' }, { handler: false }),
    )
    expectFieldOmitted(result.code, 'handler')
  })

  it('omits nested empty string lua field', () => {
    const result = runSinglePlugin(
      createResolvedPlugin(
        [
          {
            key: 'opts',
            label: 'Opts',
            type: 'object',
            properties: [{ key: 'callback', label: 'Callback', type: 'lua' }],
          },
        ],
        {
          opts: { callback: '' },
        },
      ),
    )
    expectFieldOmitted(result.code, 'callback')
  })

  it('keeps regression: value equal to default is omitted', () => {
    const result = runSinglePlugin(
      createResolvedPlugin([luaOption], {
        handler: 'function() return nil end',
      }),
    )
    expectFieldOmitted(result.code, 'handler')
  })

  it('keeps regression: value differing from default is emitted', () => {
    const result = runSinglePlugin(
      createResolvedPlugin([luaOption], {
        handler: 'function() return true end',
      }),
    )
    expectRawLuaField(result.code, 'handler', 'return true')
  })

  it('keeps regression: forced include without value emits nil and warning', () => {
    const result = runSinglePlugin(
      createResolvedPlugin(
        [{ key: 'handler', label: 'Handler', type: 'lua' }],
        {},
        { handler: true },
      ),
    )

    expect(result.code).toContain('handler = nil')
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.severity === 'warning' &&
          diagnostic.message.includes('forced included without value/default'),
      ),
    ).toBe(true)
  })
})
