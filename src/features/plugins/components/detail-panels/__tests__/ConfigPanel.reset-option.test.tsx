import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  PluginConfigValue,
  PluginSchema,
  SchemaOption,
} from '@/shared/types'
import type { ValidPluginDisplayInfo } from '../../PluginGridCard'
import { ConfigPanelHarness, renderControlledConfigPanel } from './_helpers'

function createSchema(options: SchemaOption[]): PluginSchema {
  return {
    id: 'test-plugin',
    pluginName: 'Test Plugin',
    pluginRepo: 'owner/test-plugin',
    version: '1.0.0',
    options,
    functions: [],
  }
}

function createDisplayInfo(
  schema: PluginSchema,
  config: Record<string, PluginConfigValue>,
  luaFieldOverrides?: Record<string, boolean>,
): ValidPluginDisplayInfo {
  return {
    status: 'installed',
    source: 'builtin',
    schema,
    installed: {
      schemaId: schema.id,
      enabled: true,
      config,
      addedAt: 1,
      ...(luaFieldOverrides !== undefined && { luaFieldOverrides }),
    },
  }
}

describe('ConfigPanel per-option lua reset', () => {
  it('hides reset icon when lua value matches default and no include override', () => {
    const schema = createSchema([
      {
        key: 'handler',
        label: 'Handler',
        type: 'lua',
        default: 'function() return nil end',
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createDisplayInfo(schema, {
        handler: 'function() return nil end',
      }),
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    expect(
      screen.queryByRole('button', { name: 'Reset "Handler" to default' }),
    ).not.toBeInTheDocument()
  })

  it('resets top-level dotted-key option without splitting key identity', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()

    const schema = createSchema([
      {
        key: 'session_lens.picker_opts',
        label: 'Picker Options',
        type: 'lua',
        default: '{ }',
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createDisplayInfo(schema, {
        'session_lens.picker_opts': '{ layout = "vertical" }',
      }),
      onConfigChange,
      onDirtyChange: vi.fn(),
      onLuaIncludeClear,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Reset "Picker Options" to default',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledWith({
      'session_lens.picker_opts': '{ }',
    })
    expect(onLuaIncludeClear).toHaveBeenCalledWith('session_lens.picker_opts')
  })

  it('shows reset for explicit-only top-level defaults and deletes stored value on save', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()

    const schema = createSchema([
      {
        key: 'handler',
        label: 'Handler',
        type: 'lua',
        default: 'function() return nil end',
        defaultEmission: 'explicit-only',
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createDisplayInfo(schema, {
        handler: 'function() return nil end',
      }),
      onConfigChange,
      onDirtyChange: vi.fn(),
      onLuaIncludeClear,
    })

    await user.click(
      screen.getByRole('button', { name: 'Reset "Handler" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledWith({})
    expect(onLuaIncludeClear).toHaveBeenCalledWith('handler')
  })

  it('resets nested lua option and preserves siblings', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()

    const schema = createSchema([
      {
        key: 'opts',
        label: 'Opts',
        type: 'object',
        properties: [
          {
            key: 'callback',
            label: 'Callback',
            type: 'lua',
            default: 'function() return false end',
          },
          {
            key: 'other',
            label: 'Other',
            type: 'string',
          },
        ],
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createDisplayInfo(schema, {
        opts: {
          callback: 'function() return true end',
          other: 'keep-me',
        },
      }),
      onConfigChange,
      onDirtyChange: vi.fn(),
      onLuaIncludeClear,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Reset "Callback" to default',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledWith({
      opts: {
        callback: 'function() return false end',
        other: 'keep-me',
      },
    })
    expect(onLuaIncludeClear).toHaveBeenCalledWith('opts.callback')
  })

  it('resets nested explicit-only lua option by deleting only the child value', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()

    const schema = createSchema([
      {
        key: 'opts',
        label: 'Opts',
        type: 'object',
        properties: [
          {
            key: 'callback',
            label: 'Callback',
            type: 'lua',
            default: 'function() return false end',
            defaultEmission: 'explicit-only',
          },
          {
            key: 'other',
            label: 'Other',
            type: 'string',
          },
        ],
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createDisplayInfo(schema, {
        opts: {
          callback: 'function() return false end',
          other: 'keep-me',
        },
      }),
      onConfigChange,
      onDirtyChange: vi.fn(),
      onLuaIncludeClear,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Reset "Callback" to default',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledWith({
      opts: {
        other: 'keep-me',
      },
    })
    expect(onLuaIncludeClear).toHaveBeenCalledWith('opts.callback')
  })

  it('resets lua option without default by deleting value slot', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()

    const schema = createSchema([
      {
        key: 'handler',
        label: 'Handler',
        type: 'lua',
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createDisplayInfo(schema, {
        handler: 'function() return true end',
      }),
      onConfigChange,
      onDirtyChange: vi.fn(),
      onLuaIncludeClear: vi.fn(),
    })

    await user.click(
      screen.getByRole('button', { name: 'Reset "Handler" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledWith({})
  })

  it('resets object option after external save-trigger validation attempt', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()
    const schema = createSchema([
      {
        key: 'opts',
        label: 'Opts',
        type: 'object',
        properties: [
          {
            key: 'count',
            label: 'Count',
            type: 'number',
            validation: { min: 1 },
            default: 1,
          },
          {
            key: 'name',
            label: 'Name',
            type: 'string',
            required: true,
          },
        ],
      },
    ])

    const displayInfo = createDisplayInfo(schema, {
      opts: { count: 0, name: '' },
    })

    const { rerender } = render(
      <ConfigPanelHarness
        displayInfo={displayInfo}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
        onLuaIncludeClear={onLuaIncludeClear}
        saveTrigger={0}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Reset "Opts" to default' }),
    ).toBeInTheDocument()

    rerender(
      <ConfigPanelHarness
        displayInfo={displayInfo}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
        onLuaIncludeClear={onLuaIncludeClear}
        saveTrigger={1}
      />,
    )

    expect(onConfigChange).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Reset "Opts" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(
      screen.getByRole('button', { name: 'Reset "Opts" to default' }),
    ).toBeInTheDocument()
    expect(onLuaIncludeClear).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledTimes(1)
    expect(onConfigChange).toHaveBeenCalledWith({})
  })
})
