import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PluginSchema } from '@/shared/types'
import { PluginDetailSidebar } from '../PluginDetailSidebar'

const schema: PluginSchema = {
  id: 'snacks.nvim',
  pluginName: 'snacks.nvim',
  pluginRepo: 'https://github.com/folke/snacks.nvim',
  version: '1.2.0',
  options: [
    {
      key: 'picker.enabled',
      label: 'Picker Enabled',
      type: 'boolean',
      group: 'Picker',
      default: true,
    },
    {
      key: 'picker.cwd',
      label: 'Picker Cwd',
      type: 'string',
      group: 'Picker / Matcher',
      visibleWhen: { key: 'picker.enabled', equals: true },
    },
    {
      key: 'scope.treesitter',
      label: 'Scope Treesitter',
      type: 'boolean',
      group: 'Scope / Treesitter',
      default: true,
    },
  ],
  functions: [],
}

describe('PluginDetailSidebar hierarchy', () => {
  it('parent with own options navigates and expands', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <PluginDetailSidebar
        schema={schema}
        pluginValues={{}}
        activeView={{ kind: 'config' }}
        onSelectView={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Picker/ }))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'config', group: 'Picker' })
    expect(screen.getByRole('button', { name: /Matcher/ })).toBeInTheDocument()
  })

  it('child-only parent expands without navigation', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <PluginDetailSidebar
        schema={schema}
        pluginValues={{}}
        activeView={{ kind: 'config' }}
        onSelectView={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Scope/ }))
    expect(onSelect).not.toHaveBeenCalledWith({
      kind: 'config',
      group: 'Scope',
    })
    expect(
      screen.getByRole('button', { name: /Treesitter/ }),
    ).toBeInTheDocument()
  })

  it('auto-expands parent when active child group arrives after mount', () => {
    const { rerender } = render(
      <PluginDetailSidebar
        schema={schema}
        pluginValues={{}}
        activeView={{ kind: 'config' }}
        onSelectView={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('button', { name: /Matcher/ }),
    ).not.toBeInTheDocument()

    rerender(
      <PluginDetailSidebar
        schema={schema}
        pluginValues={{}}
        activeView={{ kind: 'config', group: 'Picker / Matcher' }}
        onSelectView={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Matcher/ })).toBeInTheDocument()
  })

  it('visible-counts react to pluginValues prop changes', () => {
    const { rerender } = render(
      <PluginDetailSidebar
        schema={schema}
        pluginValues={{ 'picker.enabled': true }}
        activeView={{ kind: 'config' }}
        onSelectView={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Picker/ })).toHaveTextContent(
      '2',
    )

    rerender(
      <PluginDetailSidebar
        schema={schema}
        pluginValues={{ 'picker.enabled': false }}
        activeView={{ kind: 'config' }}
        onSelectView={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Picker/ })).toHaveTextContent(
      '1',
    )
  })
})
