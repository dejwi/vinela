import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_PATHS } from '../paths'

const mockStat = vi.fn()
const mockHomeDir = vi.fn()
const mockAppDataDir = vi.fn()
const mockReadTextFile = vi.fn()
const mockWriteTextFile = vi.fn()
const mockMkdir = vi.fn()
const mockReadDir = vi.fn()

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    Home: 1,
    AppData: 2,
  },
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeTextFile: (...args: unknown[]) => mockWriteTextFile(...args),
  readTextFile: (...args: unknown[]) => mockReadTextFile(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  readDir: (...args: unknown[]) => mockReadDir(...args),
  remove: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: () => mockHomeDir(),
  appDataDir: () => mockAppDataDir(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('project storage fs helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockHomeDir.mockResolvedValue('/home/user')
    mockAppDataDir.mockResolvedValue('/home/user/.local/share/vinela')
  })

  it('validates projects using root project.json', async () => {
    mockStat.mockResolvedValue({})
    const { isValidProject } = await import('../fs')

    const isValid = await isValidProject('/home/user/demo')

    expect(isValid).toBe(true)
    expect(mockStat).toHaveBeenCalledWith(
      `demo/${PROJECT_PATHS.PROJECT_JSON}`,
      {
        baseDir: 1,
      },
    )
    expect(mockStat).not.toHaveBeenCalledWith('demo/.vinela/project.json', {
      baseDir: 1,
    })
  })

  it('checks project file existence relative to the project root', async () => {
    mockStat.mockResolvedValue({})
    const { projectFileExists } = await import('../fs')

    const exists = await projectFileExists(
      '/home/user/demo',
      PROJECT_PATHS.NEOVIM_OPTIONS,
    )

    expect(exists).toBe(true)
    expect(mockStat).toHaveBeenCalledWith(
      `demo/${PROJECT_PATHS.NEOVIM_OPTIONS}`,
      { baseDir: 1 },
    )
    expect(mockStat).not.toHaveBeenCalledWith(
      `demo/.vinela/${PROJECT_PATHS.NEOVIM_OPTIONS}`,
      { baseDir: 1 },
    )
  })

  it('reads and writes project files relative to the project root', async () => {
    mockReadTextFile.mockResolvedValue('{"id":"test"}')
    mockWriteTextFile.mockResolvedValue(undefined)
    const { readProjectFile, writeProjectFile } = await import('../fs')

    await readProjectFile('/home/user/demo', PROJECT_PATHS.PROJECT_JSON)
    await writeProjectFile('/home/user/demo', PROJECT_PATHS.PROJECT_JSON, {
      id: 'test',
    })

    expect(mockReadTextFile).toHaveBeenCalledWith(
      `demo/${PROJECT_PATHS.PROJECT_JSON}`,
      { baseDir: 1 },
    )
    expect(mockWriteTextFile).toHaveBeenCalledWith(
      `demo/${PROJECT_PATHS.PROJECT_JSON}`,
      JSON.stringify({ id: 'test' }, null, 2),
      { baseDir: 1 },
    )
  })

  it('lists project directories relative to the project root', async () => {
    mockReadDir.mockResolvedValue([])
    const { listProjectDir } = await import('../fs')

    await listProjectDir('/home/user/demo', PROJECT_PATHS.GRAPHS)

    expect(mockReadDir).toHaveBeenCalledWith(`demo/${PROJECT_PATHS.GRAPHS}`, {
      baseDir: 1,
    })
    expect(mockReadDir).not.toHaveBeenCalledWith(
      `demo/.vinela/${PROJECT_PATHS.GRAPHS}`,
      { baseDir: 1 },
    )
  })
})
