// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { buildCatalog } from '@/shared/data/catalog-builder'
import { ACTION_CATALOG } from '@/shared/data/neovim/action-catalog-entries'
import type { PluginSchema } from '@/shared/types'
import { ActionPickerModal } from './ActionPickerModal'

const DEFAULT_VALUE = {
  mode: 'catalog' as const,
  actionType: 'command' as const,
  action: '',
  selectedActionKey: '',
  paramValues: {},
}
const CATALOG = buildCatalog(ACTION_CATALOG, []).filter(
  (entry) => entry.type !== 'function',
)

// Helper to render with required providers
function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// Helper to click the main action button (not info popover)
function clickActionButton(name: RegExp | string): void {
  const actionButtons = screen.getAllByRole('button', { name })
  // The main action button is the one with class containing 'text-left' (full width button)
  const mainActionButton = actionButtons.find((btn) =>
    btn.className.includes('text-left'),
  )
  expect(mainActionButton).toBeDefined()
  if (mainActionButton) {
    fireEvent.click(mainActionButton)
  }
}

describe('ActionPickerModal required parameter validation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('disables confirm for missing required params and enables after filling them', () => {
    renderWithProviders(
      <ActionPickerModal
        open
        onOpenChange={vi.fn()}
        value={DEFAULT_VALUE}
        onConfirm={vi.fn()}
        catalog={CATALOG}
      />,
    )

    // Click on the main action button (not the info popover)
    clickActionButton(/Go to Line Number/i)

    const confirmButton = screen.getByRole('button', { name: 'Confirm' })
    expect(confirmButton).toBeDisabled()
    expect(screen.getByText(/Required:\s*Line Number/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Line Number'), {
      target: { value: '42' },
    })

    expect(confirmButton).toBeEnabled()
  })
})

describe('ActionPickerModal mode toggle', () => {
  it('switches between preset and custom modes', () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ActionPickerModal
        open
        onOpenChange={vi.fn()}
        value={DEFAULT_VALUE}
        onConfirm={onConfirm}
        catalog={CATALOG}
      />,
    )

    // Initially in preset mode - grid should be visible
    expect(
      screen.getByPlaceholderText('Search actions... (press / to focus)'),
    ).toBeInTheDocument()

    // Click custom toggle in sidebar
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))

    // Should now be in custom mode - look for the textarea placeholder
    expect(screen.getByPlaceholderText(':write or gg')).toBeInTheDocument()

    // Type a custom command in the textarea (use the textarea directly)
    const textarea = screen
      .getAllByRole('textbox')
      .find((el) => el.tagName.toLowerCase() === 'textarea')
    expect(textarea).toBeDefined()
    if (textarea) {
      fireEvent.change(textarea, { target: { value: ':mycommand' } })
    }

    // Click confirm
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'custom-command',
        action: ':mycommand',
      }),
    )
  })
})

describe('ActionPickerModal plugin groups', () => {
  it('filters plugins independently from capability categories', () => {
    const schema: PluginSchema = {
      id: 'plugin',
      pluginName: 'Plugin.nvim',
      pluginRepo: 'https://github.com/test/plugin',
      version: '1.0.0',
      options: [],
      functions: [],
      exCommands: [
        {
          name: 'Plugin',
          description: 'Open plugin',
          template: ':Plugin',
          example: ':Plugin',
          sourceDoc: ':help Plugin',
          category: 'git',
        },
      ],
      exCommandTemplates: [
        {
          key: 'staged',
          baseCommandName: 'Plugin',
          label: 'Plugin Staged',
          shortDescription: 'Open staged changes',
          defaults: {},
        },
      ],
    }
    const catalog = buildCatalog(ACTION_CATALOG, [
      { schema, source: 'builtin' },
    ]).filter((entry) => entry.type !== 'function')

    renderWithProviders(
      <ActionPickerModal
        open
        onOpenChange={vi.fn()}
        value={DEFAULT_VALUE}
        onConfirm={vi.fn()}
        catalog={catalog}
      />,
    )

    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(screen.getByText('Plugins')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Plugin\.nvim.*2/ }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Plugin\.nvim.*2/ }))
    expect(screen.getByText('Plugin')).toBeInTheDocument()
    expect(screen.getByText('Plugin Staged')).toBeInTheDocument()
    expect(screen.queryByText('Save File')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Git/ }))
    expect(screen.getByText('Plugin')).toBeInTheDocument()
  })
})

describe('ActionPickerModal preview edit auto-switch', () => {
  it('auto-switches to custom mode when preview is edited', () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <ActionPickerModal
        open
        onOpenChange={vi.fn()}
        value={DEFAULT_VALUE}
        onConfirm={onConfirm}
        catalog={CATALOG}
      />,
    )

    // Select an action that has no required params (so we can see the preview)
    clickActionButton(/Save File/i)

    // Find and edit the preview input
    const previewInput = screen.getByDisplayValue(':write')
    fireEvent.change(previewInput, { target: { value: ':write!' } })

    // Custom mode should now be active (textarea is visible)
    expect(screen.getByPlaceholderText(':write or gg')).toBeInTheDocument()

    // Click confirm - should use custom mode
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: expect.stringMatching(/custom-/),
        action: ':write!',
      }),
    )
  })
})

describe('ActionPickerModal preview layout', () => {
  it('hides the catalog grid while details are expanded', () => {
    renderWithProviders(
      <ActionPickerModal
        open
        onOpenChange={vi.fn()}
        value={DEFAULT_VALUE}
        onConfirm={vi.fn()}
        catalog={CATALOG}
      />,
    )

    expect(screen.getByText('Quit')).toBeInTheDocument()

    clickActionButton(/Save File/i)

    expect(screen.queryByText('Quit')).not.toBeInTheDocument()
    expect(screen.getByText('Save File')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Collapse details'))

    expect(screen.getByText('Quit')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Expand details'))

    expect(screen.queryByText('Quit')).not.toBeInTheDocument()
  })
})
