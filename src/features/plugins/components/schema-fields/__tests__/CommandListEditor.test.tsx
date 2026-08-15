/**
 * CommandListEditor tests
 *
 * Covers:
 * - Local draft stability: edits are not clobbered by parent re-renders with
 *   reference-only `commands` churn (no useEffect resync).
 * - Seed-based resync: same-key semantic command update (via parent key prop)
 *   rehydrates draft correctly.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PluginKeymapCommand } from '@/shared/types'
import { CommandListEditor } from '../CommandListEditor'
import { getCommandListDraftSeed } from '../KeymapEditDialog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMMANDS: PluginKeymapCommand[] = [
  { name: 'accept', label: 'Accept' },
  { name: 'cancel', label: 'Cancel' },
  { name: 'fallback', label: 'Fallback', isTerminal: true },
]

function renderEditor(
  commands: string[],
  onChange = vi.fn(),
): ReturnType<typeof render> {
  return render(
    <CommandListEditor
      commands={commands}
      availableCommands={COMMANDS}
      onChange={onChange}
    />,
  )
}

// ---------------------------------------------------------------------------
// Draft stability: no clobber on reference churn
// ---------------------------------------------------------------------------

describe('CommandListEditor — draft stability (no useEffect resync)', () => {
  it('does not clobber local draft when parent re-renders with same-value commands', async () => {
    // Render with initial commands
    const initialCommands = ['accept']
    const { rerender } = renderEditor(initialCommands)

    // Add a command via UI
    await userEvent.click(screen.getByRole('button', { name: /add command/i }))

    // Now re-render with a new array reference but same semantic content
    // (simulates parent reference churn without semantic change)
    const sameContentNewRef = ['accept'] // new array reference, same value
    rerender(
      <CommandListEditor
        commands={sameContentNewRef}
        availableCommands={COMMANDS}
        onChange={vi.fn()}
      />,
    )

    // The local draft should still have 2 entries (the one we added)
    // If useEffect was present, it would have reset to 1 entry
    await waitFor(() => {
      // We added a command, so there should be 2 select dropdowns
      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBe(2)
    })
  })

  it('preserves local edits across parent re-renders', async () => {
    const onChange = vi.fn()
    const { rerender } = renderEditor(['accept'], onChange)

    // Add a Lua command
    await userEvent.click(
      screen.getByRole('button', { name: /add custom lua/i }),
    )

    // Re-render with same commands (reference churn)
    rerender(
      <CommandListEditor
        commands={['accept']}
        availableCommands={COMMANDS}
        onChange={onChange}
      />,
    )

    // Lua textarea should still be present (not reset)
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/function\(cmp\)/i),
      ).toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Seed-based resync: remount on semantic change
// ---------------------------------------------------------------------------

describe('CommandListEditor — seed-based resync via key prop', () => {
  it('getCommandListDraftSeed returns same value for same commands', () => {
    const seed1 = getCommandListDraftSeed(['accept', 'fallback'])
    const seed2 = getCommandListDraftSeed(['accept', 'fallback'])
    expect(seed1).toBe(seed2)
  })

  it('getCommandListDraftSeed returns different value for different commands', () => {
    const seed1 = getCommandListDraftSeed(['accept'])
    const seed2 = getCommandListDraftSeed(['accept', 'fallback'])
    expect(seed1).not.toBe(seed2)
  })

  it('getCommandListDraftSeed returns different value for reordered commands', () => {
    const seed1 = getCommandListDraftSeed(['accept', 'fallback'])
    const seed2 = getCommandListDraftSeed(['fallback', 'accept'])
    expect(seed1).not.toBe(seed2)
  })

  it('remounting with new key rehydrates draft from new commands', async () => {
    const seed1 = getCommandListDraftSeed(['accept'])
    const { rerender } = render(
      <CommandListEditor
        key={`edit-key::<CR>::open::${seed1}`}
        commands={['accept']}
        availableCommands={COMMANDS}
        onChange={vi.fn()}
      />,
    )

    // Verify initial state: 1 command
    expect(screen.getAllByRole('combobox').length).toBe(1)

    // Simulate parent semantic change: new seed → new key → remount
    const seed2 = getCommandListDraftSeed(['accept', 'fallback'])
    rerender(
      <CommandListEditor
        key={`edit-key::<CR>::open::${seed2}`}
        commands={['accept', 'fallback']}
        availableCommands={COMMANDS}
        onChange={vi.fn()}
      />,
    )

    // After remount, draft should reflect new commands (2 entries)
    await waitFor(() => {
      expect(screen.getAllByRole('combobox').length).toBe(2)
    })
  })
})
