import { BaseDirectory } from '@tauri-apps/plugin-fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Tauri plugin-fs mock ──────────────────────────────────────────────────────

const mockTauriMkdir = vi.fn()
const mockTauriWriteTextFile = vi.fn()
const mockTauriReadTextFile = vi.fn()
const mockTauriStat = vi.fn()
const mockTauriReadDir = vi.fn()
const mockTauriRemove = vi.fn()

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    Home: 1,
    AppData: 2,
  },
  mkdir: (...args: unknown[]) => mockTauriMkdir(...args),
  writeTextFile: (...args: unknown[]) => mockTauriWriteTextFile(...args),
  readTextFile: (...args: unknown[]) => mockTauriReadTextFile(...args),
  stat: (...args: unknown[]) => mockTauriStat(...args),
  readDir: (...args: unknown[]) => mockTauriReadDir(...args),
  remove: (...args: unknown[]) => mockTauriRemove(...args),
}))

// ── Tauri api/path mock ───────────────────────────────────────────────────────

const mockHomeDir = vi.fn()
vi.mock('@tauri-apps/api/path', () => ({
  homeDir: () => mockHomeDir(),
}))

describe('resolveScope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('resolves path within home to relative + BaseDirectory.Home (no trailing slash)', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { resolveScope: rs } = await import('../scoped-fs')

    const result = await rs('/home/user/.config/nvim/init.lua')

    expect(result.path).toBe('.config/nvim/init.lua')
    expect(result.baseDir).toBe(BaseDirectory.Home)
  })

  it('resolves path within home to relative + BaseDirectory.Home (homeDir with trailing slash)', async () => {
    // Some platforms / Tauri versions return home with a trailing slash
    mockHomeDir.mockResolvedValue('/home/user/')
    const { resolveScope: rs } = await import('../scoped-fs')

    const result = await rs('/home/user/.config/nvim/init.lua')

    expect(result.path).toBe('.config/nvim/init.lua')
    expect(result.baseDir).toBe(BaseDirectory.Home)
  })

  it('resolves path that IS the home directory (exact match, no trailing slash)', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { resolveScope: rs } = await import('../scoped-fs')

    const result = await rs('/home/user')

    expect(result.path).toBe('')
    expect(result.baseDir).toBe(BaseDirectory.Home)
  })

  it('resolves path that IS the home directory (exact match with trailing slash)', async () => {
    mockHomeDir.mockResolvedValue('/home/user/')
    const { resolveScope: rs } = await import('../scoped-fs')

    const result = await rs('/home/user')

    expect(result.path).toBe('')
    expect(result.baseDir).toBe(BaseDirectory.Home)
  })

  it('passes through paths outside home as absolute with no baseDir', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { resolveScope: rs } = await import('../scoped-fs')

    const result = await rs('/opt/homebrew/bin/nvim')

    expect(result.path).toBe('/opt/homebrew/bin/nvim')
    expect(result.baseDir).toBeUndefined()
  })

  it('passes through paths on Windows outside home', async () => {
    mockHomeDir.mockResolvedValue('C:\\Users\\Alice')
    const { resolveScope: rs } = await import('../scoped-fs')

    const result = await rs('D:\\work\\project\\file.txt')

    expect(result.path).toBe('D:\\work\\project\\file.txt')
    expect(result.baseDir).toBeUndefined()
  })

  it('does not misidentify a path that starts with the same prefix but is a sibling', async () => {
    // /home/username should not match /home/user
    mockHomeDir.mockResolvedValue('/home/user')
    const { resolveScope: rs } = await import('../scoped-fs')

    const result = await rs('/home/username/.config/nvim')

    expect(result.path).toBe('/home/username/.config/nvim')
    expect(result.baseDir).toBeUndefined()
  })
})

describe('scopedMkdir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockTauriMkdir.mockResolvedValue(undefined)
  })

  it('calls tauriMkdir with BaseDirectory.Home for home-relative paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedMkdir: sm } = await import('../scoped-fs')

    await sm('/home/user/.config/nvim')

    expect(mockTauriMkdir).toHaveBeenCalledWith('.config/nvim', {
      recursive: true,
      baseDir: BaseDirectory.Home,
    })
  })

  it('calls tauriMkdir with absolute path for non-home paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedMkdir: sm } = await import('../scoped-fs')

    await sm('/tmp/some-dir')

    expect(mockTauriMkdir).toHaveBeenCalledWith('/tmp/some-dir', {
      recursive: true,
    })
  })

  it('respects the recursive=false flag', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedMkdir: sm } = await import('../scoped-fs')

    await sm('/home/user/foo', false)

    expect(mockTauriMkdir).toHaveBeenCalledWith('foo', {
      recursive: false,
      baseDir: BaseDirectory.Home,
    })
  })
})

describe('scopedWriteTextFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockTauriWriteTextFile.mockResolvedValue(undefined)
  })

  it('calls tauriWriteTextFile with BaseDirectory.Home for home-relative paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedWriteTextFile: swt } = await import('../scoped-fs')

    await swt('/home/user/.config/nvim/init.lua', '-- lua content')

    expect(mockTauriWriteTextFile).toHaveBeenCalledWith(
      '.config/nvim/init.lua',
      '-- lua content',
      { baseDir: BaseDirectory.Home },
    )
  })

  it('calls tauriWriteTextFile with absolute path for non-home paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedWriteTextFile: swt } = await import('../scoped-fs')

    await swt('/tmp/output.lua', 'content')

    expect(mockTauriWriteTextFile).toHaveBeenCalledWith(
      '/tmp/output.lua',
      'content',
      {},
    )
  })
})

describe('scopedReadTextFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('calls tauriReadTextFile with BaseDirectory.Home for home-relative paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    mockTauriReadTextFile.mockResolvedValue('-- content')
    const { scopedReadTextFile: srt } = await import('../scoped-fs')

    const result = await srt('/home/user/.config/nvim/init.lua')

    expect(mockTauriReadTextFile).toHaveBeenCalledWith(
      '.config/nvim/init.lua',
      { baseDir: BaseDirectory.Home },
    )
    expect(result).toBe('-- content')
  })

  it('calls tauriReadTextFile with absolute path for non-home paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    mockTauriReadTextFile.mockResolvedValue('content')
    const { scopedReadTextFile: srt } = await import('../scoped-fs')

    await srt('/opt/config/file.lua')

    expect(mockTauriReadTextFile).toHaveBeenCalledWith(
      '/opt/config/file.lua',
      {},
    )
  })
})

describe('scopedStat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('calls tauriStat with BaseDirectory.Home for home-relative paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    mockTauriStat.mockResolvedValue({ size: 100, isFile: true })
    const { scopedStat: ss } = await import('../scoped-fs')

    await ss('/home/user/.config/nvim/init.lua')

    expect(mockTauriStat).toHaveBeenCalledWith('.config/nvim/init.lua', {
      baseDir: BaseDirectory.Home,
    })
  })

  it('propagates the stat result', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const fakeStat = { size: 42, isFile: true, uid: 1000 }
    mockTauriStat.mockResolvedValue(fakeStat)
    const { scopedStat: ss } = await import('../scoped-fs')

    const result = await ss('/home/user/file.txt')

    expect(result).toEqual(fakeStat)
  })
})

describe('scopedReadDir', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('calls tauriReadDir with BaseDirectory.Home for home-relative paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    mockTauriReadDir.mockResolvedValue([])
    const { scopedReadDir: srd } = await import('../scoped-fs')

    await srd('/home/user/.config/nvim')

    expect(mockTauriReadDir).toHaveBeenCalledWith('.config/nvim', {
      baseDir: BaseDirectory.Home,
    })
  })

  it('calls tauriReadDir with absolute path for non-home paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    mockTauriReadDir.mockResolvedValue([])
    const { scopedReadDir: srd } = await import('../scoped-fs')

    await srd('/mnt/external/dir')

    expect(mockTauriReadDir).toHaveBeenCalledWith('/mnt/external/dir', {})
  })
})

describe('scopedRemove', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockTauriRemove.mockResolvedValue(undefined)
  })

  it('calls tauriRemove with BaseDirectory.Home for home-relative paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedRemove: sr } = await import('../scoped-fs')

    await sr('/home/user/.config/nvim/init.lua')

    expect(mockTauriRemove).toHaveBeenCalledWith('.config/nvim/init.lua', {
      recursive: true,
      baseDir: BaseDirectory.Home,
    })
  })

  it('respects recursive=false', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedRemove: sr } = await import('../scoped-fs')

    await sr('/home/user/file.txt', false)

    expect(mockTauriRemove).toHaveBeenCalledWith('file.txt', {
      recursive: false,
      baseDir: BaseDirectory.Home,
    })
  })

  it('calls tauriRemove with absolute path for non-home paths', async () => {
    mockHomeDir.mockResolvedValue('/home/user')
    const { scopedRemove: sr } = await import('../scoped-fs')

    await sr('/tmp/backup.bak')

    expect(mockTauriRemove).toHaveBeenCalledWith('/tmp/backup.bak', {
      recursive: true,
    })
  })
})
