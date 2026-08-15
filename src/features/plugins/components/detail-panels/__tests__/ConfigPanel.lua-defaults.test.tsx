import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  PluginConfigValue,
  PluginSchema,
  SchemaOption,
} from '@/shared/types'
import type { ValidPluginDisplayInfo } from '../../PluginGridCard'
import { seedWithLuaDefaults } from '../ConfigPanel'
import { ConfigPanelHarness, renderControlledConfigPanel } from './_helpers'

function createSchema(id: string, options: SchemaOption[]): PluginSchema {
  return {
    id,
    pluginName: `Plugin ${id}`,
    pluginRepo: `owner/${id}`,
    version: '1.0.0',
    options,
    functions: [],
  }
}

function createInstalledDisplayInfo(params: {
  schema: PluginSchema
  config?: Record<string, PluginConfigValue>
}): ValidPluginDisplayInfo {
  return {
    status: 'installed',
    source: 'builtin',
    schema: params.schema,
    installed: {
      schemaId: params.schema.id,
      enabled: true,
      config: params.config ?? {},
      addedAt: 1,
    },
  }
}

describe('seedWithLuaDefaults', () => {
  it('returns input unchanged when no lua options', () => {
    const stored: Record<string, PluginConfigValue> = { count: 2 }
    const options: SchemaOption[] = [
      { key: 'count', label: 'Count', type: 'number' },
    ]

    expect(seedWithLuaDefaults(stored, options)).toEqual(stored)
  })

  it('seeds lua default when key is absent from stored config', () => {
    const seeded = seedWithLuaDefaults({}, [
      {
        key: 'handler',
        label: 'Handler',
        type: 'lua',
        default: 'function() return nil end',
      },
    ])

    expect(seeded['handler']).toBe('function() return nil end')
  })

  it('does not overwrite stored lua value including empty string', () => {
    const seeded = seedWithLuaDefaults({ handler: '' }, [
      {
        key: 'handler',
        label: 'Handler',
        type: 'lua',
        default: 'function() return nil end',
      },
    ])

    expect(seeded['handler']).toBe('')
  })

  it('skips seeding when lua default is undefined', () => {
    const seeded = seedWithLuaDefaults({}, [
      { key: 'handler', label: 'Handler', type: 'lua' },
    ])

    expect(seeded).toEqual({})
  })

  it('skips seeding when lua default is empty string', () => {
    const seeded = seedWithLuaDefaults({}, [
      { key: 'handler', label: 'Handler', type: 'lua', default: '' },
    ])

    expect(seeded).toEqual({})
  })

  it('does not seed explicit-only defaults', () => {
    const seeded = seedWithLuaDefaults({}, [
      {
        key: 'handler',
        label: 'Handler',
        type: 'lua',
        default: 'function() return nil end',
        defaultEmission: 'explicit-only',
      },
    ])

    expect(seeded).toEqual({})
  })

  it('recurses into object options and seeds nested lua defaults', () => {
    const seeded = seedWithLuaDefaults({}, [
      {
        key: 'opts',
        label: 'Opts',
        type: 'object',
        properties: [
          {
            key: 'callback',
            label: 'Callback',
            type: 'lua',
            default: 'function() return true end',
          },
        ],
      },
    ])

    expect(seeded).toEqual({
      opts: {
        callback: 'function() return true end',
      },
    })
  })
})

describe('ConfigPanel lua defaults behavior', () => {
  it('prefills lua default as value and does not show dirty banner on open', () => {
    const displayInfo = createInstalledDisplayInfo({
      schema: createSchema('lua-default', [
        {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'function() return nil end',
        },
      ]),
    })

    renderControlledConfigPanel({
      displayInfo,
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    expect(screen.getByRole('textbox')).toHaveValue('function() return nil end')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('marks dirty after edit and saves edited value', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const displayInfo = createInstalledDisplayInfo({
      schema: createSchema('lua-save', [
        {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'function() return nil end',
        },
      ]),
    })

    renderControlledConfigPanel({
      displayInfo,
      onConfigChange,
      onDirtyChange: vi.fn(),
    })

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'function() return true end')

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onConfigChange).toHaveBeenCalledWith({
      handler: 'function() return true end',
    })
  })

  it('reset restores lua default and clears dirty state', async () => {
    const user = userEvent.setup()
    const displayInfo = createInstalledDisplayInfo({
      schema: createSchema('lua-reset', [
        {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'function() return nil end',
        },
      ]),
    })

    renderControlledConfigPanel({
      displayInfo,
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'function() return true end')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('textbox')).toHaveValue('function() return nil end')
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('re-seeds when switching to a different plugin schema', () => {
    const first = createInstalledDisplayInfo({
      schema: createSchema('first-plugin', [
        {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'function() return nil end',
        },
      ]),
    })

    const second = createInstalledDisplayInfo({
      schema: createSchema('second-plugin', [
        {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'function() return true end',
        },
      ]),
    })

    const { rerender } = render(
      <ConfigPanelHarness
        displayInfo={first}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox')).toHaveValue('function() return nil end')

    rerender(
      <ConfigPanelHarness
        displayInfo={second}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox')).toHaveValue(
      'function() return true end',
    )
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('preserves stored lua value instead of overwriting with default', () => {
    const displayInfo = createInstalledDisplayInfo({
      schema: createSchema('stored-value', [
        {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'function() return nil end',
        },
      ]),
      config: {
        handler: 'function() return "custom" end',
      },
    })

    renderControlledConfigPanel({
      displayInfo,
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    expect(screen.getByRole('textbox')).toHaveValue(
      'function() return "custom" end',
    )
  })

  it('global reset uses seeded nested lua defaults baseline', async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const displayInfo = createInstalledDisplayInfo({
      schema: createSchema('nested-reset', [
        {
          key: 'opts',
          label: 'Opts',
          type: 'object',
          properties: [
            {
              key: 'callback',
              label: 'Callback',
              type: 'lua',
              default: 'function() return true end',
            },
          ],
        },
      ]),
    })

    renderControlledConfigPanel({
      displayInfo,
      onConfigChange: vi.fn(),
      onDirtyChange,
    })

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'function() return false end')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('textbox')).toHaveValue(
      'function() return true end',
    )
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    expect(onDirtyChange).toHaveBeenLastCalledWith(false)
    expect(seedWithLuaDefaults({}, displayInfo.schema.options)).toEqual({
      opts: { callback: 'function() return true end' },
    })
  })

  it('calls onResetAll with schema id on external reset trigger', async () => {
    const onResetAll = vi.fn()
    const displayInfo = createInstalledDisplayInfo({
      schema: createSchema('reset-all-callback', [
        {
          key: 'handler',
          label: 'Handler',
          type: 'lua',
          default: 'function() return nil end',
        },
      ]),
      config: {
        handler: 'function() return false end',
      },
    })

    const { rerender } = render(
      <ConfigPanelHarness
        displayInfo={displayInfo}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
        luaFieldOverrides={{ handler: true }}
        onResetAll={onResetAll}
        resetTrigger={0}
      />,
    )

    rerender(
      <ConfigPanelHarness
        displayInfo={displayInfo}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
        luaFieldOverrides={{ handler: true }}
        onResetAll={onResetAll}
        resetTrigger={1}
      />,
    )

    const resetDisplayInfo = createInstalledDisplayInfo({
      schema: displayInfo.schema,
      config: {
        suppressed_dirs: [],
        close_filetypes_on_save: ['checkhealth'],
      },
    })

    rerender(
      <ConfigPanelHarness
        displayInfo={resetDisplayInfo}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
        onResetAll={onResetAll}
        resetTrigger={1}
      />,
    )

    expect(onResetAll).toHaveBeenCalledWith('reset-all-callback')
  })

  it('external reset trigger resyncs array fields to defaults', async () => {
    const user = userEvent.setup()
    const onResetAll = vi.fn()
    const displayInfo = createInstalledDisplayInfo({
      schema: createSchema('reset-all-arrays', [
        {
          key: 'suppressed_dirs',
          label: 'Suppressed Directories',
          type: 'array',
          items: { itemType: 'string' },
          default: [],
        },
        {
          key: 'close_filetypes_on_save',
          label: 'Close Filetypes On Save',
          type: 'array',
          items: { itemType: 'string' },
          default: ['checkhealth'],
        },
      ]),
      config: {
        suppressed_dirs: ['~/Downloads'],
        close_filetypes_on_save: ['help'],
      },
    })

    const { rerender } = render(
      <ConfigPanelHarness
        displayInfo={displayInfo}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
        onResetAll={onResetAll}
        resetTrigger={0}
      />,
    )

    const inputs = screen.getAllByRole('textbox')
    const secondInput = inputs[1]
    if (secondInput === undefined) {
      throw new Error('Expected second array input before reset trigger')
    }
    await user.clear(secondInput)
    await user.type(secondInput, 'terminal')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    rerender(
      <ConfigPanelHarness
        displayInfo={displayInfo}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
        onResetAll={onResetAll}
        resetTrigger={1}
      />,
    )

    const inputsAfterReset = screen.getAllByRole('textbox')
    expect(inputsAfterReset).toHaveLength(1)
    expect(inputsAfterReset[0]).toHaveValue('checkhealth')
    expect(onResetAll).toHaveBeenCalledWith('reset-all-arrays')
  })
})
