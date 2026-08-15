// src/shared/lib/__tests__/path-utils.test.ts
//
// Tests for shared path utilities: expandPath and getParentDir.

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock @tauri-apps/api/path ────────────────────────────────────────────────

const mockHomeDir = vi.fn()
vi.mock('@tauri-apps/api/path', () => ({
  homeDir: () => mockHomeDir(),
}))

// ── getParentDir (sync — import statically) ───────────────────────────────────

import { getParentDir } from '../path-utils'

describe('getParentDir', () => {
  it('returns parent for a standard Unix path', () => {
    expect(getParentDir('/home/user/.config/nvim/init.lua')).toBe(
      '/home/user/.config/nvim',
    )
  })

  it('returns parent for a Windows path with backslashes', () => {
    expect(
      getParentDir('C:\\Users\\name\\AppData\\Local\\nvim\\init.lua'),
    ).toBe('C:\\Users\\name\\AppData\\Local\\nvim')
  })

  it('returns null for a bare filename with no separator', () => {
    expect(getParentDir('init.lua')).toBeNull()
  })

  it('returns null when only a root slash precedes the filename', () => {
    // lastIndexOf('/') == 0, which is <= 0, so null
    expect(getParentDir('/init.lua')).toBeNull()
  })

  it('handles paths with spaces', () => {
    expect(getParentDir('/home/user name/.config/nvim/init.lua')).toBe(
      '/home/user name/.config/nvim',
    )
  })

  it('returns correct parent for deeply nested path', () => {
    expect(getParentDir('/a/b/c/d/e/f/init.lua')).toBe('/a/b/c/d/e/f')
  })

  it('handles a path ending with a separator by returning everything before it', () => {
    // Trailing slash: lastIndexOf('/') is the last char; the "parent" is the portion before
    expect(getParentDir('/home/user/config/')).toBe('/home/user/config')
  })

  it('picks the last separator when both slashes and backslashes appear', () => {
    // Last char before filename is a forward slash
    const result = getParentDir('/home/user/config\\nvim/init.lua')
    expect(result).toBe('/home/user/config\\nvim')
  })
})

// ── expandPath (async — dynamic import to reset module between tests) ─────────

describe('expandPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockHomeDir.mockResolvedValue('/home/user')
  })

  it('expands tilde to home directory on Unix paths', async () => {
    const { expandPath } = await import('../path-utils')
    const result = await expandPath('~/.config/nvim/init.lua')
    expect(result).toBe('/home/user/.config/nvim/init.lua')
  })

  it('expands tilde to home directory — no double slash when homeDir has trailing slash', async () => {
    mockHomeDir.mockResolvedValue('/home/user/')
    const { expandPath } = await import('../path-utils')
    const result = await expandPath('~/.config/nvim/init.lua')
    expect(result).not.toContain('//')
    expect(result).toBe('/home/user/.config/nvim/init.lua')
  })

  it('expands %LOCALAPPDATA% to Windows local app data path', async () => {
    mockHomeDir.mockResolvedValue('C:\\Users\\Alice')
    const { expandPath } = await import('../path-utils')
    const result = await expandPath('%LOCALAPPDATA%\\nvim\\init.lua')
    expect(result).not.toContain('%LOCALAPPDATA%')
    expect(result).toContain('AppData/Local')
    // The implementation joins with '/' (consistent cross-platform separator)
    expect(result).toBe('C:\\Users\\Alice/AppData/Local\\nvim\\init.lua')
  })

  it('returns already-absolute Unix path unchanged', async () => {
    const { expandPath } = await import('../path-utils')
    const path = '/usr/local/bin/nvim'
    expect(await expandPath(path)).toBe(path)
  })

  it('returns already-absolute Windows path unchanged', async () => {
    const { expandPath } = await import('../path-utils')
    const path = 'C:\\Users\\Alice\\config\\init.lua'
    expect(await expandPath(path)).toBe(path)
  })

  it('does not expand a bare tilde without following slash', async () => {
    // "~" alone doesn't match "~/..." so it passes through
    const { expandPath } = await import('../path-utils')
    expect(await expandPath('~')).toBe('~')
  })

  it('returns empty string unchanged', async () => {
    const { expandPath } = await import('../path-utils')
    expect(await expandPath('')).toBe('')
  })

  it('expands %LOCALAPPDATA% when homeDir has trailing backslash', async () => {
    mockHomeDir.mockResolvedValue('C:\\Users\\Alice\\')
    const { expandPath } = await import('../path-utils')
    // normalizedHome strips trailing '\' → 'C:\\Users\\Alice'
    const result = await expandPath('%LOCALAPPDATA%\\nvim\\init.lua')
    expect(result).not.toContain('%LOCALAPPDATA%')
    expect(result).toContain('AppData/Local')
    expect(result).toBe('C:\\Users\\Alice/AppData/Local\\nvim\\init.lua')
  })
})
