import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectProfilesStore } from '@/features/profiles'
import { useKeymapStore } from '../store'
import type { ProjectKeymap } from '../types'
import { KeymapEditorDialog } from './KeymapEditorDialog'

const keymap: ProjectKeymap = {
  id: 'keymap',
  modes: ['n'],
  keySequence: 'x',
  description: '',
  silent: true,
  noremap: true,
  expr: false,
  enabled: true,
  profileIds: ['defined', 'unknown'],
  action: { actionType: 'code-block', code: 'print(1)' },
}

describe('KeymapEditorDialog profiles', () => {
  beforeEach(() => {
    useProjectProfilesStore.setState({
      profiles: [
        {
          id: 'defined',
          name: 'Defined',
          color: '#000000',
          defaultActive: true,
        },
      ],
      overrides: {},
      initStatus: { status: 'ready', projectPath: '/p' },
      projectPath: '/p',
      error: null,
    })
  })

  it('preserves hidden unknown assignments when editing', async () => {
    const updateManualKeymap = vi.fn().mockResolvedValue(undefined)
    useKeymapStore.setState({ updateManualKeymap })
    render(
      <KeymapEditorDialog
        open
        onOpenChange={vi.fn()}
        editingKeymap={keymap}
        projectPath="/p"
      />,
    )
    fireEvent.click(screen.getByLabelText('Defined'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(updateManualKeymap).toHaveBeenCalled())
    expect(updateManualKeymap.mock.calls[0]?.[1]).toMatchObject({
      profileIds: ['unknown'],
    })
  })
})
