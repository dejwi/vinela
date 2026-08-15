// src/features/lua-generator/deploy/path-resolution.ts

import { pathExistsDirect } from '@/shared/lib/direct-fs'
import { expandPath, getParentDir } from '@/shared/lib/path-utils'
import { getEffectiveOutputPath, loadAppSettings } from '@/shared/lib/settings'
import { isMemoryMode } from '@/shared/lib/storage'

// Re-export for consumers that already import from this module.
export { expandPath, getParentDir } from '@/shared/lib/path-utils'

// ── Path Resolution ──────────────────────────────────────────────

export type ResolvedOutputPath =
  | { resolved: true; outputPath: string; parentDir: string }
  | { resolved: false; error: string }

/**
 * Resolve the effective Neovim output path.
 *
 * Resolution chain:
 * 1. AppSettings.neovimOutputPath (user-configured custom path)
 * 2. Platform default (~/.config/nvim/init.lua or %LOCALAPPDATA%\nvim\init.lua)
 * 3. Expand ~ and %LOCALAPPDATA% to absolute paths
 *
 * Returns the expanded absolute path and its parent directory.
 */
export async function resolveOutputPath(): Promise<ResolvedOutputPath> {
  if (isMemoryMode()) {
    return { resolved: false, error: 'Deploy is not available in browser mode' }
  }

  try {
    const settings = await loadAppSettings()
    const rawPath = getEffectiveOutputPath(settings)

    const expandedPath = await expandPath(rawPath)

    // Derive parent directory
    const parentDir = getParentDir(expandedPath)

    if (parentDir === null) {
      return {
        resolved: false,
        error: `Invalid output path: ${expandedPath}`,
      }
    }

    return { resolved: true, outputPath: expandedPath, parentDir }
  } catch (error) {
    console.error('[path-resolution] resolveOutputPath threw:', error)
    return {
      resolved: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to resolve output path',
    }
  }
}

// ── Existence Check ──────────────────────────────────────────────

/**
 * Check if a path exists via Rust std::fs, bypassing plugin-fs scope.
 * Avoids the hang issue with plugin-fs exists() on non-existent paths,
 * and sidesteps scope mismatch errors on symlinked dotfile paths.
 *
 * Same pattern as backup.ts::safePathExists().
 */
export async function safePathExists(path: string): Promise<boolean> {
  try {
    return await pathExistsDirect(path)
  } catch {
    return false
  }
}
