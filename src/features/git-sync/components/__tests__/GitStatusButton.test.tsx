import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const git = vi.hoisted(() => ({
  getState: vi.fn(),
  useGitSyncStore: vi.fn(),
}))
vi.mock('../../store', () => ({
  useGitSyncStore: Object.assign(git.useGitSyncStore, {
    getState: git.getState,
  }),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { GitStatusButton } from '../GitStatusButton'

const Wrapper = ({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element => (
  <TooltipPrimitive.Provider>{children}</TooltipPrimitive.Provider>
)

const snapshot = {
  headOid: 'one',
  branch: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  changedFiles: 0,
  conflictedFiles: 0,
}

describe('GitStatusButton', () => {
  const actions = {
    commitAll: vi.fn(),
    initializeProject: vi.fn(),
    refresh: vi.fn(),
    synchronize: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    git.getState.mockReturnValue({ projectPath: '/project' })
    actions.synchronize.mockResolvedValue({ success: true, didPull: false })
    actions.commitAll.mockResolvedValue({ success: true, didPull: false })
  })

  function state(
    repository: unknown,
    operation: string | null = null,
    projectPath: string | null = '/project',
  ): void {
    vi.mocked(git.useGitSyncStore).mockImplementation((selector) =>
      selector({
        repository,
        operation,
        lastError: null,
        projectPath,
        ...actions,
      }),
    )
  }

  it('hides inactive repositories', () => {
    state({ status: 'inactive' })
    const { container } = render(<GitStatusButton />, { wrapper: Wrapper })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the exact clean and conflict labels', () => {
    state({ status: 'ready', snapshot })
    render(<GitStatusButton />, { wrapper: Wrapper })
    expect(
      screen.getByLabelText('Git is up to date. Click to check now.'),
    ).toBeEnabled()
  })

  it('disables conflicts and opens the commit dialog for dirty projects', () => {
    state({ status: 'ready', snapshot: { ...snapshot, conflictedFiles: 2 } })
    const { rerender } = render(<GitStatusButton />, { wrapper: Wrapper })
    expect(
      screen.getByLabelText(
        'Git conflicts in 2 files. Resolve them outside Vinela.',
      ),
    ).toBeDisabled()
    state({ status: 'ready', snapshot: { ...snapshot, changedFiles: 1 } })
    rerender(<GitStatusButton />)
    fireEvent.click(
      screen.getByLabelText('Git: 1 uncommitted file. Click to commit all.'),
    )
    expect(screen.getByText('Commit all changes')).toBeInTheDocument()
  })

  it('does not reload after its project closes and reopens while sync is pending', async () => {
    let resolveSync:
      | ((value: { success: true; didPull: true }) => void)
      | undefined
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    actions.synchronize.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve
        }),
    )
    state({ status: 'ready', snapshot: { ...snapshot, behind: 1 } })
    const { rerender } = render(<GitStatusButton />, { wrapper: Wrapper })
    fireEvent.click(
      screen.getByLabelText('Git: 1 remote commit available. Click to pull.'),
    )
    state({ status: 'inactive' }, null, null)
    rerender(<GitStatusButton />)
    state({ status: 'ready', snapshot: { ...snapshot, behind: 1 } })
    rerender(<GitStatusButton />)
    resolveSync?.({ success: true, didPull: true })
    await Promise.resolve()
    expect(reload).not.toHaveBeenCalled()
  })
})
