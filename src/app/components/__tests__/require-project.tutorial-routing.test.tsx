/**
 * Tutorial-routing tests for RequireProject.
 *
 * Verifies that RequireProject does NOT redirect to "/" during transient
 * null-project windows when a tutorial is active/paused/loading/completing.
 *
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/features/projects/store', () => ({
  useProjectStore: vi.fn(),
  getPersistedActiveProjectPath: vi.fn(() =>
    window.localStorage.getItem('vinela.activeProjectPath'),
  ),
  clearPersistedActiveProjectPath: vi.fn(() => {
    window.localStorage.removeItem('vinela.activeProjectPath')
  }),
}))

vi.mock('@/features/tutorial/store', () => ({
  useTutorialStore: vi.fn(),
}))

import { useProjectStore } from '@/features/projects/store'
import { useTutorialStore } from '@/features/tutorial/store'
import { RequireProject } from '../require-project'

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockOpenProjectForTutorial = vi.fn()
const mockOpenProject = vi.fn()

const SUCCESSFUL_OPEN_RESULT = {
  success: true as const,
  project: {
    id: 'project-id',
    name: 'Recovered Project',
    createdAt: 0,
    lastModifiedAt: 0,
    absolutePath: '/memory/projects/recovered-project',
  },
}

import type { ProjectState } from '@/features/projects/store'
import type { TutorialStoreState } from '@/features/tutorial/store'

function setupProjectStore(currentProject: object | null) {
  vi.mocked(useProjectStore).mockImplementation(
    (selector: (state: ProjectState) => unknown) =>
      selector({ currentProject } as ProjectState),
  )
  // Also expose getState for the recovery effect
  Reflect.set(
    vi.mocked(useProjectStore),
    'getState',
    vi.fn(() => ({
      currentProject,
      openProjectForTutorial: mockOpenProjectForTutorial,
      openProject: mockOpenProject,
      closeProject: vi.fn(),
    })),
  )
}

function setupTutorialStore(
  status: 'idle' | 'active' | 'paused' | 'loading' | 'completing',
  tutorialProjectPath: string | null = '/memory/projects/tutorial',
) {
  vi.mocked(useTutorialStore).mockImplementation(
    (selector: (state: TutorialStoreState) => unknown) =>
      selector({
        runtimeState: buildRuntimeState(status),
        tutorialProjectPath,
      } as TutorialStoreState),
  )
}

function buildRuntimeState(status: string) {
  switch (status) {
    case 'active':
      return {
        status: 'active',
        currentStepIndex: 2,
        isTransitioning: false,
        advanceConditionMet: false,
      }
    case 'paused':
      return { status: 'paused', reason: 'wrong-route', currentStepIndex: 2 }
    case 'loading':
      return { status: 'loading', message: 'Setting up…' }
    case 'completing':
      return { status: 'completing' }
    default:
      return { status: 'idle' }
  }
}

function renderWithRouter(ui: React.ReactElement, initialPath = '/editor') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div data-testid="home">Home</div>} />
        <Route element={ui}>
          <Route
            path="/editor"
            element={<div data-testid="editor">Editor</div>}
          />
          <Route
            path="/plugins"
            element={<div data-testid="plugins">Plugins</div>}
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RequireProject — tutorial routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOpenProjectForTutorial.mockResolvedValue(SUCCESSFUL_OPEN_RESULT)
    mockOpenProject.mockResolvedValue(SUCCESSFUL_OPEN_RESULT)
    window.localStorage.removeItem('vinela.activeProjectPath')
  })

  it('renders outlet when project is loaded (no tutorial)', () => {
    setupProjectStore({ name: 'My Project', path: '/projects/my-project' })
    setupTutorialStore('idle', null)

    renderWithRouter(<RequireProject />)

    expect(screen.getByTestId('editor')).toBeInTheDocument()
    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
  })

  it('redirects to home when project is null and tutorial is idle', () => {
    setupProjectStore(null)
    setupTutorialStore('idle', null)

    renderWithRouter(<RequireProject />)

    expect(screen.getByTestId('home')).toBeInTheDocument()
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })

  it('does NOT redirect to home when project is null and tutorial is active (recovery pending)', () => {
    setupProjectStore(null)
    setupTutorialStore('active', '/memory/projects/tutorial')

    // Recovery is in flight — should render nothing (null), not redirect
    const { container } = renderWithRouter(<RequireProject />)

    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
    // Container should be empty (null render)
    expect(container.firstChild).toBeNull()
  })

  it('does NOT redirect to home when project is null and tutorial is paused', () => {
    setupProjectStore(null)
    setupTutorialStore('paused', '/memory/projects/tutorial')

    const { container } = renderWithRouter(<RequireProject />)

    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('does NOT redirect to home when project is null and tutorial is loading', () => {
    setupProjectStore(null)
    setupTutorialStore('loading', '/memory/projects/tutorial')

    const { container } = renderWithRouter(<RequireProject />)

    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('does NOT redirect to home when project is null and tutorial is completing', () => {
    setupProjectStore(null)
    setupTutorialStore('completing', '/memory/projects/tutorial')

    const { container } = renderWithRouter(<RequireProject />)

    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()
  })

  it('attempts recovery when project is null during active tutorial', async () => {
    setupProjectStore(null)
    setupTutorialStore('active', '/memory/projects/tutorial')

    renderWithRouter(<RequireProject />)

    await waitFor(() => {
      expect(mockOpenProjectForTutorial).toHaveBeenCalledWith(
        '/memory/projects/tutorial',
      )
    })
  })

  it('redirects to home after recovery fails', async () => {
    setupProjectStore(null)
    setupTutorialStore('active', '/memory/projects/tutorial')
    mockOpenProjectForTutorial.mockRejectedValueOnce(
      new Error('Recovery failed'),
    )

    renderWithRouter(<RequireProject />)

    // After recovery fails, should redirect to home
    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })
  })

  it('does NOT redirect when tutorial is active but tutorialProjectPath is null', () => {
    setupProjectStore(null)
    setupTutorialStore('active', null)

    // No project path → cannot recover → redirect
    renderWithRouter(<RequireProject />)

    expect(screen.getByTestId('home')).toBeInTheDocument()
  })

  it('only attempts recovery once (one-shot latch)', async () => {
    setupProjectStore(null)
    setupTutorialStore('active', '/memory/projects/tutorial')
    // Recovery never resolves (simulates slow recovery)
    mockOpenProjectForTutorial.mockReturnValue(new Promise(() => {}))

    renderWithRouter(<RequireProject />)

    // Wait for the effect to fire
    await waitFor(() => {
      expect(mockOpenProjectForTutorial).toHaveBeenCalledTimes(1)
    })

    // Even if re-rendered, should not call again
    expect(mockOpenProjectForTutorial).toHaveBeenCalledTimes(1)
  })

  it('attempts regular project recovery when a persisted path exists', async () => {
    setupProjectStore(null)
    setupTutorialStore('idle', null)
    window.localStorage.setItem(
      'vinela.activeProjectPath',
      '/memory/projects/recovered-project',
    )

    const { container } = renderWithRouter(<RequireProject />)

    expect(screen.queryByTestId('home')).not.toBeInTheDocument()
    expect(container.firstChild).toBeNull()

    await waitFor(() => {
      expect(mockOpenProject).toHaveBeenCalledWith(
        '/memory/projects/recovered-project',
      )
    })
  })

  it('clears persisted project path and redirects when project recovery fails', async () => {
    setupProjectStore(null)
    setupTutorialStore('idle', null)
    window.localStorage.setItem(
      'vinela.activeProjectPath',
      '/memory/projects/missing-project',
    )
    mockOpenProject.mockResolvedValueOnce({
      success: false,
      error: 'not_found',
      message: 'Folder not found',
    })

    renderWithRouter(<RequireProject />)

    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })

    expect(window.localStorage.getItem('vinela.activeProjectPath')).toBe(null)
  })
})
