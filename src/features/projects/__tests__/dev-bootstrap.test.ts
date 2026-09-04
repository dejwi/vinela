import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings, LoadedProject, Project } from '@/shared/types'
import * as projectStorage from '../storage'
import { getOrCreateDevProject } from '../storage'
import { useProjectStore } from '../store'

const storageApiMocks = vi.hoisted(() => ({
  ensureProjectDir: vi.fn(),
  folderExists: vi.fn(),
  getDevProjectPath: vi.fn(),
  isDevMode: vi.fn(),
  isValidProject: vi.fn(),
  listFolder: vi.fn(),
  projectFileExists: vi.fn(),
  readProjectFile: vi.fn(),
  writeProjectFile: vi.fn(),
}))

const settingsMocks = vi.hoisted(() => ({
  addRecentProject: vi.fn(),
  loadAppSettings: vi.fn(),
}))

vi.mock('@/shared/lib/storage-api', () => storageApiMocks)
vi.mock('@/shared/lib/settings', () => settingsMocks)
vi.mock('@/features/profiles/storage', () => ({
  ensureProjectProfilesSetup: vi.fn(),
}))

const DEV_PATH = '/repo/dev-data/default-project'

const PROJECT_DATA: Project = {
  id: 'dev-project-id',
  name: 'Dev Project',
  description: 'Auto-created development project',
  createdAt: 1700000000000,
  lastModifiedAt: 1700000000000,
}

const LOADED_PROJECT: LoadedProject = {
  ...PROJECT_DATA,
  absolutePath: DEV_PATH,
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  recentProjects: [],
  neovimOutputPath: undefined,
}

function collectPathArguments(): string[] {
  return [
    ...storageApiMocks.folderExists.mock.calls.map((args) => args[0]),
    ...storageApiMocks.isValidProject.mock.calls.map((args) => args[0]),
    ...storageApiMocks.ensureProjectDir.mock.calls.map((args) => args[0]),
    ...storageApiMocks.writeProjectFile.mock.calls.map((args) => args[0]),
    ...storageApiMocks.readProjectFile.mock.calls.map((args) => args[0]),
    ...storageApiMocks.projectFileExists.mock.calls.map((args) => args[0]),
  ].filter((path): path is string => typeof path === 'string')
}

describe('dev mode project bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    storageApiMocks.isDevMode.mockReturnValue(true)
    storageApiMocks.getDevProjectPath.mockResolvedValue(DEV_PATH)
    storageApiMocks.folderExists.mockResolvedValue(true)
    storageApiMocks.isValidProject.mockResolvedValue(true)
    storageApiMocks.listFolder.mockResolvedValue([])
    storageApiMocks.projectFileExists.mockResolvedValue(true)
    storageApiMocks.readProjectFile.mockResolvedValue(PROJECT_DATA)
    storageApiMocks.ensureProjectDir.mockResolvedValue(undefined)
    storageApiMocks.writeProjectFile.mockResolvedValue(undefined)

    settingsMocks.addRecentProject.mockResolvedValue(undefined)
    settingsMocks.loadAppSettings.mockResolvedValue(DEFAULT_SETTINGS)

    useProjectStore.setState({
      currentProject: null,
      recentProjects: [],
      isLoading: false,
      error: null,
    })
  })

  it('loads existing valid dev project', async () => {
    const result = await getOrCreateDevProject()

    expect(result).toEqual({
      success: true,
      project: LOADED_PROJECT,
      path: DEV_PATH,
    })
    expect(storageApiMocks.getDevProjectPath).toHaveBeenCalledTimes(1)
    expect(storageApiMocks.folderExists).toHaveBeenCalledWith(DEV_PATH)
    expect(storageApiMocks.isValidProject).toHaveBeenCalledWith(DEV_PATH)
  })

  it('creates missing dev project and re-opens it', async () => {
    storageApiMocks.folderExists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    storageApiMocks.isValidProject
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    storageApiMocks.readProjectFile.mockResolvedValueOnce(PROJECT_DATA)
    storageApiMocks.projectFileExists.mockResolvedValueOnce(true)

    const result = await getOrCreateDevProject()

    expect(result).toEqual({
      success: true,
      project: LOADED_PROJECT,
      path: DEV_PATH,
    })
    expect(storageApiMocks.ensureProjectDir).toHaveBeenCalledTimes(2)
    expect(storageApiMocks.writeProjectFile).toHaveBeenCalledTimes(1)
    expect(storageApiMocks.projectFileExists).toHaveBeenCalledWith(
      DEV_PATH,
      'project.json',
    )
  })

  it('returns structured failure when creation throws', async () => {
    storageApiMocks.folderExists
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('permission denied'))

    storageApiMocks.isValidProject.mockResolvedValueOnce(false)

    const result = await getOrCreateDevProject()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('create_project')
      expect(result.path).toBe(DEV_PATH)
      expect(result.message).toContain('permission denied')
    }
  })

  it('never uses fallback paths when bootstrap fails', async () => {
    storageApiMocks.folderExists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)

    storageApiMocks.isValidProject.mockResolvedValueOnce(false)
    storageApiMocks.writeProjectFile.mockRejectedValueOnce(
      new Error('disk full'),
    )

    const result = await getOrCreateDevProject()

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.path).toBe(DEV_PATH)
      expect(result.stage).toBe('create_project')
    }

    const pathArguments = collectPathArguments()
    expect(pathArguments.length).toBeGreaterThan(0)
    expect(pathArguments.every((path) => path === DEV_PATH)).toBe(true)
  })

  it('store initDevMode sets currentProject on success', async () => {
    const bootstrapSpy = vi
      .spyOn(projectStorage, 'getOrCreateDevProject')
      .mockResolvedValue({
        success: true,
        project: LOADED_PROJECT,
        path: DEV_PATH,
      })

    const loaded = await useProjectStore.getState().initDevMode()

    expect(loaded).toBe(true)
    expect(useProjectStore.getState().currentProject).toEqual(LOADED_PROJECT)
    expect(useProjectStore.getState().error).toBeNull()
    expect(settingsMocks.addRecentProject).toHaveBeenCalledWith(
      DEV_PATH,
      'Dev Project',
    )

    bootstrapSpy.mockRestore()
  })

  it('store initDevMode sets error on failure', async () => {
    const bootstrapSpy = vi
      .spyOn(projectStorage, 'getOrCreateDevProject')
      .mockResolvedValue({
        success: false,
        stage: 'final_open',
        path: DEV_PATH,
        message: 'Failed to read project.json',
      })

    const loaded = await useProjectStore.getState().initDevMode()

    expect(loaded).toBe(false)
    expect(useProjectStore.getState().currentProject).toBeNull()
    expect(useProjectStore.getState().error).toContain('final_open')
    expect(useProjectStore.getState().error).toContain(DEV_PATH)
    expect(settingsMocks.addRecentProject).not.toHaveBeenCalled()

    bootstrapSpy.mockRestore()
  })
})
