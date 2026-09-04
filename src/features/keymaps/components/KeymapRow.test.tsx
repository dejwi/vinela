import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectProfilesStore } from '@/features/profiles'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { useKeymapStore } from '../store'
import type { ManualKeymapEntry } from '../types'
import { KeymapRow } from './KeymapRow'

const entry: ManualKeymapEntry = {
  source: 'project',
  keymapId: 'keymap',
  keymap: {
    id: 'keymap',
    modes: ['n'],
    keySequence: 'x',
    description: 'Test',
    silent: true,
    noremap: true,
    expr: false,
    enabled: false,
    profileIds: ['profile'],
    action: { actionType: 'code-block', code: 'print(1)' },
  },
}

function renderRow(profilesReady: boolean): ReturnType<typeof render> {
  return render(
    <TooltipProvider>
      <KeymapRow
        entry={entry}
        conflict={null}
        onEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
        onToggle={vi.fn()}
        onEnabledOverrideChange={vi.fn()}
        onNavigateToNode={vi.fn()}
        onNavigateToGraph={vi.fn()}
        getRunCustomActionTargetStatus={vi.fn()}
        profilesReady={profilesReady}
      />
    </TooltipProvider>,
  )
}

describe('KeymapRow profile activation', () => {
  beforeEach(() => {
    useProjectProfilesStore.setState({
      profiles: [
        {
          id: 'profile',
          name: 'Profile',
          color: '#000000',
          defaultActive: true,
        },
      ],
      overrides: {},
    })
    useKeymapStore.setState({ validationIssues: [] })
  })

  it('gates activation controls until profiles are ready', () => {
    const { container, rerender } = renderRow(false)
    expect(container.firstElementChild).not.toHaveClass(
      'opacity-60',
      'grayscale',
    )
    expect(screen.queryByText('Off')).not.toBeInTheDocument()
    expect(screen.queryByText('Profiles on')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Enable keyboard shortcut'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Override attached profiles'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Remove local override'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Edit shortcut')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete shortcut')).toBeInTheDocument()

    rerender(
      <TooltipProvider>
        <KeymapRow
          entry={entry}
          conflict={null}
          onEdit={vi.fn()}
          onDeleteRequest={vi.fn()}
          onToggle={vi.fn()}
          onEnabledOverrideChange={vi.fn()}
          onNavigateToNode={vi.fn()}
          onNavigateToGraph={vi.fn()}
          getRunCustomActionTargetStatus={vi.fn()}
          profilesReady
        />
      </TooltipProvider>,
    )
    expect(screen.getByText('Profiles on')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Override attached profiles'),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Enable keyboard shortcut'),
    ).not.toBeInTheDocument()
    expect(container.firstElementChild).not.toHaveClass(
      'opacity-60',
      'grayscale',
    )
  })
})
