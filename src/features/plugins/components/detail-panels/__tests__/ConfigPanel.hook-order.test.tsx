// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PluginSchema, SchemaOption } from '@/shared/types'
import type { ValidPluginDisplayInfo } from '../../PluginGridCard'
import { ConfigPanelHarness } from './_helpers'

function createSchema(
  id: string,
  options: SchemaOption[],
  functions: PluginSchema['functions'] = [],
): PluginSchema {
  return {
    id,
    pluginName: `Plugin ${id}`,
    pluginRepo: `owner/${id}`,
    version: '1.0.0',
    options,
    functions,
  }
}

function createInstalledDisplayInfo(
  schema: PluginSchema,
): ValidPluginDisplayInfo {
  return {
    status: 'installed',
    source: 'builtin',
    schema,
    installed: {
      schemaId: schema.id,
      enabled: true,
      config: {},
      addedAt: 1,
    },
  }
}

describe('ConfigPanel hook order', () => {
  it('rerenders from schemaless to populated options and back without hook errors', () => {
    const schemalessSchema = createSchema('hook-order', [])
    const populatedSchema = createSchema('hook-order', [
      { key: 'enabled', label: 'Enabled', type: 'boolean' },
    ])

    const { rerender } = render(
      <ConfigPanelHarness
        displayInfo={createInstalledDisplayInfo(schemalessSchema)}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    )

    expect(screen.getByText('No configuration available')).toBeInTheDocument()

    rerender(
      <ConfigPanelHarness
        displayInfo={createInstalledDisplayInfo(populatedSchema)}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Enabled')).toBeInTheDocument()

    rerender(
      <ConfigPanelHarness
        displayInfo={createInstalledDisplayInfo(schemalessSchema)}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    )

    expect(screen.getByText('No configuration available')).toBeInTheDocument()
  })

  it('shows no-options empty state when schema has functions but no options', () => {
    const schema = createSchema(
      'functions-only',
      [],
      [{ name: 'setup', params: [], luaCall: "require('plugin').setup()" }],
    )

    render(
      <ConfigPanelHarness
        displayInfo={createInstalledDisplayInfo(schema)}
        onConfigChange={vi.fn()}
        onDirtyChange={vi.fn()}
      />,
    )

    expect(screen.getByText('No configuration options')).toBeInTheDocument()
  })
})
