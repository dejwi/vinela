/**
 * PluginKeymapField tests
 *
 * Tests the override delta semantics matrix, rebind link tracking,
 * parent-prop resync, and rollback invariants.
 *
 * These tests operate at the PluginKeymapField level (not dialog level)
 * to verify the full save intent → overrides delta pipeline.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type {
  PluginConfigValue,
  SchemaPluginKeymapOption,
} from '@/shared/types'
import { PluginKeymapField } from '../PluginKeymapField'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOption(
  overrides?: Partial<SchemaPluginKeymapOption>,
): SchemaPluginKeymapOption {
  return {
    key: 'keymap',
    label: 'Keymaps',
    type: 'plugin-keymap',
    defaultPreset: 'default',
    allowDisable: true,
    commands: [
      { name: 'accept', label: 'Accept' },
      { name: 'cancel', label: 'Cancel' },
      { name: 'fallback', label: 'Fallback', isTerminal: true },
    ],
    presets: [
      {
        id: 'default',
        label: 'Default',
        mappings: {
          '<CR>': ['accept', 'fallback'],
          '<C-e>': ['cancel', 'fallback'],
        },
      },
      { id: 'none', label: 'None', mappings: {} },
    ],
    ...overrides,
  }
}

function makeValue(
  preset: string,
  overrides?: Record<string, PluginConfigValue>,
): PluginConfigValue {
  const result: Record<string, PluginConfigValue> = { preset }
  if (overrides !== undefined) {
    result['overrides'] = overrides
  }
  return result
}

function renderField(
  option: SchemaPluginKeymapOption,
  value: PluginConfigValue | undefined,
): { onChange: ReturnType<typeof vi.fn> } {
  const onChangeFn = vi.fn()
  render(
    <PluginKeymapField option={option} value={value} onChange={onChangeFn} />,
  )
  return { onChange: onChangeFn }
}

/** Get the last emitted config value from onChange mock */
function lastEmitted(
  onChange: ReturnType<typeof vi.fn>,
): PluginConfigValue | undefined {
  const calls = onChange.mock.calls
  if (calls.length === 0) return undefined
  return calls[calls.length - 1]?.[0] as PluginConfigValue
}

/**
 * Find the grid row containing a key label and return it as HTMLElement.
 * Throws if not found.
 */
function getRowForKey(keyText: string): HTMLElement {
  const keyEl = screen.getByText(keyText)
  const row = keyEl.closest('[class*="grid"]')
  if (!(row instanceof HTMLElement)) {
    throw new Error(`Could not find grid row for key: ${keyText}`)
  }
  return row
}

// ---------------------------------------------------------------------------
// Parent-prop resync (M1)
// ---------------------------------------------------------------------------

describe('PluginKeymapField — parent-prop resync (M1)', () => {
  it('rehydrates rows when external value changes', async () => {
    const option = makeOption()
    const { rerender } = render(
      <PluginKeymapField
        option={option}
        value={makeValue('default')}
        onChange={vi.fn()}
      />,
    )

    // Initially shows default preset rows
    expect(screen.getByText('<CR>')).toBeInTheDocument()

    // External value change: switch to 'none' preset
    rerender(
      <PluginKeymapField
        option={option}
        value={makeValue('none')}
        onChange={vi.fn()}
      />,
    )

    await waitFor(() => {
      // 'none' preset has no mappings, so no key rows
      expect(screen.queryByText('<CR>')).not.toBeInTheDocument()
    })
  })

  it('shows override rows from external value', () => {
    const option = makeOption()
    renderField(option, makeValue('default', { '<Tab>': ['accept'] }))

    // Should show the override row
    expect(screen.getByText('<Tab>')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Same-as-preset cleanup
// ---------------------------------------------------------------------------

describe('PluginKeymapField — same-as-preset cleanup', () => {
  it('removes override when commands match preset exactly', async () => {
    const option = makeOption()
    const { onChange } = renderField(option, makeValue('default'))

    // Open edit dialog for <CR> (preset row)
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    // Dialog opens — save with same commands as preset (accept, fallback)
    // The commands are already set from initialCommands
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    await userEvent.click(saveBtn)

    // The emitted value should NOT have an override for <CR>
    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>
    const overrides = emitted?.['overrides'] as
      | Record<string, PluginConfigValue>
      | undefined
    expect(overrides?.['<CR>']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Preset-origin rebind happy path (M2)
// ---------------------------------------------------------------------------

describe('PluginKeymapField — preset-origin rebind', () => {
  it('emits pair delta (old:false, new:commands) for rebind with allowDisable', async () => {
    const option = makeOption({ allowDisable: true })
    const { onChange } = renderField(option, makeValue('default'))

    // Open edit dialog for <CR>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    // Change key to <C-j>
    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')

    // Save
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>
    const overrides = emitted?.['overrides'] as Record<
      string,
      PluginConfigValue
    >

    // Old key should be disabled
    expect(overrides?.['<CR>']).toBe(false)
    // New key should have commands
    expect(overrides?.['<c-j>']).toBeDefined()
    // Preset should be unchanged
    expect(emitted?.['preset']).toBe('default')
  })
})

// ---------------------------------------------------------------------------
// Hard-block branch (M4)
// ---------------------------------------------------------------------------

describe('PluginKeymapField — hard-block branch', () => {
  it('does not emit onChange when allowDisable is false and no none preset and key is renamed', async () => {
    const option = makeOption({
      allowDisable: false,
      presets: [
        {
          id: 'default',
          label: 'Default',
          mappings: { '<CR>': ['accept', 'fallback'] },
        },
        // No 'none' preset
      ],
    })
    const { onChange } = renderField(option, makeValue('default'))

    // Open edit dialog for <CR>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    // Change key to <C-j>
    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')

    // Save
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    // onChange should NOT have been called (hard-block)
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Fork branch
// ---------------------------------------------------------------------------

describe('PluginKeymapField — fork branch', () => {
  it('switches to none preset and materializes effective map when allowDisable is false but none preset exists', async () => {
    const option = makeOption({
      allowDisable: false,
      presets: [
        {
          id: 'default',
          label: 'Default',
          mappings: { '<CR>': ['accept', 'fallback'] },
        },
        { id: 'none', label: 'None', mappings: {} },
      ],
    })
    const { onChange } = renderField(option, makeValue('default'))

    // Open edit dialog for <CR>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    // Change key to <C-j>
    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')

    // Save
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>

    // Preset should be switched to 'none'
    expect(emitted?.['preset']).toBe('none')
    // The new key should be in overrides
    const overrides = emitted?.['overrides'] as Record<
      string,
      PluginConfigValue
    >
    expect(overrides?.['<c-j>']).toBeDefined()
    // Old key should NOT be in overrides (it was removed via rename)
    expect(overrides?.['<CR>']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Rollback semantics (M3)
// ---------------------------------------------------------------------------

describe('PluginKeymapField — rollback semantics (M3)', () => {
  it('atomically removes both pair entries when reset-to-preset is invoked on disabled old key', async () => {
    const option = makeOption({ allowDisable: true })
    const { onChange } = renderField(option, makeValue('default'))

    // Step 1: Rebind <CR> to <C-j>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    // After rebind: <CR> is disabled, <C-j> is custom
    // Step 2: Reset <CR> (disabled) to preset — should atomically remove both
    await waitFor(() => {
      expect(screen.getByText('<CR>')).toBeInTheDocument()
    })

    const crRowAfterRebind = getRowForKey('<CR>')
    const resetBtn = within(crRowAfterRebind).getByRole('button', {
      name: 'Reset to preset',
    })
    await userEvent.click(resetBtn)

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>
    const overrides = emitted?.['overrides'] as
      | Record<string, PluginConfigValue>
      | undefined

    // Both entries should be gone
    expect(overrides?.['<CR>']).toBeUndefined()
    expect(overrides?.['<c-j>']).toBeUndefined()
  })

  it('linked replacement row shows Undo rebind button instead of Delete', async () => {
    const option = makeOption({ allowDisable: true })
    renderField(option, makeValue('default'))

    // Rebind <CR> to <C-j>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    // After rebind: <C-j> row should show "Undo rebind" not "Delete"
    await waitFor(() => {
      expect(screen.getByText('<c-j>')).toBeInTheDocument()
    })

    const cjRow = getRowForKey('<c-j>')
    expect(
      within(cjRow).queryByRole('button', { name: 'Delete key binding' }),
    ).toBeNull()
    expect(
      within(cjRow).getByRole('button', { name: 'Undo rebind' }),
    ).toBeInTheDocument()
  })

  it('undo rebind atomically removes both pair entries', async () => {
    const option = makeOption({ allowDisable: true })
    const { onChange } = renderField(option, makeValue('default'))

    // Rebind <CR> to <C-j>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Click "Undo rebind" on the <C-j> row
    await waitFor(() => {
      expect(screen.getByText('<c-j>')).toBeInTheDocument()
    })

    const cjRow = getRowForKey('<c-j>')
    const undoBtn = within(cjRow).getByRole('button', { name: 'Undo rebind' })
    await userEvent.click(undoBtn)

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>
    const overrides = emitted?.['overrides'] as
      | Record<string, PluginConfigValue>
      | undefined

    // Both entries should be gone
    expect(overrides?.['<CR>']).toBeUndefined()
    expect(overrides?.['<c-j>']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Disable intent
// ---------------------------------------------------------------------------

describe('PluginKeymapField — disable intent', () => {
  it('sets key to false in overrides when disable-original intent is saved', async () => {
    const option = makeOption({ allowDisable: true })
    const { onChange } = renderField(option, makeValue('default'))

    // Open edit dialog for <CR>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    // Turn on disable toggle
    const toggle = screen.getByRole('switch', { name: /disable this key/i })
    await userEvent.click(toggle)

    // Save
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>
    const overrides = emitted?.['overrides'] as Record<
      string,
      PluginConfigValue
    >
    expect(overrides?.['<CR>']).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// rebindLinks persistence (Caveat 2)
// ---------------------------------------------------------------------------

describe('PluginKeymapField — rebindLinks persistence', () => {
  it('hydrates Undo rebind affordance from persisted _meta.rebindLinks', () => {
    const option = makeOption({ allowDisable: true })
    // Simulate a value that was previously saved with _meta.rebindLinks
    const value: PluginConfigValue = {
      preset: 'default',
      overrides: {
        '<CR>': false,
        '<c-j>': ['accept', 'fallback'],
      },
      _meta: {
        rebindLinks: {
          '<c-j>': '<cr>',
        },
      },
    }
    renderField(option, value)

    // The <c-j> row should show "Undo rebind" (not "Delete")
    const cjRow = getRowForKey('<c-j>')
    expect(
      within(cjRow).getByRole('button', { name: 'Undo rebind' }),
    ).toBeInTheDocument()
    expect(
      within(cjRow).queryByRole('button', { name: 'Delete key binding' }),
    ).toBeNull()
  })

  it('round-trip: valid rebindLinks are preserved in serialized output', async () => {
    const option = makeOption({ allowDisable: true })
    const { onChange } = renderField(option, makeValue('default'))

    // Perform a rebind
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>

    // _meta.rebindLinks should be present and non-empty
    const meta = emitted?.['_meta'] as
      | Record<string, PluginConfigValue>
      | undefined
    expect(meta).toBeDefined()
    const links = meta?.['rebindLinks'] as Record<string, string> | undefined
    expect(links).toBeDefined()
    expect(links?.['<c-j>']).toBe('<cr>')
  })

  it('round-trip: empty rebindLinks are omitted from serialized output', async () => {
    const option = makeOption({ allowDisable: true })
    const { onChange } = renderField(option, makeValue('default'))

    // Perform a rebind then undo it
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Undo the rebind
    await waitFor(() => {
      expect(screen.getByText('<c-j>')).toBeInTheDocument()
    })
    const cjRow = getRowForKey('<c-j>')
    const undoBtn = within(cjRow).getByRole('button', { name: 'Undo rebind' })
    await userEvent.click(undoBtn)

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>

    // _meta should be absent (empty rebindLinks → omit)
    expect(emitted?.['_meta']).toBeUndefined()
  })

  it('prunes stale rebindLinks on hydration when newKey override is missing', () => {
    const option = makeOption({ allowDisable: true })
    // Stale: rebindLinks references <c-j> but overrides has no <c-j> entry
    const value: PluginConfigValue = {
      preset: 'default',
      overrides: {
        '<CR>': false,
        // <c-j> is missing from overrides — stale link
      },
      _meta: {
        rebindLinks: {
          '<c-j>': '<cr>',
        },
      },
    }
    renderField(option, value)

    // <c-j> row should not exist (it's not in overrides)
    expect(screen.queryByText('<c-j>')).not.toBeInTheDocument()
    // <CR> row should exist but without Undo rebind (link was pruned)
    const crRow = getRowForKey('<CR>')
    expect(
      within(crRow).queryByRole('button', { name: 'Undo rebind' }),
    ).toBeNull()
  })

  it('prunes stale rebindLinks on hydration when oldKey is not disabled', () => {
    const option = makeOption({ allowDisable: true })
    // Stale: rebindLinks says <CR> is the old key, but <CR> is not disabled
    const value: PluginConfigValue = {
      preset: 'default',
      overrides: {
        // <CR> is NOT false — stale link
        '<c-j>': ['accept', 'fallback'],
      },
      _meta: {
        rebindLinks: {
          '<c-j>': '<cr>',
        },
      },
    }
    renderField(option, value)

    // <c-j> row should exist but show Delete (not Undo rebind) since link was pruned
    const cjRow = getRowForKey('<c-j>')
    expect(
      within(cjRow).queryByRole('button', { name: 'Undo rebind' }),
    ).toBeNull()
    expect(
      within(cjRow).getByRole('button', { name: 'Delete key binding' }),
    ).toBeInTheDocument()
  })

  it('accepts legacy top-level rebindLinks for backward compatibility', () => {
    const option = makeOption({ allowDisable: true })
    // Legacy format: rebindLinks at top level (not under _meta)
    const value: PluginConfigValue = {
      preset: 'default',
      overrides: {
        '<CR>': false,
        '<c-j>': ['accept', 'fallback'],
      },
      rebindLinks: {
        '<c-j>': '<cr>',
      },
    }
    renderField(option, value)

    // Should still hydrate Undo rebind from legacy location
    const cjRow = getRowForKey('<c-j>')
    expect(
      within(cjRow).getByRole('button', { name: 'Undo rebind' }),
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Fallback alert for defensive hard-block (Caveat 4)
// ---------------------------------------------------------------------------

describe('PluginKeymapField — fallback alert for hard-block', () => {
  it('shows fallback alert when defensive hard-block branch fires', async () => {
    const option = makeOption({
      allowDisable: false,
      presets: [
        {
          id: 'default',
          label: 'Default',
          mappings: { '<CR>': ['accept', 'fallback'] },
        },
        // No 'none' preset — hard-block will fire
      ],
    })
    renderField(option, makeValue('default'))

    // Open edit dialog for <CR>
    const crRow = getRowForKey('<CR>')
    const editBtn = within(crRow).getByRole('button', {
      name: 'Edit key binding',
    })
    await userEvent.click(editBtn)

    // Change key to trigger rebind (blocked by canRebind=false in dialog)
    const keyInput = screen.getByDisplayValue('<CR>')
    await userEvent.clear(keyInput)
    await userEvent.type(keyInput, '<C-j>')

    // The dialog Save button should be disabled (canRebind=false)
    const saveBtn = screen.getByRole('button', { name: 'Save' })
    expect(saveBtn).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Custom key add and delete
// ---------------------------------------------------------------------------

describe('PluginKeymapField — custom key operations', () => {
  it('adds a custom key via Add Key dialog', async () => {
    const option = makeOption()
    const { onChange } = renderField(option, makeValue('default'))

    // Click Add Key
    await userEvent.click(screen.getByRole('button', { name: /add key/i }))

    // Type a new key
    const keyInput = screen.getByPlaceholderText('<CR>')
    await userEvent.type(keyInput, '<C-j>')

    // Add a command
    await userEvent.click(screen.getByRole('button', { name: /add command/i }))

    // Save
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>
    const overrides = emitted?.['overrides'] as Record<
      string,
      PluginConfigValue
    >
    expect(overrides?.['<c-j>']).toBeDefined()
  })

  it('deletes a custom key via Delete button in row', async () => {
    const option = makeOption()
    const { onChange } = renderField(
      option,
      makeValue('default', { '<Tab>': ['accept'] }),
    )

    // Find the <Tab> row and click Delete
    const tabRow = getRowForKey('<Tab>')
    const deleteBtn = within(tabRow).getByRole('button', {
      name: 'Delete key binding',
    })
    await userEvent.click(deleteBtn)

    const emitted = lastEmitted(onChange) as Record<string, PluginConfigValue>
    const overrides = emitted?.['overrides'] as
      | Record<string, PluginConfigValue>
      | undefined
    expect(overrides?.['<Tab>']).toBeUndefined()
  })
})
