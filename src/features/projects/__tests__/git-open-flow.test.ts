import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadedProject } from '@/shared/types'

const mocks = vi.hoisted(() => ({
  addRecentProject: vi.fn(),
  initializeProject: vi.fn(),
  initializeScoped: vi.fn(),
  loadAppSettings: vi.fn(),
  openProject: vi.fn(),
  synchronizeOnOpen: vi.fn(),
}))

vi.mock('@/features/git-sync', () => ({
  useGitSyncStore: {
    getState: () => ({
      initializeProject: mocks.initializeProject,
      synchronizeOnOpen: mocks.synchronizeOnOpen,
    }),
  },
}))
vi.mock('@/app/state/reset-project-scoped-state', () => ({
  initializeProjectScopedState: mocks.initializeScoped,
  resetProjectScopedState: vi.fn(),
}))
vi.mock('@/shared/lib/settings', () => ({
  addRecentProject: mocks.addRecentProject,
  loadAppSettings: mocks.loadAppSettings,
  removeRecentProject: vi.fn(),
  restoreRecentProject: vi.fn(),
}))
vi.mock('../storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../storage')>()),
  openProject: mocks.openProject,
}))

import { useProjectStore } from '../store'

const project: LoadedProject = {
  id: 'project',
  name: 'Project',
  description: '',
  createdAt: 1,
  lastModifiedAt: 1,
  absolutePath: '/project',
}

describe('project Git activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.openProject.mockResolvedValue({ success: true, project })
    mocks.addRecentProject.mockResolvedValue(undefined)
    mocks.loadAppSettings.mockResolvedValue({
      theme: 'dark',
      recentProjects: [],
      neovimOutputPath: undefined,
    })
    mocks.synchronizeOnOpen.mockResolvedValue({ success: true, didPull: false })
    useProjectStore.setState({
      currentProject: null,
      isLoading: false,
      error: null,
    })
  })

  it('shows the project while awaiting only local Git inspection', async () => {
    let resolveGit: (() => void) | undefined
    mocks.initializeProject.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveGit = resolve
        }),
    )
    const opened = useProjectStore.getState().openProject('/project')
    await vi.waitFor(() =>
      expect(useProjectStore.getState().currentProject).toEqual(project),
    )
    expect(useProjectStore.getState().isLoading).toBe(true)
    expect(mocks.initializeScoped).not.toHaveBeenCalled()
    resolveGit?.()
    await opened
    expect(useProjectStore.getState().isLoading).toBe(false)
    expect(mocks.initializeScoped).toHaveBeenCalledWith('/project')
    expect(mocks.synchronizeOnOpen).toHaveBeenCalled()
  })
})
