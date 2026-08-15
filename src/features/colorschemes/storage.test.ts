import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectColorSchemesFile } from '@/shared/types'
import {
  installColorScheme,
  loadCatalog,
  loadColorSchemePreferences,
  setActiveColorScheme,
  uninstallColorScheme,
} from './storage'

const projectFileStore = new Map<string, unknown>()
const writeCalls: string[] = []

function toStorageKey(projectPath: string, relativePath: string): string {
  return `${projectPath}::${relativePath}`
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

// Use vi.hoisted() so these mock references are available inside the vi.mock()
// factory, which vitest hoists to the top of the file before other declarations.
const { mockProjectFileExists, mockReadProjectFile, mockWriteProjectFile } =
  vi.hoisted(() => ({
    mockProjectFileExists: vi.fn(),
    mockReadProjectFile: vi.fn(),
    mockWriteProjectFile: vi.fn(),
  }))

vi.mock('@/shared/lib/storage-api', () => ({
  projectFileExists: mockProjectFileExists,
  readProjectFile: mockReadProjectFile,
  writeProjectFile: mockWriteProjectFile,
}))

vi.mock('@/features/plugins/storage', () => ({
  loadInstalledPlugins: vi.fn(async () => ({
    plugins: [] as Array<{ schemaId: string; enabled: boolean }>,
  })),
  installPlugin: vi.fn(async () => {}),
  uninstallPlugin: vi.fn(async () => {}),
  saveProjectSchema: vi.fn(async () => {}),
  getResolvedSchemas: vi.fn(
    async () =>
      [] as Array<{
        id: string
        pluginName: string
        pluginRepo: string
        version: string
        options: []
        functions: []
      }>,
  ),
}))

describe('colorscheme storage', () => {
  beforeEach(async () => {
    projectFileStore.clear()
    writeCalls.length = 0
    vi.clearAllMocks()
    // Reset any one-off overrides while keeping the default implementations.
    mockProjectFileExists.mockReset()
    mockProjectFileExists.mockImplementation(
      async (projectPath: string, relativePath: string) => {
        const key = toStorageKey(projectPath, relativePath)
        return projectFileStore.has(key)
      },
    )
    mockReadProjectFile.mockReset()
    mockReadProjectFile.mockImplementation(
      async (projectPath: string, relativePath: string) => {
        const key = toStorageKey(projectPath, relativePath)
        const value = projectFileStore.get(key)
        if (value === undefined) {
          throw new Error(`Missing file: ${key}`)
        }
        return cloneValue(value)
      },
    )
    mockWriteProjectFile.mockReset()
    mockWriteProjectFile.mockImplementation(
      async (projectPath: string, relativePath: string, data: unknown) => {
        writeCalls.push(relativePath)
        projectFileStore.set(
          toStorageKey(projectPath, relativePath),
          cloneValue(data),
        )
      },
    )
  })

  describe('loadCatalog', () => {
    it('returns catalog array', () => {
      const catalog = loadCatalog()
      expect(Array.isArray(catalog)).toBe(true)
    })
  })

  describe('loadColorSchemePreferences', () => {
    it('returns success with data from file when valid', async () => {
      const projectPath = '/project'
      const validPrefs: ProjectColorSchemesFile = {
        activeScheme: 'kanagawa',
        variantPreferences: {
          'theme--kanagawa.nvim': 'kanagawa',
        },
      }

      projectFileStore.set(
        toStorageKey(projectPath, 'colorschemes.json'),
        validPrefs,
      )

      const result = await loadColorSchemePreferences(projectPath)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(validPrefs)
        expect(result.source).toBe('file')
      }
    })

    it('returns success with defaults when file does not exist', async () => {
      const projectPath = '/project'

      const result = await loadColorSchemePreferences(projectPath)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          activeScheme: null,
          variantPreferences: {},
        })
        expect(result.source).toBe('default')
      }
    })

    it('returns error when file has invalid shape', async () => {
      const projectPath = '/project'
      const invalidPrefs = {
        activeScheme: 123, // should be string | null
        variantPreferences: {}, // This part is valid, but activeScheme is invalid
      }

      projectFileStore.set(
        toStorageKey(projectPath, 'colorschemes.json'),
        invalidPrefs,
      )

      const result = await loadColorSchemePreferences(projectPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid')
      }
    })

    it('rejects variantPreferences as array', async () => {
      const projectPath = '/project'
      const invalidPrefs = {
        activeScheme: 'kanagawa',
        variantPreferences: [], // Arrays are not valid records
      }

      projectFileStore.set(
        toStorageKey(projectPath, 'colorschemes.json'),
        invalidPrefs,
      )

      const result = await loadColorSchemePreferences(projectPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid')
      }
    })

    it('returns error when variantPreferences has non-string values', async () => {
      const projectPath = '/project'
      const invalidPrefs = {
        activeScheme: null,
        variantPreferences: {
          'theme--kanagawa.nvim': 123, // should be string
        },
      }

      projectFileStore.set(
        toStorageKey(projectPath, 'colorschemes.json'),
        invalidPrefs,
      )

      const result = await loadColorSchemePreferences(projectPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid')
      }
    })

    it('returns error on read errors when file exists', async () => {
      const projectPath = '/project'

      // Simulate file exists but read fails (e.g. permission error)
      // Use the module-level mock references directly (vi.mocked unavailable in dynamic import context).
      mockProjectFileExists.mockResolvedValueOnce(true)
      mockReadProjectFile.mockRejectedValueOnce(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' }),
      )

      const result = await loadColorSchemePreferences(projectPath)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Permission denied')
      }
    })
  })

  describe('installColorScheme', () => {
    it('fails gracefully when prefs load fails', async () => {
      const projectPath = '/project'
      projectFileStore.set(toStorageKey(projectPath, 'colorschemes.json'), {
        invalid: true,
      })

      const result = await installColorScheme(projectPath, 'kanagawa')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Failed to load preferences')
      }
    })

    it('installs carbonfox without shadowing the built-in Nightfox schema', async () => {
      const pluginStorage = await import('@/features/plugins/storage')
      const mockGetResolvedSchemas = vi.mocked(pluginStorage.getResolvedSchemas)
      const mockSaveProjectSchema = vi.mocked(pluginStorage.saveProjectSchema)
      const mockInstallPlugin = vi.mocked(pluginStorage.installPlugin)
      const mockLoadInstalledPlugins = vi.mocked(
        pluginStorage.loadInstalledPlugins,
      )

      mockGetResolvedSchemas.mockResolvedValueOnce([
        {
          id: 'nightfox',
          pluginName: 'nightfox.nvim',
          pluginRepo: 'https://github.com/EdenEast/nightfox.nvim',
          version: '1.0.0',
          options: [
            {
              key: 'style',
              label: 'Style',
              type: 'select',
              default: 'nightfox',
              options: [{ value: 'nightfox', label: 'Nightfox' }],
            },
          ],
          functions: [],
        },
      ])
      mockLoadInstalledPlugins.mockResolvedValueOnce({
        status: 'loaded',
        plugins: [],
      })

      const projectPath = '/project'
      const result = await installColorScheme(projectPath, 'carbonfox')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.pluginSchemaId).toBe('nightfox')
        expect(result.wasAlreadyInstalled).toBe(false)
      }
      expect(mockSaveProjectSchema).not.toHaveBeenCalled()
      expect(mockInstallPlugin).toHaveBeenCalledWith(projectPath, 'nightfox')

      const prefs = projectFileStore.get(
        toStorageKey(projectPath, 'colorschemes.json'),
      ) as ProjectColorSchemesFile
      expect(prefs.activeScheme).toBe('carbonfox')
      expect(prefs.variantPreferences['nightfox']).toBe('carbonfox')
    })

    it('does not reinstall when switching Nightfox variants', async () => {
      const pluginStorage = await import('@/features/plugins/storage')
      const mockGetResolvedSchemas = vi.mocked(pluginStorage.getResolvedSchemas)
      const mockSaveProjectSchema = vi.mocked(pluginStorage.saveProjectSchema)
      const mockInstallPlugin = vi.mocked(pluginStorage.installPlugin)
      const mockLoadInstalledPlugins = vi.mocked(
        pluginStorage.loadInstalledPlugins,
      )

      mockGetResolvedSchemas.mockResolvedValue([
        {
          id: 'nightfox',
          pluginName: 'nightfox.nvim',
          pluginRepo: 'https://github.com/EdenEast/nightfox.nvim',
          version: '1.0.0',
          options: [],
          functions: [],
        },
      ])

      const projectPath = '/project-switch'
      mockLoadInstalledPlugins
        .mockResolvedValueOnce({
          status: 'loaded',
          plugins: [
            { schemaId: 'nightfox', enabled: true, config: {}, addedAt: 1 },
          ],
        })
        .mockResolvedValueOnce({
          status: 'loaded',
          plugins: [
            { schemaId: 'nightfox', enabled: true, config: {}, addedAt: 1 },
          ],
        })

      projectFileStore.set(toStorageKey(projectPath, 'colorschemes.json'), {
        activeScheme: 'carbonfox',
        variantPreferences: { nightfox: 'carbonfox' },
      })

      const result = await installColorScheme(projectPath, 'dayfox', false)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.wasAlreadyInstalled).toBe(true)
      }
      expect(mockInstallPlugin).not.toHaveBeenCalled()
      expect(mockSaveProjectSchema).not.toHaveBeenCalled()

      const prefs = projectFileStore.get(
        toStorageKey(projectPath, 'colorschemes.json'),
      ) as ProjectColorSchemesFile
      expect(prefs.variantPreferences['nightfox']).toBe('dayfox')
      expect(prefs.activeScheme).toBe('carbonfox')
    })

    it('writes fallback project schema for catalog-only repositories', async () => {
      const pluginStorage = await import('@/features/plugins/storage')
      const mockGetResolvedSchemas = vi.mocked(pluginStorage.getResolvedSchemas)
      const mockSaveProjectSchema = vi.mocked(pluginStorage.saveProjectSchema)
      const mockInstallPlugin = vi.mocked(pluginStorage.installPlugin)
      const mockLoadInstalledPlugins = vi.mocked(
        pluginStorage.loadInstalledPlugins,
      )

      mockGetResolvedSchemas.mockResolvedValueOnce([])
      mockLoadInstalledPlugins.mockResolvedValueOnce({
        status: 'loaded',
        plugins: [],
      })

      const projectPath = '/project-catalog-only'
      const result = await installColorScheme(projectPath, 'gruvbox')

      expect(result.success).toBe(true)
      expect(mockSaveProjectSchema).toHaveBeenCalledTimes(1)
      expect(mockInstallPlugin).toHaveBeenCalledWith(
        projectPath,
        'theme--gruvbox.nvim',
      )
    })
  })

  describe('uninstallColorScheme', () => {
    it('fails gracefully when prefs load fails', async () => {
      const projectPath = '/project'
      // Create invalid prefs file
      projectFileStore.set(toStorageKey(projectPath, 'colorschemes.json'), {
        invalid: true,
      })

      const result = await uninstallColorScheme(projectPath, 'kanagawa')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Failed to load preferences')
      }
    })
  })

  describe('setActiveColorScheme', () => {
    it('fails gracefully when prefs load fails', async () => {
      const projectPath = '/project'
      // Create invalid prefs file
      projectFileStore.set(toStorageKey(projectPath, 'colorschemes.json'), {
        invalid: true,
      })

      const result = await setActiveColorScheme(projectPath, 'kanagawa')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Failed to load preferences')
      }
    })
  })
})
