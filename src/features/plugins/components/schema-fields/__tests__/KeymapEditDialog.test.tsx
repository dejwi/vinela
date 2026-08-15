import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PluginKeymapCommand } from '@/shared/types'
import type { KeymapSaveIntent } from '../KeymapEditDialog'
import { KeymapEditDialog } from '../KeymapEditDialog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMANDS: PluginKeymapCommand[] = [
  { name: 'accept', label: 'Accept' },
  { name: 'cancel', label: 'Cancel' },
  { name: 'fallback', label: 'Fallback', isTerminal: true },
]

function renderDialog(
  props: Partial<React.ComponentProps<typeof KeymapEditDialog>> & {
    onSave?: (intent: KeymapSaveIntent) => void
  } = {},
): void {
  const onSave = props.onSave ?? vi.fn()
  const onOpenChange = props.onOpenChange ?? vi.fn()

  render(
    <KeymapEditDialog
      open={true}
      onOpenChange={onOpenChange}
      availableCommands={COMMANDS}
      existingKeys={new Set()}
      onSave={onSave}
      {...props}
    />,
  )
}

// ---------------------------------------------------------------------------
// Add mode
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — add mode', () => {
  it('renders "Add Key Binding" title when initialKey is empty', () => {
    renderDialog({ initialKey: '' })
    expect(screen.getByText('Add Key Binding')).toBeInTheDocument()
  })

  it('Save button is disabled when key is empty', () => {
    renderDialog({ initialKey: '' })
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('Save button is disabled when key is set but no commands', async () => {
    renderDialog({ initialKey: '' })
    const input = screen.getByPlaceholderText('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')
    // No commands added → still disabled
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Edit mode — basic
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — edit mode', () => {
  it('renders "Edit Key Binding" title when initialKey is non-empty', () => {
    renderDialog({ initialKey: '<CR>', initialCommands: ['accept'] })
    expect(screen.getByText('Edit Key Binding')).toBeInTheDocument()
  })

  it('key input is enabled (rebind is allowed)', () => {
    renderDialog({ initialKey: '<CR>', initialCommands: ['accept'] })
    const input = screen.getByPlaceholderText('<CR>')
    expect(input).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Effect-based draft hydration (stale-state regression)
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — effect-based draft hydration', () => {
  it('rehydrates key when initialKey prop changes while dialog stays open', async () => {
    const { rerender } = render(
      <KeymapEditDialog
        open={true}
        onOpenChange={vi.fn()}
        initialKey="<CR>"
        initialCommands={['accept']}
        availableCommands={COMMANDS}
        existingKeys={new Set()}
        onSave={vi.fn()}
      />,
    )

    // Verify initial key is shown
    expect(screen.getByDisplayValue('<CR>')).toBeInTheDocument()

    // Switch to a different row (prop change without remount)
    rerender(
      <KeymapEditDialog
        open={true}
        onOpenChange={vi.fn()}
        initialKey="<Tab>"
        initialCommands={['fallback']}
        availableCommands={COMMANDS}
        existingKeys={new Set()}
        onSave={vi.fn()}
      />,
    )

    // Dialog should now show the new key
    await waitFor(() => {
      expect(screen.getByDisplayValue('<Tab>')).toBeInTheDocument()
    })
  })

  it('rehydrates disabled state when initialDisabled prop changes', async () => {
    const { rerender } = render(
      <KeymapEditDialog
        open={true}
        onOpenChange={vi.fn()}
        initialKey="<CR>"
        initialCommands={[]}
        initialDisabled={false}
        existsInPreset={true}
        allowDisable={true}
        availableCommands={COMMANDS}
        existingKeys={new Set()}
        onSave={vi.fn()}
      />,
    )

    // Switch to a disabled row
    rerender(
      <KeymapEditDialog
        open={true}
        onOpenChange={vi.fn()}
        initialKey="<C-e>"
        initialCommands={[]}
        initialDisabled={true}
        existsInPreset={true}
        allowDisable={true}
        availableCommands={COMMANDS}
        existingKeys={new Set()}
        onSave={vi.fn()}
      />,
    )

    await waitFor(() => {
      // The disable toggle should now be checked
      const toggle = screen.getByRole('switch', { name: /disable this key/i })
      expect(toggle).toBeChecked()
    })
  })
})

// ---------------------------------------------------------------------------
// Disable vs rebind mutual exclusivity (M2)
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — disable vs rebind mutual exclusivity', () => {
  it('emits disable-original intent when disable toggle is on and key unchanged', async () => {
    const onSave = vi.fn()
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      initialDisabled: false,
      existsInPreset: true,
      allowDisable: true,
      rowSource: 'preset',
      onSave,
    })

    // Turn on disable toggle
    const toggle = screen.getByRole('switch', { name: /disable this key/i })
    await userEvent.click(toggle)

    // Save
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    await userEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledOnce()
    const intent = onSave.mock.calls[0]?.[0] as KeymapSaveIntent
    expect(intent.intent).toBe('disable-original')
    if (intent.intent === 'disable-original') {
      expect(intent.originalKey).toBe('<CR>')
    }
  })

  it('emits upsert-binding intent (not disable-original) when key is changed (rebind mode)', async () => {
    const onSave = vi.fn()
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      allowDisable: true,
      rowSource: 'preset',
      onSave,
    })

    // Change the key (rebind)
    const input = screen.getByDisplayValue('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')

    // Save button should be enabled (commands already set from initialCommands)
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    await userEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledOnce()
    const intent = onSave.mock.calls[0]?.[0] as KeymapSaveIntent
    expect(intent.intent).toBe('upsert-binding')
    if (intent.intent === 'upsert-binding') {
      expect(intent.originalKey).toBe('<CR>')
      expect(intent.nextKey).toBe('<c-j>')
    }
  })

  it('disable toggle is disabled when in rebind mode', async () => {
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      allowDisable: true,
      rowSource: 'preset',
    })

    // Change the key to trigger rebind mode
    const input = screen.getByDisplayValue('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')

    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /disable this key/i })
      expect(toggle).toBeDisabled()
    })
  })

  it('payload is never mixed (disable+rename) — disable intent locks key to original', async () => {
    const onSave = vi.fn()
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      allowDisable: true,
      rowSource: 'preset',
      onSave,
    })

    // Turn on disable toggle
    const toggle = screen.getByRole('switch', { name: /disable this key/i })
    await userEvent.click(toggle)

    // Key input should be disabled when disable toggle is on
    const input = screen.getByDisplayValue('<CR>')
    expect(input).toBeDisabled()

    // Save
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const intent = onSave.mock.calls[0]?.[0] as KeymapSaveIntent
    // Must be disable-original, not upsert-binding
    expect(intent.intent).toBe('disable-original')
  })
})

// ---------------------------------------------------------------------------
// Duplicate detection with normalization
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — duplicate detection with normalization', () => {
  it('blocks save when normalized key matches existing key', async () => {
    // existingKeys contains the normalized form; <C-Space> normalizes to <c-Space> (capital S preserved)
    renderDialog({
      initialKey: '',
      existingKeys: new Set(['<c-Space>']),
    })

    const input = screen.getByPlaceholderText('<CR>')
    await userEvent.type(input, '<C-Space>')

    // Should show duplicate warning
    await waitFor(() => {
      expect(
        screen.getByText(/already exists in the effective map/i),
      ).toBeInTheDocument()
    })

    // Save button should be disabled
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('does not flag duplicate when editing the same key (identity exclusion)', async () => {
    // existingKeys contains the current key — should not be a duplicate
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existingKeys: new Set(['<cr>']),
    })

    // No duplicate warning
    expect(
      screen.queryByText(/already exists in the effective map/i),
    ).not.toBeInTheDocument()

    // Save should be enabled
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Rebind mode UI feedback
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — rebind mode UI', () => {
  it('shows rebind hint when key is changed from original', async () => {
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
    })

    const input = screen.getByDisplayValue('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')

    await waitFor(() => {
      expect(screen.getByText(/rebinding from/i)).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Blocked rebind UX (Caveat 4)
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — blocked rebind UX', () => {
  it('shows actionable inline blocked message when canRebind is false and user attempts rebind', async () => {
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      canRebind: false,
    })

    const input = screen.getByDisplayValue('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(
        /rebinding is not available/i,
      )
    })
  })

  it('disables Save button when rebind is blocked', async () => {
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      canRebind: false,
    })

    const input = screen.getByDisplayValue('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })
  })

  it('does not emit save intent when rebind is blocked', async () => {
    const onSave = vi.fn()
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      canRebind: false,
      onSave,
    })

    const input = screen.getByDisplayValue('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')

    // Try to click Save (it should be disabled, but verify no save fires)
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).toBeDisabled()
    // Even if somehow clicked, onSave should not be called
    expect(onSave).not.toHaveBeenCalled()
  })

  it('hides the generic "original key will be disabled" hint when rebind is blocked', async () => {
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      canRebind: false,
    })

    const input = screen.getByDisplayValue('<CR>')
    await userEvent.clear(input)
    await userEvent.type(input, '<C-j>')

    await waitFor(() => {
      // Blocked message should be shown
      expect(screen.getByRole('alert')).toBeInTheDocument()
      // Generic rebind hint ("The original key will be disabled") should NOT be shown
      expect(
        screen.queryByText(/the original key will be disabled/i),
      ).not.toBeInTheDocument()
    })
  })

  it('allows save when canRebind is false but key is not changed (same-key edit)', async () => {
    renderDialog({
      initialKey: '<CR>',
      initialCommands: ['accept'],
      existsInPreset: true,
      canRebind: false,
    })

    // Key is not changed — no rebind attempt
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Duplicate detection with alias/order/special-name normalization (Caveat 3)
// ---------------------------------------------------------------------------

describe('KeymapEditDialog — duplicate detection with alias normalization', () => {
  it('<Ctrl-a> collides with <c-a> in duplicate detection', async () => {
    renderDialog({
      initialKey: '',
      existingKeys: new Set(['<c-a>']),
    })

    const input = screen.getByPlaceholderText('<CR>')
    await userEvent.type(input, '<Ctrl-a>')

    await waitFor(() => {
      expect(
        screen.getByText(/already exists in the effective map/i),
      ).toBeInTheDocument()
    })
  })

  it('<S-C-Tab> collides with <C-S-Tab> in duplicate detection', async () => {
    // Both normalize to <c-s-Tab> (Tab casing preserved)
    renderDialog({
      initialKey: '',
      existingKeys: new Set(['<c-s-Tab>']),
    })

    const input = screen.getByPlaceholderText('<CR>')
    await userEvent.type(input, '<S-C-Tab>')

    await waitFor(() => {
      expect(
        screen.getByText(/already exists in the effective map/i),
      ).toBeInTheDocument()
    })
  })

  it('<Enter> collides with <CR> in duplicate detection', async () => {
    renderDialog({
      initialKey: '',
      existingKeys: new Set(['<cr>']),
    })

    const input = screen.getByPlaceholderText('<CR>')
    await userEvent.type(input, '<Enter>')

    await waitFor(() => {
      expect(
        screen.getByText(/already exists in the effective map/i),
      ).toBeInTheDocument()
    })
  })
})
