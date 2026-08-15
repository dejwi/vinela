// src/shared/lib/path-utils.ts
//
// Shared path utilities used across deploy, detection, and other features.
//
// Centralises path expansion and parent-directory extraction so bug fixes
// only need to land in one place.

import { homeDir } from '@tauri-apps/api/path'

// ── Path Expansion ───────────────────────────────────────────────

/**
 * Expand ~ and %LOCALAPPDATA% in paths to absolute paths.
 *
 * Resolution:
 * - `~/...`          → `$HOME/...` (Unix/macOS)
 * - `%LOCALAPPDATA%` → `$HOME/AppData/Local` (Windows)
 * - Already absolute paths are returned unchanged.
 */
export async function expandPath(path: string): Promise<string> {
  const home = await homeDir()
  // Strip trailing path separator from home to avoid double-separator in output.
  // Handles both Unix '/' and Windows '\' trailing separators.
  const normalizedHome =
    home.endsWith('/') || home.endsWith('\\') ? home.slice(0, -1) : home

  // Expand ~ on Unix/macOS
  if (path.startsWith('~/')) {
    return `${normalizedHome}${path.slice(1)}`
  }

  // Expand %LOCALAPPDATA% on Windows
  // homeDir() on Windows returns C:\Users\name; LocalAppData sits one level deeper.
  if (path.includes('%LOCALAPPDATA%')) {
    const localAppData = `${normalizedHome}/AppData/Local`
    return path.replace('%LOCALAPPDATA%', localAppData)
  }

  return path
}

// ── Parent Directory ─────────────────────────────────────────────

/**
 * Extract the parent directory from a file path.
 *
 * Handles both Unix (`/`) and Windows (`\`) path separators.
 * Returns `null` if no separator is found (e.g. bare filename or root-only path).
 */
export function getParentDir(filePath: string): string | null {
  const lastSlash = filePath.lastIndexOf('/')
  const lastBackslash = filePath.lastIndexOf('\\')
  const separatorIndex = Math.max(lastSlash, lastBackslash)

  if (separatorIndex <= 0) {
    return null
  }

  return filePath.substring(0, separatorIndex)
}
