/**
 * StartScreen callback wiring tests
 *
 * Tests for: callback wiring to navigate to /plugins on success paths.
 *
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: vi.fn(),
  }
})

vi.mock('@/features/projects/store', () => ({
  useProjectStore: vi.fn(),
  projectStore: {},
}))

vi.mock('@/features/tutorial', () => ({
  useTutorialStore: vi.fn(() => ({
    getState: () => ({ startTutorial: vi.fn() }),
  })),
}))

vi.mock('@/features/tutorial/storage', () => ({
  loadTutorialProgress: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@/shared/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib/storage')>(
    '@/shared/lib/storage',
  )
  return {
    ...actual,
    isMemoryMode: vi.fn(() => false),
  }
})

vi.mock('@/features/start/components/dev-mode-quick-start', () => ({
  DevModeQuickStart: ({ onSuccess }: { onSuccess: () => void }) => (
    <button type="button" onClick={onSuccess}>
      Trigger dev quick start success
    </button>
  ),
}))

vi.mock('@/features/start/components/new-project-dialog', () => ({
  NewProjectDialog: ({
    open,
    onSuccess,
    projectKind,
  }: {
    open: boolean
    onSuccess: () => void
    projectKind: 'blank' | 'example'
  }) =>
    open ? (
      <div data-testid="new-project-dialog" data-project-kind={projectKind}>
        <button type="button" onClick={onSuccess}>
          Trigger new project success
        </button>
      </div>
    ) : null,
}))

vi.mock('@/features/start/components/recent-projects-list', () => ({
  RecentProjectsList: ({ onNavigate }: { onNavigate: () => void }) => (
    <button type="button" onClick={onNavigate}>
      Trigger recent project navigate
    </button>
  ),
}))

import { useProjectStore } from '@/features/projects/store'
import { isMemoryMode } from '@/shared/lib/storage'
import StartScreen from '../start-screen'

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
const mockOpenProject = vi.fn(() => Promise.resolve({ success: true }))
const mockCreateProject = vi.fn()
const mockCreateExampleProject = vi.fn()

import type { ProjectState } from '@/features/projects/store'

function setupProjectStore(recentProjects: object[] = [], isLoading = false) {
  vi.mocked(useProjectStore).mockImplementation(
    (selector: (state: ProjectState) => unknown) =>
      selector({
        recentProjects,
        isLoading,
        currentProject: null,
        loadRecentProjects: vi.fn(() => Promise.resolve()),
        createProject: mockCreateProject,
        createExampleProject: mockCreateExampleProject,
      } as unknown as ProjectState),
  )

  Reflect.set(
    vi.mocked(useProjectStore),
    'getState',
    vi.fn(() => ({
      openProject: mockOpenProject,
    })),
  )
}

async function renderStartScreen(): Promise<void> {
  render(
    <MemoryRouter>
      <StartScreen />
    </MemoryRouter>,
  )

  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Take the guided tour' }),
    ).toBeInTheDocument()
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StartScreen callback wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
    mockOpenProject.mockReset()
    mockOpenProject.mockResolvedValue({ success: true })
    mockCreateProject.mockReset()
    mockCreateExampleProject.mockReset()
    vi.mocked(isMemoryMode).mockReturnValue(false)
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
  })

  it('navigates to /plugins after DevModeQuickStart onSuccess', async () => {
    setupProjectStore()
    await renderStartScreen()

    fireEvent.click(screen.getByRole('button', { name: /trigger dev/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/plugins')
  })

  it('navigates to /plugins after open folder success', async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    vi.mocked(open).mockResolvedValue('/test/project')

    setupProjectStore()
    await renderStartScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }))

    await waitFor(() => {
      expect(mockOpenProject).toHaveBeenCalledWith('/test/project')
      expect(mockNavigate).toHaveBeenCalledWith('/plugins')
    })
  })

  it('navigates to /plugins after NewProjectDialog onSuccess', async () => {
    setupProjectStore()
    await renderStartScreen()

    fireEvent.click(screen.getByRole('button', { name: 'New Project' }))
    fireEvent.click(
      screen.getByRole('button', { name: /trigger new project success/i }),
    )

    expect(mockNavigate).toHaveBeenCalledWith('/plugins')
  })

  it('opens the example dialog in desktop mode', async () => {
    setupProjectStore()
    await renderStartScreen()

    fireEvent.click(
      screen.getByRole('button', { name: 'Create Example Project' }),
    )

    expect(screen.getByTestId('new-project-dialog')).toHaveAttribute(
      'data-project-kind',
      'example',
    )
  })

  it('opens the example dialog in memory mode', async () => {
    vi.mocked(isMemoryMode).mockReturnValue(true)
    setupProjectStore()
    await renderStartScreen()

    fireEvent.click(
      screen.getByRole('button', { name: 'Create Example Project' }),
    )

    expect(screen.getByTestId('new-project-dialog')).toHaveAttribute(
      'data-project-kind',
      'example',
    )
  })

  it('creates an example with the suggested memory path', async () => {
    vi.mocked(isMemoryMode).mockReturnValue(true)
    mockCreateExampleProject.mockResolvedValue({
      success: true,
      project: {
        id: 'example',
        name: 'My Example',
        createdAt: 1,
        lastModifiedAt: 1,
        absolutePath: '/memory/projects/my-example',
      },
    })
    setupProjectStore()
    const { NewProjectDialog } = await vi.importActual<
      typeof import('../../components/new-project-dialog')
    >('../../components/new-project-dialog')
    const onSuccess = vi.fn()

    render(
      <NewProjectDialog
        open
        onOpenChange={vi.fn()}
        actionState="idle"
        setActionState={vi.fn()}
        onSuccess={onSuccess}
        projectKind="example"
      />,
    )

    fireEvent.change(screen.getByLabelText('Project Name *'), {
      target: { value: 'My Example' },
    })

    await waitFor(() => {
      expect(screen.getByLabelText('Folder Path *')).toHaveValue(
        '/memory/projects/my-example',
      )
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Create Example Project' }),
    )

    await waitFor(() => {
      expect(mockCreateExampleProject).toHaveBeenCalledWith(
        '/memory/projects/my-example',
        'My Example',
        'Example Neovim configuration created with Vinela.',
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('navigates to /plugins after RecentProjectsList onNavigate', async () => {
    setupProjectStore([
      {
        absolutePath: '/test/project',
        name: 'Test Project',
        lastOpenedAt: Date.now(),
      },
    ])
    await renderStartScreen()

    fireEvent.click(
      screen.getByRole('button', { name: /trigger recent project navigate/i }),
    )

    expect(mockNavigate).toHaveBeenCalledWith('/plugins')
  })
})
