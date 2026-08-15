import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { InstalledPlugin, PluginSchema } from '@/shared/types'
import { PluginDetailModal } from '../PluginDetailModal'
import type { ValidPluginDisplayInfo } from '../PluginGridCard'

function makeSchema(id: string): PluginSchema {
  return {
    id,
    pluginName: id,
    pluginRepo: `owner/${id}`,
    version: '1.0.0',
    options: [
      {
        key: 'picker.enabled',
        label: 'Picker Enabled',
        type: 'boolean',
        group: 'General',
        default: true,
      },
      {
        key: 'notifier.enabled',
        label: 'Notifier Enabled',
        type: 'boolean',
        group: 'General',
        default: true,
      },
      {
        key: 'picker.cwd',
        label: 'Picker Cwd',
        type: 'string',
        group: 'Picker',
        enabledWhen: { key: 'picker.enabled', equals: true },
        visibleWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'picker.layout',
        label: 'Picker Layout',
        type: 'string',
        group: 'Picker',
        enabledWhen: { key: 'picker.enabled', equals: true },
        visibleWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'picker.formatter',
        label: 'Picker Formatter',
        type: 'string',
        group: 'Picker',
        enabledWhen: { key: 'picker.enabled', equals: true },
        visibleWhen: { key: 'picker.enabled', equals: true },
      },
      {
        key: 'notifier.timeout',
        label: 'Notifier Timeout',
        type: 'number',
        group: 'Notifier',
        enabledWhen: { key: 'notifier.enabled', equals: true },
        visibleWhen: { key: 'notifier.enabled', equals: true },
      },
      {
        key: 'notifier.level',
        label: 'Notifier Level',
        type: 'string',
        group: 'Notifier',
        enabledWhen: { key: 'notifier.enabled', equals: true },
        visibleWhen: { key: 'notifier.enabled', equals: true },
      },
    ],
    functions: [],
  }
}

function makeDisplayInfo(
  schema: PluginSchema,
  config: Record<string, boolean | string | number> = {},
): ValidPluginDisplayInfo {
  const installed: InstalledPlugin = {
    schemaId: schema.id,
    enabled: true,
    config,
    addedAt: 1,
  }
  return { status: 'installed', source: 'builtin', schema, installed }
}

const handlers = {
  onOpenChange: vi.fn(),
  onInstall: vi.fn().mockResolvedValue(undefined),
  onUninstall: vi.fn().mockResolvedValue(undefined),
  onDeleteSchema: vi.fn().mockResolvedValue(undefined),
  onToggle: vi.fn().mockResolvedValue(undefined),
  onConfigChange: vi.fn(),
}

describe('PluginDetailModal live sidebar counts', () => {
  function findGroupButton(name: 'Picker' | 'Notifier'): HTMLButtonElement {
    const match = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.startsWith(name))
    if (match === undefined) {
      throw new Error(`Missing sidebar group button: ${name}`)
    }
    if (!(match instanceof HTMLButtonElement)) {
      throw new Error(
        `Sidebar group button is not an HTMLButtonElement: ${name}`,
      )
    }
    return match
  }

  it('updates gated group counts immediately from unsaved toggles', async () => {
    const user = userEvent.setup()
    const schema = makeSchema('snacks-live')
    render(
      <PluginDetailModal
        open={true}
        displayInfo={makeDisplayInfo(schema)}
        {...handlers}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Configuration/ }))

    const pickerRow = findGroupButton('Picker')
    const notifierRow = findGroupButton('Notifier')
    expect(pickerRow).toHaveTextContent('3')
    expect(notifierRow).toHaveTextContent('2')

    await user.click(screen.getByRole('switch', { name: 'Picker Enabled' }))
    expect(pickerRow).toHaveTextContent('0')
    expect(screen.getByText('Picker is disabled')).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Picker Enabled' }))
    expect(pickerRow).toHaveTextContent('3')

    await user.click(screen.getByRole('switch', { name: 'Notifier Enabled' }))
    expect(notifierRow).toHaveTextContent('0')
    expect(pickerRow).toHaveTextContent('3')
  })

  it('re-seeds live values when switching to a different plugin', async () => {
    const user = userEvent.setup()
    const first = makeSchema('first-live')
    const second = makeSchema('second-live')

    const { rerender } = render(
      <PluginDetailModal
        open={true}
        displayInfo={makeDisplayInfo(first)}
        {...handlers}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^Configuration/ }))
    await user.click(screen.getByRole('switch', { name: 'Picker Enabled' }))
    expect(findGroupButton('Picker')).toHaveTextContent('0')

    rerender(
      <PluginDetailModal
        open={true}
        displayInfo={makeDisplayInfo(second, { 'picker.enabled': true })}
        {...handlers}
      />,
    )

    expect(findGroupButton('Picker')).toHaveTextContent('3')
  })
})
