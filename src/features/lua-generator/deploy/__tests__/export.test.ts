import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExportOptions, ExportResult } from '../../types'

// Mock storage module
const mockIsMemoryMode = vi.fn()
vi.mock('@/shared/lib/storage', () => ({
  isMemoryMode: () => mockIsMemoryMode(),
}))

// Mock scoped-fs (replaces direct @tauri-apps/plugin-fs calls in export.ts)
const mockScopedMkdir = vi.fn()
const mockScopedReadDir = vi.fn()
const mockScopedReadTextFile = vi.fn()
const mockScopedWriteTextFile = vi.fn()
const mockScopedStat = vi.fn()
vi.mock('@/shared/lib/scoped-fs', () => ({
  scopedMkdir: (...args: unknown[]) => mockScopedMkdir(...args),
  scopedReadDir: (...args: unknown[]) => mockScopedReadDir(...args),
  scopedReadTextFile: (...args: unknown[]) => mockScopedReadTextFile(...args),
  scopedWriteTextFile: (...args: unknown[]) => mockScopedWriteTextFile(...args),
  scopedStat: (...args: unknown[]) => mockScopedStat(...args),
}))

// Mock direct-fs (used by path-resolution.ts::safePathExists → pathExistsDirect)
const mockPathExistsDirect = vi.fn()
vi.mock('@/shared/lib/direct-fs', () => ({
  pathExistsDirect: (...args: unknown[]) => mockPathExistsDirect(...args),
}))

// Mock path module
vi.mock('@/shared/lib/paths', () => ({
  PROJECT_PATHS: {
    PROJECT_JSON: 'project.json',
    SCHEMAS: 'schemas',
    GRAPHS: 'graphs',
  },
}))

const projectJson = JSON.stringify({
  name: 'Test Project',
  description: 'A test',
})

function mockSuccessfulExportReads(): void {
  mockScopedReadTextFile.mockImplementation(async (path: string) => {
    if (path.endsWith('/project.json')) {
      return projectJson
    }
    throw new Error('Not found')
  })
}

describe('export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScopedStat.mockRejectedValue(new Error('Not found'))
    mockPathExistsDirect.mockResolvedValue(false)
    mockScopedWriteTextFile.mockResolvedValue(undefined)
    mockScopedMkdir.mockResolvedValue(undefined)
    mockScopedReadDir.mockRejectedValue(new Error('Not found'))
  })

  describe('memory mode guard', () => {
    it('returns error when in memory mode', async () => {
      mockIsMemoryMode.mockReturnValue(true)

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- test code')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errorCode).toBe('memory-mode')
      }
    })
  })

  describe('destination validation', () => {
    beforeEach(() => {
      mockIsMemoryMode.mockReturnValue(false)
      mockSuccessfulExportReads()
    })

    it('returns error when destination is not empty', async () => {
      mockPathExistsDirect.mockResolvedValue(true)
      mockScopedStat.mockResolvedValue({ size: 100 })
      mockScopedReadDir.mockResolvedValue([
        {
          name: 'existing-file.txt',
          isFile: true,
          isDirectory: false,
          isSymlink: false,
        },
      ])

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- test code')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errorCode).toBe('destination-not-empty')
      }
    })

    it('proceeds when destination does not exist', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- test code')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.exportedTo).toBe('/test/export')
        expect(result.filesWritten).toContain('init.lua')
        expect(result.filesWritten).toContain('project.json')
      }
    })

    it('proceeds when destination exists but is empty', async () => {
      mockPathExistsDirect.mockResolvedValue(true)
      mockScopedStat.mockResolvedValue({ size: 100 })
      mockScopedReadDir.mockResolvedValue([])

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- test code')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.exportedTo).toBe('/test/export')
      }
    })
  })

  describe('file creation', () => {
    beforeEach(() => {
      mockIsMemoryMode.mockReturnValue(false)
      mockSuccessfulExportReads()
    })

    it('creates init.lua with provided code', async () => {
      const { exportProject } = await import('../export')

      const code = '-- Generated init.lua\nprint("hello")'
      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, code)

      expect(result.success).toBe(true)
      expect(mockScopedWriteTextFile).toHaveBeenCalledWith(
        '/test/export/init.lua',
        code,
      )
    })

    it('creates destination directory via scopedMkdir without .vinela', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      await exportProject(options, '-- code')

      expect(mockScopedMkdir).toHaveBeenCalledWith('/test/export')
      expect(mockScopedMkdir).not.toHaveBeenCalledWith('/test/export/.vinela')
    })

    it('copies root project.json and reports it in filesWritten', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.filesWritten).toContain('project.json')
        expect(result.filesWritten).not.toContain('.vinela/project.json')
      }
      expect(mockScopedReadTextFile).toHaveBeenCalledWith(
        '/test/project/project.json',
      )
      expect(mockScopedWriteTextFile).toHaveBeenCalledWith(
        '/test/export/project.json',
        projectJson,
      )
    })

    it('includes schemas when includeSchemas is true', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
        includeSchemas: true,
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(true)
      expect(mockScopedMkdir).toHaveBeenCalledWith('/test/export/schemas')
      expect(mockScopedMkdir).not.toHaveBeenCalledWith(
        '/test/export/.vinela/schemas',
      )
    })

    it('excludes schemas when includeSchemas is false', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
        includeSchemas: false,
      }

      await exportProject(options, '-- code')

      const schemaMkdirCalls = mockScopedMkdir.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('schemas'),
      )
      expect(schemaMkdirCalls.length).toBe(0)
    })

    it('includes source graphs when includeSourceGraphs is true', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
        includeSourceGraphs: true,
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(true)
      expect(mockScopedMkdir).toHaveBeenCalledWith('/test/export/graphs')
      expect(mockScopedMkdir).not.toHaveBeenCalledWith(
        '/test/export/.vinela/graphs',
      )
    })

    it('generates README.md with root project.json re-import instructions', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.filesWritten).toContain('README.md')
      }

      const readmeCall = mockScopedWriteTextFile.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].endsWith('README.md'),
      )
      expect(readmeCall).toBeDefined()

      const readmeContent = readmeCall?.[1] as string
      expect(readmeContent).toContain('# Test Project')
      expect(readmeContent).toContain('A test')
      expect(readmeContent).toContain('Requirements')
      expect(readmeContent).toContain('Installation')
      expect(readmeContent).toContain(
        'open this exported project folder (the folder containing `project.json`) as a project',
      )
      expect(readmeContent).not.toContain('.vinela/')
    })

    it('uses project name in README when available', async () => {
      const customProjectJson = JSON.stringify({
        name: 'My Custom Config',
        description: 'A custom Neovim configuration',
      })
      mockScopedReadTextFile.mockImplementation(async (path: string) => {
        if (path.endsWith('/project.json')) {
          return customProjectJson
        }
        throw new Error('Not found')
      })

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      await exportProject(options, '-- code')

      const readmeCall = mockScopedWriteTextFile.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].endsWith('README.md'),
      )
      const readmeContent = readmeCall?.[1] as string
      expect(readmeContent).toContain('# My Custom Config')
      expect(readmeContent).toContain('A custom Neovim configuration')
    })
  })

  describe('mandatory project marker failures', () => {
    beforeEach(() => {
      mockIsMemoryMode.mockReturnValue(false)
    })

    it('fails when source project.json cannot be read', async () => {
      mockScopedReadTextFile.mockRejectedValue(new Error('ENOENT'))

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errorCode).toBe('write-failed')
      }
      expect(mockScopedWriteTextFile).not.toHaveBeenCalledWith(
        '/test/export/project.json',
        expect.any(String),
      )
    })

    it('fails when destination project.json cannot be written', async () => {
      mockScopedReadTextFile.mockResolvedValue(projectJson)
      mockScopedWriteTextFile.mockImplementation(async (path: string) => {
        if (path === '/test/export/project.json') {
          throw new Error('EACCES: permission denied')
        }
      })

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errorCode).toBe('permission-denied')
      }
    })
  })

  describe('error handling', () => {
    beforeEach(() => {
      mockIsMemoryMode.mockReturnValue(false)
      mockSuccessfulExportReads()
    })

    it('returns permission-denied for EACCES errors', async () => {
      mockScopedMkdir.mockRejectedValue(new Error('EACCES: permission denied'))

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errorCode).toBe('permission-denied')
      }
    })

    it('returns write-failed for other errors', async () => {
      mockScopedMkdir.mockRejectedValue(new Error('Disk full'))

      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      const result: ExportResult = await exportProject(options, '-- code')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errorCode).toBe('write-failed')
      }
    })
  })

  describe('default options', () => {
    beforeEach(() => {
      mockIsMemoryMode.mockReturnValue(false)
      mockSuccessfulExportReads()
    })

    it('defaults includeSchemas to true', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      await exportProject(options, '-- code')

      expect(mockScopedMkdir).toHaveBeenCalledWith('/test/export/schemas')
    })

    it('defaults includeSourceGraphs to false', async () => {
      const { exportProject } = await import('../export')

      const options: ExportOptions = {
        projectPath: '/test/project',
        destinationPath: '/test/export',
      }

      await exportProject(options, '-- code')

      const graphMkdirCalls = mockScopedMkdir.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('graphs'),
      )
      expect(graphMkdirCalls.length).toBe(0)
    })
  })
})
