import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_PATHS } from '@/shared/lib/paths'
import type { Project } from '@/shared/types'

const mockFolderExists = vi.fn()
const mockIsValidProject = vi.fn()
const mockReadProjectFile = vi.fn()
const mockWriteProjectFile = vi.fn()
const mockEnsureProjectDir = vi.fn()
const mockListFolder = vi.fn()
const mockProjectFileExists = vi.fn()
const mockEnsureProjectProfilesSetup = vi.fn()

vi.mock('@/shared/lib/storage-api', () => ({
  folderExists: (...args: unknown[]) => mockFolderExists(...args),
  isValidProject: (...args: unknown[]) => mockIsValidProject(...args),
  readProjectFile: (...args: unknown[]) => mockReadProjectFile(...args),
  writeProjectFile: (...args: unknown[]) => mockWriteProjectFile(...args),
  ensureProjectDir: (...args: unknown[]) => mockEnsureProjectDir(...args),
  listFolder: (...args: unknown[]) => mockListFolder(...args),
  projectFileExists: (...args: unknown[]) => mockProjectFileExists(...args),
  getDevProjectPath: vi.fn(),
  isDevMode: vi.fn(),
}))

vi.mock('@/features/profiles/storage', () => ({
  ensureProjectProfilesSetup: (...args: unknown[]) =>
    mockEnsureProjectProfilesSetup(...args),
}))

describe('project storage service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockEnsureProjectProfilesSetup.mockResolvedValue(undefined)
  })

  it('opens a root-layout project successfully', async () => {
    const project: Project = {
      id: 'proj-1',
      name: 'My Config',
      createdAt: 1,
      lastModifiedAt: 1,
    }

    mockFolderExists.mockResolvedValue(true)
    mockIsValidProject.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue(project)

    const { openProject } = await import('../storage')
    const result = await openProject('/projects/my-neovim-config')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.project.absolutePath).toBe('/projects/my-neovim-config')
      expect(result.project.name).toBe('My Config')
    }
    expect(mockReadProjectFile).toHaveBeenCalledWith(
      '/projects/my-neovim-config',
      PROJECT_PATHS.PROJECT_JSON,
    )
    expect(mockEnsureProjectProfilesSetup).toHaveBeenCalledWith(
      '/projects/my-neovim-config',
    )
  })

  it('returns invalid_project when root project.json is missing', async () => {
    mockFolderExists.mockResolvedValue(true)
    mockIsValidProject.mockResolvedValue(false)

    const { openProject } = await import('../storage')
    const result = await openProject('/projects/empty')

    expect(result).toEqual({
      success: false,
      error: 'invalid_project',
      message:
        'No Vinela project found. Expected project.json directly in the selected folder.',
    })
  })

  it('returns read_error when root project.json is unreadable', async () => {
    mockFolderExists.mockResolvedValue(true)
    mockIsValidProject.mockResolvedValue(true)
    mockReadProjectFile.mockRejectedValue(new Error('Unexpected token'))

    const { openProject } = await import('../storage')
    const result = await openProject('/projects/broken')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('read_error')
      expect(result.message).toContain('Unexpected token')
    }
  })

  it('creates projects using root-relative paths', async () => {
    mockIsValidProject.mockResolvedValue(false)
    mockFolderExists.mockResolvedValue(false)
    mockEnsureProjectDir.mockResolvedValue(undefined)
    mockWriteProjectFile.mockResolvedValue(undefined)

    const { createProject } = await import('../storage')
    const result = await createProject('/projects/new', 'New Project')

    expect(result.success).toBe(true)
    expect(mockEnsureProjectDir).toHaveBeenCalledWith(
      '/projects/new',
      PROJECT_PATHS.GRAPHS,
    )
    expect(mockEnsureProjectDir).toHaveBeenCalledWith(
      '/projects/new',
      PROJECT_PATHS.SCHEMAS,
    )
    expect(mockWriteProjectFile).toHaveBeenCalledWith(
      '/projects/new',
      PROJECT_PATHS.PROJECT_JSON,
      expect.objectContaining({ name: 'New Project' }),
    )
    expect(mockEnsureProjectProfilesSetup).toHaveBeenCalledWith('/projects/new')
  })

  it('returns already_exists when a root project marker is present', async () => {
    mockIsValidProject.mockResolvedValue(true)

    const { createProject } = await import('../storage')
    const result = await createProject('/projects/existing', 'Duplicate')

    expect(result).toEqual({
      success: false,
      error: 'already_exists',
      message: 'A project already exists in this folder.',
    })
  })

  it('creates an example project from the bundled template', async () => {
    mockIsValidProject.mockResolvedValue(false)
    mockFolderExists.mockResolvedValue(true)
    mockListFolder.mockResolvedValue([])
    mockEnsureProjectDir.mockResolvedValue(undefined)
    mockWriteProjectFile.mockResolvedValue(undefined)

    const { createExampleProject } = await import('../storage')
    const result = await createExampleProject(
      '/memory/projects/my-example',
      'My Example',
      'Customized example',
    )

    expect(result.success).toBe(true)
    expect(mockEnsureProjectDir).toHaveBeenCalledWith(
      '/memory/projects/my-example',
      PROJECT_PATHS.GRAPHS,
    )
    expect(mockEnsureProjectDir).toHaveBeenCalledWith(
      '/memory/projects/my-example',
      PROJECT_PATHS.SCHEMAS,
    )
    expect(mockWriteProjectFile.mock.calls.map((call) => call[1])).toEqual([
      'colorschemes.json',
      'graphs/aa33917f-fd5e-46bb-85f7-e3922b26cc10.json',
      'keymaps.json',
      'lsp-servers.json',
      'profiles.json',
      'neovim-options.json',
      'plugins.json',
      'schemas/tokyonight.json',
      'project.json',
    ])
    expect(mockWriteProjectFile).toHaveBeenLastCalledWith(
      '/memory/projects/my-example',
      PROJECT_PATHS.PROJECT_JSON,
      expect.objectContaining({
        id: expect.any(String),
        name: 'My Example',
        description: 'Customized example',
      }),
    )
    expect(mockEnsureProjectProfilesSetup).toHaveBeenCalledWith(
      '/memory/projects/my-example',
    )
  })

  it('maps profile setup failures to existing errors', async () => {
    mockFolderExists.mockResolvedValue(true)
    mockIsValidProject.mockResolvedValue(true)
    mockReadProjectFile.mockResolvedValue({})
    mockEnsureProjectProfilesSetup.mockRejectedValue(new Error('profiles'))
    const { openProject, createProject } = await import('../storage')
    await expect(openProject('/projects/open')).resolves.toMatchObject({
      error: 'read_error',
    })
    mockIsValidProject.mockResolvedValue(false)
    mockFolderExists.mockResolvedValue(false)
    mockEnsureProjectDir.mockResolvedValue(undefined)
    await expect(
      createProject('/projects/create', 'Create'),
    ).resolves.toMatchObject({
      error: 'write_error',
    })
  })

  it('rejects an existing project without writing an example', async () => {
    mockIsValidProject.mockResolvedValue(true)

    const { createExampleProject } = await import('../storage')
    const result = await createExampleProject('/projects/existing', 'Duplicate')

    expect(result).toEqual({
      success: false,
      error: 'already_exists',
      message: 'A project already exists in this folder.',
    })
    expect(mockEnsureProjectDir).not.toHaveBeenCalled()
    expect(mockWriteProjectFile).not.toHaveBeenCalled()
  })

  it('rejects a non-empty folder without writing an example', async () => {
    mockIsValidProject.mockResolvedValue(false)
    mockFolderExists.mockResolvedValue(true)
    mockListFolder.mockResolvedValue([{ name: 'existing.txt' }])

    const { createExampleProject } = await import('../storage')
    const result = await createExampleProject('/projects/non-empty', 'Example')

    expect(result).toEqual({
      success: false,
      error: 'folder_not_empty',
      message:
        'The selected folder must be empty to create an example project.',
    })
    expect(mockEnsureProjectDir).not.toHaveBeenCalled()
    expect(mockWriteProjectFile).not.toHaveBeenCalled()
  })
})
