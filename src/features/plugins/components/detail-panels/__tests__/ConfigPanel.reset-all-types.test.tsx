import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  PluginConfigValue,
  PluginSchema,
  SchemaOption,
} from '@/shared/types'
import type { ValidPluginDisplayInfo } from '../../PluginGridCard'
import { ConfigPanelHarness as ConfigPanel } from './_helpers'

function schemaWith(option: SchemaOption): PluginSchema {
  return {
    id: `schema-${option.key}`,
    pluginName: 'Plugin',
    pluginRepo: 'owner/plugin',
    version: '1.0.0',
    options: [option],
    functions: [],
  }
}

function displayInfo(
  schema: PluginSchema,
  config: Record<string, PluginConfigValue>,
): ValidPluginDisplayInfo {
  return {
    status: 'installed',
    source: 'builtin',
    schema,
    installed: { schemaId: schema.id, enabled: true, config, addedAt: 1 },
  }
}

async function resetAndSave(label: string): Promise<void> {
  const user = userEvent.setup()
  await user.click(
    screen.getByRole('button', { name: `Reset "${label}" to default` }),
  )
  await user.click(screen.getByRole('button', { name: 'Reset' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
}

describe('ConfigPanel universal per-field reset', () => {
  it('resets an ordinary scalar and does not clear Lua overrides', async () => {
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()
    const option: SchemaOption = {
      key: 'name',
      label: 'Name',
      type: 'string',
      default: 'foo',
    }

    render(
      <ConfigPanel
        displayInfo={displayInfo(schemaWith(option), { name: 'bar' })}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
        onLuaIncludeClear={onLuaIncludeClear}
      />,
    )

    await resetAndSave(option.label)
    expect(onConfigChange).toHaveBeenCalledWith({ name: 'foo' })
    expect(onLuaIncludeClear).not.toHaveBeenCalled()
  })

  it('resets boolean inline layout through confirm-save wiring', async () => {
    const onConfigChange = vi.fn()
    const option: SchemaOption = {
      key: 'enabled',
      label: 'Enabled',
      type: 'boolean',
      default: false,
    }

    render(
      <ConfigPanel
        displayInfo={displayInfo(schemaWith(option), { enabled: true })}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
      />,
    )

    await resetAndSave(option.label)
    expect(onConfigChange).toHaveBeenCalledWith({ enabled: false })
  })

  it('renders multi-select fallback/default checked state and resets non-default selections', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const schema = schemaWith({
      key: 'modes',
      label: 'Modes',
      type: 'select',
      multi: true,
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
        { label: 'C', value: 'c' },
      ],
      default: ['a', 'b'],
    })

    const { unmount: unmountUnset } = render(
      <ConfigPanel
        displayInfo={displayInfo(schema, {})}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'A' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'B' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'C' })).not.toBeChecked()
    expect(
      screen.queryByRole('button', { name: 'Reset "Modes" to default' }),
    ).not.toBeInTheDocument()
    unmountUnset()

    render(
      <ConfigPanel
        displayInfo={displayInfo(schema, { modes: ['c'] })}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('checkbox', { name: 'C' })).toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Reset "Modes" to default' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Reset "Modes" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onConfigChange).toHaveBeenCalledWith({ modes: ['a', 'b'] })
  })

  it('resets array field to non-empty default and updates visible rows', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const schema = schemaWith({
      key: 'close_filetypes_on_save',
      label: 'Close Filetypes On Save',
      type: 'array',
      items: { itemType: 'string' },
      default: ['checkhealth'],
    })

    render(
      <ConfigPanel
        displayInfo={displayInfo(schema, {
          close_filetypes_on_save: ['help', 'terminal'],
        })}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Reset "Close Filetypes On Save" to default',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    const inputsAfterReset = screen.getAllByRole('textbox')
    expect(inputsAfterReset).toHaveLength(1)
    expect(inputsAfterReset[0]).toHaveValue('checkhealth')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onConfigChange).toHaveBeenCalledWith({
      close_filetypes_on_save: ['checkhealth'],
    })
  })

  it('resets lua and plugin-keymap with expected semantics', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()
    const schema: PluginSchema = {
      id: 'combo',
      pluginName: 'Combo',
      pluginRepo: 'owner/combo',
      version: '1.0.0',
      options: [
        { key: 'handler', label: 'Handler', type: 'lua', default: 'return 1' },
        {
          key: 'keys',
          label: 'Keys',
          type: 'plugin-keymap',
          defaultPreset: 'base',
          commands: [],
          presets: [{ id: 'base', label: 'Base', mappings: {} }],
        },
      ],
      functions: [],
    }

    render(
      <ConfigPanel
        displayInfo={displayInfo(schema, {
          handler: 'return 2',
          keys: {
            preset: 'base',
            overrides: { '<Tab>': ['accept'] },
            _meta: { rebindLinks: { '<S-Tab>': '<Tab>' } },
          },
        })}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
        onLuaIncludeClear={onLuaIncludeClear}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Reset "Handler" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(
      screen.getByRole('button', { name: 'Reset "Keys" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledWith({
      handler: 'return 1',
      keys: { preset: 'base' },
    })
    expect(onLuaIncludeClear).toHaveBeenCalledWith('handler')
  })

  it('object reset clears descendants, lua overrides, and deletes key without default', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const onLuaIncludeClear = vi.fn()
    const schema = schemaWith({
      key: 'opts',
      label: 'Opts',
      type: 'object',
      properties: [
        { key: 'name', label: 'Name', type: 'string' },
        {
          key: 'nested',
          label: 'Nested',
          type: 'object',
          properties: [
            {
              key: 'handler',
              label: 'Handler',
              type: 'lua',
              default: 'return 1',
            },
          ],
        },
      ],
    })

    render(
      <ConfigPanel
        displayInfo={displayInfo(schema, {
          opts: { name: 'x', nested: { handler: 'return 2' } },
        })}
        onConfigChange={onConfigChange}
        onDirtyChange={vi.fn()}
        onLuaIncludeClear={onLuaIncludeClear}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Reset "Opts" to default' }),
    )
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onConfigChange).toHaveBeenCalledWith({})
    expect(onLuaIncludeClear).toHaveBeenCalledWith('opts.nested.handler')
  })
})
