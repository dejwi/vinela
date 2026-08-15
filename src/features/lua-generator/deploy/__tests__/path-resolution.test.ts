import { describe, expect, it, vi } from 'vitest'
import * as pathResolutionModule from '../path-resolution'

// Mock tauri api/path (used by expandPath)
const mockHomeDir = vi.fn().mockResolvedValue('/home/user')
vi.mock('@tauri-apps/api/path', () => ({
  homeDir: () => mockHomeDir(),
}))

// Mock direct-fs (used by safePathExists)
const mockPathExistsDirect = vi.fn()
vi.mock('@/shared/lib/direct-fs', () => ({
  pathExistsDirect: (...args: unknown[]) => mockPathExistsDirect(...args),
}))

const { expandPath, getParentDir, safePathExists } = pathResolutionModule

describe('path-resolution', () => {
  describe('getParentDir', () => {
    it('returns parent for Unix path', () => {
      const result = getParentDir('/home/user/.config/nvim/init.lua')
      expect(result).toBe('/home/user/.config/nvim')
    })

    it('returns parent for Windows path', () => {
      const result = getParentDir(
        'C:\\Users\\name\\AppData\\Local\\nvim\\init.lua',
      )
      expect(result).toBe('C:\\Users\\name\\AppData\\Local\\nvim')
    })

    it('returns null for no separator', () => {
      const result = getParentDir('init.lua')
      expect(result).toBeNull()
    })

    it('returns null for root slash only', () => {
      const result = getParentDir('/init.lua')
      expect(result).toBeNull()
    })

    it('handles mixed path separators (Unix wins)', () => {
      // When both separators exist, the last one determines the split
      const result = getParentDir('/home/user/config\\nvim/init.lua')
      // Last separator is / at position 25
      expect(result).toBe('/home/user/config\\nvim')
    })

    it('handles paths with spaces', () => {
      const result = getParentDir('/home/user name/.config/nvim/init.lua')
      expect(result).toBe('/home/user name/.config/nvim')
    })

    it('returns correct parent for nested directories', () => {
      const result = getParentDir('/a/b/c/d/e/f/init.lua')
      expect(result).toBe('/a/b/c/d/e/f')
    })
  })

  describe('expandPath', () => {
    it('expands tilde on Unix-style paths', async () => {
      const result = await expandPath('~/foo/bar')
      expect(result).not.toContain('~')
      expect(result).toMatch(/\/foo\/bar$/)
    })

    it('expands %LOCALAPPDATA% on Windows', async () => {
      const result = await expandPath('%LOCALAPPDATA%\\nvim')
      expect(result).not.toContain('%LOCALAPPDATA%')
      expect(result).toContain('AppData')
    })

    it('returns absolute paths unchanged', async () => {
      const path = '/usr/bin/nvim'
      const result = await expandPath(path)
      expect(result).toBe(path)
    })

    it('handles paths with just ~ (no slash)', async () => {
      // This should not expand since it's just ~ without /
      const result = await expandPath('~')
      // ~ alone gets passed through since it's just ~ without /
      expect(result).toBe('~')
    })

    it('handles empty string', async () => {
      const result = await expandPath('')
      expect(result).toBe('')
    })

    it('does not produce double-slash when homeDir returns trailing slash', async () => {
      // Simulate a platform/Tauri version that returns home with a trailing slash
      mockHomeDir.mockResolvedValueOnce('/home/user/')
      const result = await expandPath('~/.config/nvim/init.lua')
      // Should NOT contain '//' — the trailing slash must be stripped
      expect(result).not.toContain('//')
      expect(result).toBe('/home/user/.config/nvim/init.lua')
    })
  })

  describe('safePathExists', () => {
    it('returns true when pathExistsDirect returns true', async () => {
      mockPathExistsDirect.mockResolvedValue(true)
      const result = await safePathExists('/home/user/.config/nvim/init.lua')
      expect(result).toBe(true)
      expect(mockPathExistsDirect).toHaveBeenCalledWith(
        '/home/user/.config/nvim/init.lua',
      )
    })

    it('returns false when pathExistsDirect throws', async () => {
      mockPathExistsDirect.mockRejectedValue(
        new Error('os error 2: No such file'),
      )
      const result = await safePathExists('/home/user/.config/nvim/init.lua')
      expect(result).toBe(false)
    })
  })
})
