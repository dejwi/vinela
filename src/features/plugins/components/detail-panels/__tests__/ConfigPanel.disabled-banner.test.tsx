import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  PluginConfigValue,
  PluginSchema,
  SchemaOption,
} from '@/shared/types'
import type { ValidPluginDisplayInfo } from '../../PluginGridCard'
import { renderControlledConfigPanel } from './_helpers'

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

function createInstalledDisplayInfo(
  schema: PluginSchema,
  config: Record<string, PluginConfigValue>,
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
    },
  }
}

function createAvailableDisplayInfo(
  schema: PluginSchema,
): ValidPluginDisplayInfo {
  return {
    status: 'available',
    source: 'builtin',
    schema,
  }
}

describe('ConfigPanel disabled-feature banner', () => {
  it('shows banner and enable action when all section options share unmet gate', () => {
    const schema = createSchema([
      {
        key: 'picker.enabled',
        label: 'Picker Enabled',
        type: 'boolean',
        group: 'General',
        default: false,
      },
      {
        key: 'picker.cwd',
        label: 'Cwd',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'picker.layout',
        label: 'Layout',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createInstalledDisplayInfo(schema, {
        'picker.enabled': false,
      }),
      activeGroup: 'Matcher',
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    expect(screen.getByText('Picker is disabled')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Enable Picker' }),
    ).toBeInTheDocument()
  })

  it('does not show banner when gate already matches expected value', () => {
    const schema = createSchema([
      {
        key: 'picker.enabled',
        label: 'Picker Enabled',
        type: 'boolean',
        group: 'General',
        default: false,
      },
      {
        key: 'picker.cwd',
        label: 'Cwd',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'picker.layout',
        label: 'Layout',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createInstalledDisplayInfo(schema, {
        'picker.enabled': true,
      }),
      activeGroup: 'Matcher',
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    expect(screen.queryByText('Picker is disabled')).not.toBeInTheDocument()
  })

  it('does not show banner for default-on gate without stored value', () => {
    const schema = createSchema([
      {
        key: 'picker.enabled',
        label: 'Picker Enabled',
        type: 'boolean',
        group: 'General',
        default: true,
      },
      {
        key: 'picker.cwd',
        label: 'Cwd',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'picker.layout',
        label: 'Layout',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createInstalledDisplayInfo(schema, {}),
      activeGroup: 'Matcher',
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    expect(screen.queryByText('Picker is disabled')).not.toBeInTheDocument()
  })

  it('clicking enable action applies expected gate value and hides banner', async () => {
    const user = userEvent.setup()
    const onConfigChange = vi.fn()
    const schema = createSchema([
      {
        key: 'picker.enabled',
        label: 'Picker Enabled',
        type: 'boolean',
        group: 'General',
        default: false,
      },
      {
        key: 'picker.cwd',
        label: 'Cwd',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'picker.layout',
        label: 'Layout',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createInstalledDisplayInfo(schema, {
        'picker.enabled': false,
      }),
      activeGroup: 'Matcher',
      onConfigChange,
      onDirtyChange: vi.fn(),
    })

    await user.click(screen.getByRole('button', { name: 'Enable Picker' }))

    expect(screen.queryByText('Picker is disabled')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onConfigChange).toHaveBeenCalledWith({
      'picker.enabled': true,
    })
  })

  it('does not show banner for mixed gated and ungated section', () => {
    const schema = createSchema([
      {
        key: 'picker.enabled',
        label: 'Picker Enabled',
        type: 'boolean',
        group: 'General',
        default: false,
      },
      {
        key: 'picker.cwd',
        label: 'Cwd',
        type: 'string',
        group: 'Matcher',
        enabledWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'picker.layout',
        label: 'Layout',
        type: 'string',
        group: 'Matcher',
      },
    ])

    renderControlledConfigPanel({
      displayInfo: createAvailableDisplayInfo(schema),
      activeGroup: 'Matcher',
      onConfigChange: vi.fn(),
      onDirtyChange: vi.fn(),
    })

    expect(screen.queryByText('Picker is disabled')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Enable Picker' }),
    ).not.toBeInTheDocument()
  })
})
