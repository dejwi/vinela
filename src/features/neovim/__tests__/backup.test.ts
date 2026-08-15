// src/features/neovim/__tests__/backup.test.ts
//
// Tests for the backup module: createBackup, listBackups, restoreBackup,
// deleteBackup, and enforceRetention.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GENERATED_CONFIG_MARKER, MAX_BACKUPS } from '../types'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockIsMemoryMode = vi.fn()
vi.mock('@/shared/lib/storage', () => ({
  isMemoryMode: () => mockIsMemoryMode(),
}))

const mockPathExistsDirect = vi.fn()
const mockReadTextFileDirect = vi.fn()
const mockWriteTextFileDirect = vi.fn()
const mockMkdirDirect = vi.fn()
const mockReadDirDirect = vi.fn()
const mockStatDirect = vi.fn()
const mockRemoveDirect = vi.fn()
vi.mock('@/shared/lib/direct-fs', () => ({
  pathExistsDirect: (...args: unknown[]) => mockPathExistsDirect(...args),
  readTextFileDirect: (...args: unknown[]) => mockReadTextFileDirect(...args),
  writeTextFileDirect: (...args: unknown[]) => mockWriteTextFileDirect(...args),
  mkdirDirect: (...args: unknown[]) => mockMkdirDirect(...args),
  readDirDirect: (...args: unknown[]) => mockReadDirDirect(...args),
  statDirect: (...args: unknown[]) => mockStatDirect(...args),
  removeDirect: (...args: unknown[]) => mockRemoveDirect(...args),
  openPathDirect: vi.fn(),
}))

// getBackupFolderPath is a pure string function — use the real implementation
vi.mock('@/shared/lib/settings', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/shared/lib/settings')>()
  return {
    ...real,
    getBackupFolderPath: real.getBackupFolderPath,
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIG_PATH = '/home/user/.config/nvim/init.lua'
const NVIM_VERSION = '0.10.2'

/** Build the JSON that readTextFileDirect returns for a meta file. */
function makeMetaJson(createdAt: string): string {
  return JSON.stringify({
    sourcePath: CONFIG_PATH,
    createdAt,
    neovimVersion: NVIM_VERSION,
    sizeBytes: 42,
  })
}

// ── createBackup ─────────────────────────────────────────────────────────────

describe('createBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
    mockWriteTextFileDirect.mockResolvedValue(42)
    mockMkdirDirect.mockResolvedValue(undefined)
    mockStatDirect.mockResolvedValue({ size: 42, is_file: true, is_dir: false })
    // Backup folder check (exists), gitignore check (exists) — stop ensureBackupFolder writes
    mockPathExistsDirect.mockResolvedValue(true)
    // readDir returns empty list → no retention needed
    mockReadDirDirect.mockResolvedValue([])
  })

  it('returns memory-mode skip when in memory mode', async () => {
    mockIsMemoryMode.mockReturnValue(true)
    const { createBackup } = await import('../backup')
    const result = await createBackup(CONFIG_PATH, NVIM_VERSION)
    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: 'memory-mode',
    })
  })

  it('returns no-existing-config skip when config does not exist', async () => {
    mockPathExistsDirect.mockResolvedValueOnce(false) // config does not exist
    const { createBackup } = await import('../backup')
    const result = await createBackup(CONFIG_PATH, NVIM_VERSION)
    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: 'no-existing-config',
    })
  })

  it('returns our-config skip when config has generated marker', async () => {
    mockPathExistsDirect.mockResolvedValue(true) // config exists
    mockReadTextFileDirect.mockResolvedValue(
      `${GENERATED_CONFIG_MARKER}\n-- some lua`,
    )
    const { createBackup } = await import('../backup')
    const result = await createBackup(CONFIG_PATH, NVIM_VERSION)
    expect(result).toEqual({
      success: true,
      skipped: true,
      reason: 'our-config',
    })
  })

  it('does NOT skip when force=true even if config has our marker', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadTextFileDirect.mockResolvedValue(
      `${GENERATED_CONFIG_MARKER}\n-- generated`,
    )
    const { createBackup } = await import('../backup')
    const result = await createBackup(
      CONFIG_PATH,
      NVIM_VERSION,
      true /* force */,
    )
    // Should create a backup, not skip
    expect(result.success).toBe(true)
    if (result.success && 'backup' in result) {
      expect(result.backup.sourcePath).toBe(CONFIG_PATH)
      expect(result.backup.neovimVersion).toBe(NVIM_VERSION)
    } else {
      // Would have skipped — fail the test
      expect('backup' in result).toBe(true)
    }
  })

  it('creates backup files for existing user config', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadTextFileDirect.mockResolvedValue('-- user config')
    const { createBackup } = await import('../backup')
    const result = await createBackup(CONFIG_PATH, NVIM_VERSION)
    expect(result.success).toBe(true)
    if (result.success && 'backup' in result) {
      expect(result.backup.sourcePath).toBe(CONFIG_PATH)
      expect(result.backup.sizeBytes).toBe(42)
    }
    // Two writes: backup file + meta file
    expect(mockWriteTextFileDirect).toHaveBeenCalledTimes(2)
  })

  it('returns failure when readTextFileDirect throws', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadTextFileDirect.mockRejectedValue(new Error('permission denied'))
    const { createBackup } = await import('../backup')
    const result = await createBackup(CONFIG_PATH, NVIM_VERSION)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('permission denied')
    }
  })

  it('returns failure when writeTextFileDirect throws on backup file', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadTextFileDirect.mockResolvedValue('-- user config')
    mockWriteTextFileDirect.mockRejectedValue(new Error('disk full'))
    const { createBackup } = await import('../backup')
    const result = await createBackup(CONFIG_PATH, NVIM_VERSION)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('disk full')
    }
  })
})

// ── listBackups ───────────────────────────────────────────────────────────────

describe('listBackups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
  })

  it('returns empty list when in memory mode', async () => {
    mockIsMemoryMode.mockReturnValue(true)
    const { listBackups } = await import('../backup')
    const result = await listBackups(CONFIG_PATH)
    expect(result).toEqual({ success: true, backups: [] })
  })

  it('returns empty list when backup folder does not exist', async () => {
    mockPathExistsDirect.mockResolvedValue(false)
    const { listBackups } = await import('../backup')
    const result = await listBackups(CONFIG_PATH)
    expect(result).toEqual({ success: true, backups: [] })
  })

  it('lists backups sorted newest first', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    const olderDate = '2026-01-01T00:00:00.000Z'
    const newerDate = '2026-03-01T00:00:00.000Z'

    const olderTs = '2026-01-01T00-00-00-000Z'
    const newerTs = '2026-03-01T00-00-00-000Z'

    mockReadDirDirect.mockResolvedValue([
      { name: `init.lua.${olderTs}.bak`, is_file: true, is_dir: false },
      { name: `init.lua.${newerTs}.bak`, is_file: true, is_dir: false },
    ])
    mockReadTextFileDirect.mockImplementation((path: string) => {
      if (path.includes(newerTs))
        return Promise.resolve(makeMetaJson(newerDate))
      if (path.includes(olderTs))
        return Promise.resolve(makeMetaJson(olderDate))
      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })

    const { listBackups } = await import('../backup')
    const result = await listBackups(CONFIG_PATH)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.backups).toHaveLength(2)
      // Newest should be first
      expect(result.backups[0]?.id).toBe(newerTs)
      expect(result.backups[1]?.id).toBe(olderTs)
    }
  })

  it('skips entries with missing/corrupted metadata and continues listing', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    const goodTs = '2026-03-01T00-00-00-000Z'
    const badTs = '2026-02-01T00-00-00-000Z'

    mockReadDirDirect.mockResolvedValue([
      { name: `init.lua.${goodTs}.bak`, is_file: true, is_dir: false },
      { name: `init.lua.${badTs}.bak`, is_file: true, is_dir: false },
    ])
    mockReadTextFileDirect.mockImplementation((path: string) => {
      if (path.includes(goodTs))
        return Promise.resolve(makeMetaJson('2026-03-01T00:00:00.000Z'))
      // Corrupted: not valid JSON
      if (path.includes(`${badTs}.meta.json`))
        return Promise.resolve('NOT VALID JSON {{{{')
      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })

    const { listBackups } = await import('../backup')
    const result = await listBackups(CONFIG_PATH)

    expect(result.success).toBe(true)
    if (result.success) {
      // Only the good backup should appear
      expect(result.backups).toHaveLength(1)
      expect(result.backups[0]?.id).toBe(goodTs)
    }
  })

  it('skips non-.bak entries in the backup folder', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadDirDirect.mockResolvedValue([
      { name: '.gitignore', is_file: true, is_dir: false },
      { name: 'README.md', is_file: true, is_dir: false },
    ])

    const { listBackups } = await import('../backup')
    const result = await listBackups(CONFIG_PATH)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.backups).toHaveLength(0)
    }
  })

  it('returns failure when readDirDirect throws', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadDirDirect.mockRejectedValue(new Error('permission denied'))

    const { listBackups } = await import('../backup')
    const result = await listBackups(CONFIG_PATH)

    expect(result.success).toBe(false)
  })
})

// ── restoreBackup ─────────────────────────────────────────────────────────────

describe('restoreBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
  })

  it('returns error when in memory mode', async () => {
    mockIsMemoryMode.mockReturnValue(true)
    const { restoreBackup } = await import('../backup')
    const result = await restoreBackup('some-id', CONFIG_PATH, NVIM_VERSION)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('browser mode')
    }
  })

  it('returns error when backup ID is not found', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadDirDirect.mockResolvedValue([]) // no backups
    const { restoreBackup } = await import('../backup')
    const result = await restoreBackup(
      'nonexistent-id',
      CONFIG_PATH,
      NVIM_VERSION,
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Backup not found')
    }
  })

  it('aborts restore when safety backup fails', async () => {
    const backupId = '2026-03-01T00-00-00-000Z'
    const createdAt = '2026-03-01T00:00:00.000Z'

    // listBackups: folder exists, one backup
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadDirDirect.mockResolvedValue([
      { name: `init.lua.${backupId}.bak`, is_file: true, is_dir: false },
    ])
    mockReadTextFileDirect.mockImplementation((path: string) => {
      if (path.endsWith('.meta.json'))
        return Promise.resolve(makeMetaJson(createdAt))
      // Safety backup: createBackup tries to read config content
      return Promise.reject(new Error('disk full'))
    })
    mockStatDirect.mockResolvedValue({ size: 42, is_file: true, is_dir: false })

    const { restoreBackup } = await import('../backup')
    const result = await restoreBackup(backupId, CONFIG_PATH, NVIM_VERSION)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('safety backup')
    }
    // writeTextFileDirect should NOT have been called (no restore written)
    expect(mockWriteTextFileDirect).not.toHaveBeenCalled()
  })

  it('restores successfully when safety backup succeeds', async () => {
    const backupId = '2026-03-01T00-00-00-000Z'
    const createdAt = '2026-03-01T00:00:00.000Z'

    // First pathExistsDirect call (listBackups folder check): folder exists
    // Subsequent calls inside createBackup (ensureBackupFolder gitignore check): true
    mockPathExistsDirect.mockResolvedValue(true)
    mockReadDirDirect.mockResolvedValue([
      { name: `init.lua.${backupId}.bak`, is_file: true, is_dir: false },
    ])

    let readCallCount = 0
    mockReadTextFileDirect.mockImplementation((path: string) => {
      if (path.endsWith('.meta.json'))
        return Promise.resolve(makeMetaJson(createdAt))

      readCallCount++
      // First content read: safety backup reads existing config (not our marker)
      if (readCallCount === 1) return Promise.resolve('-- user config')
      // Second content read: restore reads the backup file
      return Promise.resolve('-- restored content')
    })
    mockStatDirect.mockResolvedValue({ size: 42, is_file: true, is_dir: false })
    mockMkdirDirect.mockResolvedValue(undefined)
    mockWriteTextFileDirect.mockResolvedValue(42)

    const { restoreBackup } = await import('../backup')
    const result = await restoreBackup(backupId, CONFIG_PATH, NVIM_VERSION)

    expect(result.success).toBe(true)
    // The last writeTextFileDirect call should write the restored content to configPath
    const writeCalls = mockWriteTextFileDirect.mock.calls
    const restoreWrite = writeCalls.find(
      (call) => call[0] === CONFIG_PATH && call[1] === '-- restored content',
    )
    expect(restoreWrite).toBeDefined()
  })
})

// ── enforceRetention ──────────────────────────────────────────────────────────

describe('enforceRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockIsMemoryMode.mockReturnValue(false)
  })

  it('returns immediately when in memory mode', async () => {
    mockIsMemoryMode.mockReturnValue(true)
    const { enforceRetention } = await import('../backup')
    await enforceRetention(CONFIG_PATH)
    expect(mockReadDirDirect).not.toHaveBeenCalled()
  })

  it('does nothing when backup count is within limit', async () => {
    mockPathExistsDirect.mockResolvedValue(true)
    // 3 backups, limit is MAX_BACKUPS (5)
    const timestamps = [
      '2026-03-01T00-00-00-000Z',
      '2026-02-01T00-00-00-000Z',
      '2026-01-01T00-00-00-000Z',
    ]
    mockReadDirDirect.mockResolvedValue(
      timestamps.map((ts) => ({
        name: `init.lua.${ts}.bak`,
        is_file: true,
        is_dir: false,
      })),
    )
    mockReadTextFileDirect.mockImplementation((path: string) => {
      const ts = timestamps.find((t) => path.includes(t))
      if (ts)
        return Promise.resolve(
          makeMetaJson(`${ts.replace(/-/g, ':').slice(0, -1)}Z`),
        )
      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })

    const { enforceRetention } = await import('../backup')
    await enforceRetention(CONFIG_PATH, MAX_BACKUPS)

    expect(mockRemoveDirect).not.toHaveBeenCalled()
  })

  it('deletes oldest backups when over the limit', async () => {
    mockPathExistsDirect.mockResolvedValue(true)

    // 6 backups (limit 5) — timestamps are ISO-like but with hyphens
    const timestamps = [
      { ts: '2026-06-01T00-00-00-000Z', iso: '2026-06-01T00:00:00.000Z' },
      { ts: '2026-05-01T00-00-00-000Z', iso: '2026-05-01T00:00:00.000Z' },
      { ts: '2026-04-01T00-00-00-000Z', iso: '2026-04-01T00:00:00.000Z' },
      { ts: '2026-03-01T00-00-00-000Z', iso: '2026-03-01T00:00:00.000Z' },
      { ts: '2026-02-01T00-00-00-000Z', iso: '2026-02-01T00:00:00.000Z' },
      { ts: '2026-01-01T00-00-00-000Z', iso: '2026-01-01T00:00:00.000Z' }, // oldest — should be deleted
    ]

    mockReadDirDirect.mockResolvedValue(
      timestamps.map(({ ts }) => ({
        name: `init.lua.${ts}.bak`,
        is_file: true,
        is_dir: false,
      })),
    )
    mockReadTextFileDirect.mockImplementation((path: string) => {
      const entry = timestamps.find((t) => path.includes(t.ts))
      if (entry) return Promise.resolve(makeMetaJson(entry.iso))
      return Promise.reject(new Error(`Unexpected path: ${path}`))
    })
    mockRemoveDirect.mockResolvedValue(undefined)

    const { enforceRetention } = await import('../backup')
    await enforceRetention(CONFIG_PATH, MAX_BACKUPS)

    // Should delete 1 backup (6 - 5 = 1), which is the oldest
    const removedPaths = mockRemoveDirect.mock.calls.map((c) => c[0] as string)
    const oldestTs = timestamps[5]?.ts
    expect(removedPaths.some((p) => p.includes(oldestTs ?? ''))).toBe(true)
  })
})
