// src/features/neovim/__tests__/detection.test.ts
//
// Tests for the detection module: detectNeovim and checkExistingConfig
// error classification (missing vs permission-denied vs scope failure).

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockIsMemoryMode = vi.fn()
vi.mock('@/shared/lib/storage', () => ({
  isMemoryMode: () => mockIsMemoryMode(),
}))

const mockPathExistsDirect = vi.fn()
const mockReadTextFileDirect = vi.fn()
vi.mock('@/shared/lib/direct-fs', () => ({
  pathExistsDirect: (...args: unknown[]) => mockPathExistsDirect(...args),
  readTextFileDirect: (...args: unknown[]) => mockReadTextFileDirect(...args),
}))

const mockExpandPath = vi.fn()
vi.mock('@/shared/lib/path-utils', () => ({
  expandPath: (...args: unknown[]) => mockExpandPath(...args),
}))

const mockLoadAppSettings = vi.fn()
const mockGetDefaultNeovimOutputPath = vi.fn()
vi.mock('@/shared/lib/settings', () => ({
  loadAppSettings: () => mockLoadAppSettings(),
  getDefaultNeovimOutputPath: () => mockGetDefaultNeovimOutputPath(),
}))

// Shell commands (nvim --version, which nvim)
const mockCommandExecute = vi.fn()
const mockCommandCreate = vi.fn()
vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: {
    create: (...args: unknown[]) => {
      mockCommandCreate(...args)
      return { execute: () => mockCommandExecute(...args) }
    },
  },
}))

vi.mock('@tauri-apps/plugin-os', () => ({
  platform: () => 'linux',
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIG_PATH = '/home/user/.config/nvim/init.lua'
const NVIM_VERSION_STDOUT = 'NVIM v0.10.2\nRun "nvim -h" for help'

function makeSuccessfulVersionExec() {
  return { code: 0, stdout: NVIM_VERSION_STDOUT, stderr: '' }
}

// ── Memory mode ───────────────────────────────────────────────────────────────

describe('detectNeovim — memory mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(true)
  })

  it('returns memory-mode error without running any commands', async () => {
    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()
    expect(result.found).toBe(false)
    if (!result.found) {
      expect(result.errorCode).toBe('memory-mode')
    }
    expect(mockCommandCreate).not.toHaveBeenCalled()
  })
})

// ── nvim not in PATH ──────────────────────────────────────────────────────────

describe('detectNeovim — nvim not in PATH', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
  })

  it('returns not-in-path when nvim --version exits with non-zero', async () => {
    mockCommandExecute.mockResolvedValue({
      code: 1,
      stdout: '',
      stderr: 'not found',
    })
    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()
    expect(result.found).toBe(false)
    if (!result.found) {
      expect(result.errorCode).toBe('not-in-path')
    }
  })

  it('returns not-in-path when Command.create throws', async () => {
    mockCommandExecute.mockRejectedValue(new Error('spawn failed'))
    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()
    expect(result.found).toBe(false)
    if (!result.found) {
      expect(result.errorCode).toBe('not-in-path')
    }
  })
})

// ── Version parse failure ─────────────────────────────────────────────────────

describe('detectNeovim — version parse failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
  })

  it('returns parse-failed when output does not match expected format', async () => {
    mockCommandExecute.mockResolvedValue({
      code: 0,
      stdout: 'something unexpected\n',
      stderr: '',
    })
    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()
    expect(result.found).toBe(false)
    if (!result.found) {
      expect(result.errorCode).toBe('parse-failed')
    }
  })
})

// ── Successful detection ──────────────────────────────────────────────────────

describe('detectNeovim — successful detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      neovimOutputPath: undefined,
    })
    mockGetDefaultNeovimOutputPath.mockReturnValue('~/.config/nvim/init.lua')
    mockExpandPath.mockImplementation((p: string) =>
      Promise.resolve(p.replace('~', '/home/user')),
    )
  })

  it('returns found=true with version and configPath when all steps succeed', async () => {
    // First call: nvim --version succeeds; second: which nvim succeeds
    mockCommandExecute
      .mockResolvedValueOnce(makeSuccessfulVersionExec())
      .mockResolvedValueOnce({ code: 0, stdout: '/usr/bin/nvim\n', stderr: '' })

    mockPathExistsDirect.mockResolvedValue(false) // no existing config

    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.version).toBe('0.10.2')
      expect(result.versionDisplay).toBe('NVIM v0.10.2')
      expect(result.configPath).toBe(CONFIG_PATH)
      expect(result.hasExistingConfig).toBe(false)
      expect(result.isOurConfig).toBe(false)
    }
  })

  it('sets hasExistingConfig=true and isOurConfig=false for a user config', async () => {
    mockCommandExecute
      .mockResolvedValueOnce(makeSuccessfulVersionExec())
      .mockResolvedValueOnce({ code: 0, stdout: '/usr/bin/nvim\n', stderr: '' })

    mockPathExistsDirect.mockResolvedValue(true) // config exists
    mockReadTextFileDirect.mockResolvedValue('-- User config\nreturn {}')

    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.hasExistingConfig).toBe(true)
      expect(result.isOurConfig).toBe(false)
    }
  })

  it('sets isOurConfig=true when config starts with generated marker', async () => {
    mockCommandExecute
      .mockResolvedValueOnce(makeSuccessfulVersionExec())
      .mockResolvedValueOnce({ code: 0, stdout: '/usr/bin/nvim\n', stderr: '' })

    mockPathExistsDirect.mockResolvedValue(true)
    mockReadTextFileDirect.mockResolvedValue(
      '-- Generated by vinela\n-- some lua',
    )

    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.hasExistingConfig).toBe(true)
      expect(result.isOurConfig).toBe(true)
    }
  })

  it('uses configured output path from settings when set', async () => {
    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      neovimOutputPath: '~/.config/custom-nvim/init.lua',
    })
    mockExpandPath.mockImplementation((p: string) =>
      Promise.resolve(p.replace('~', '/home/user')),
    )

    mockCommandExecute
      .mockResolvedValueOnce(makeSuccessfulVersionExec())
      .mockResolvedValueOnce({ code: 0, stdout: '/usr/bin/nvim\n', stderr: '' })

    mockPathExistsDirect.mockResolvedValue(false)

    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.configPath).toBe('/home/user/.config/custom-nvim/init.lua')
    }
  })
})

// ── checkExistingConfig error classification ──────────────────────────────────
//
// We test the private behaviour indirectly through detectNeovim:
// when pathExistsDirect throws, the result should still be found=true
// (nvim itself was detected fine) but hasExistingConfig/isOurConfig reflect
// the "exists but unreadable" fallback.

describe('detectNeovim — config permission error classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      neovimOutputPath: undefined,
    })
    mockGetDefaultNeovimOutputPath.mockReturnValue('~/.config/nvim/init.lua')
    mockExpandPath.mockImplementation((p: string) =>
      Promise.resolve(p.replace('~', '/home/user')),
    )
    mockCommandExecute
      .mockResolvedValueOnce(makeSuccessfulVersionExec())
      .mockResolvedValueOnce({ code: 0, stdout: '/usr/bin/nvim\n', stderr: '' })
  })

  it('returns hasExistingConfig=false when pathExistsDirect throws (permission error)', async () => {
    // pathExistsDirect throws → checkExistingConfig returns permissionError state
    // detectNeovim still succeeds (nvim was found) but treats config as not-existing
    mockPathExistsDirect.mockRejectedValue(
      new Error('Path escapes $HOME boundary'),
    )

    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()

    expect(result.found).toBe(true)
    if (result.found) {
      // permissionError state maps to exists:false, isOurs:false
      expect(result.hasExistingConfig).toBe(false)
      expect(result.isOurConfig).toBe(false)
    }
  })

  it('returns hasExistingConfig=true isOurConfig=false when file exists but read throws', async () => {
    // pathExistsDirect succeeds → file exists
    // readTextFileDirect throws → can't determine ownership → fallback: exists=true, isOurs=false
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadTextFileDirect.mockRejectedValue(new Error('permission denied'))

    const { detectNeovim } = await import('../detection')
    const result = await detectNeovim()

    expect(result.found).toBe(true)
    if (result.found) {
      expect(result.hasExistingConfig).toBe(true)
      expect(result.isOurConfig).toBe(false)
    }
  })
})
