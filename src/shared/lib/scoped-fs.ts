// src/shared/lib/scoped-fs.ts
//
// Thin wrappers around Tauri plugin-fs that resolve absolute paths
// to BaseDirectory-scoped relative paths. Required for Tauri's
// capability system to allow the operations.
//
// The $HOME/** glob in capabilities/default.json only applies when the
// call uses BaseDirectory.Home with a relative path. Passing an absolute
// path like /Users/example/.config/nvim doesn't match any scope, so Tauri
// rejects it. These helpers normalise that transparently.

import { homeDir } from '@tauri-apps/api/path'
import {
  BaseDirectory,
  mkdir as tauriMkdir,
  readDir as tauriReadDir,
  readTextFile as tauriReadTextFile,
  remove as tauriRemove,
  stat as tauriStat,
  writeTextFile as tauriWriteTextFile,
} from '@tauri-apps/plugin-fs'

// ── Home path cache ───────────────────────────────────────────────

/** Cached home directory path to avoid repeated IPC calls. */
let cachedHome: string | null = null

async function getHome(): Promise<string> {
  if (cachedHome === null) {
    cachedHome = await homeDir()
  }
  return cachedHome
}

// ── Scope resolution ──────────────────────────────────────────────

/**
 * Resolve an absolute path to a BaseDirectory-scoped path suitable
 * for Tauri plugin-fs calls.
 *
 * - Paths inside `$HOME` → `{ path: relative, baseDir: BaseDirectory.Home }`
 * - Paths outside `$HOME` → `{ path: absolute, baseDir: undefined }`
 *   (callers that obtained the path from a Tauri dialog have temporary
 *    scope access, so absolute paths from dialogs still work.)
 */
export async function resolveScope(absolutePath: string): Promise<{
  path: string
  baseDir: BaseDirectory | undefined
}> {
  const home = await getHome()
  // Normalise: ensure the home prefix ends with a slash for prefix matching.
  const normalizedHome = home.endsWith('/') ? home : `${home}/`

  if (absolutePath.startsWith(normalizedHome)) {
    return {
      path: absolutePath.slice(normalizedHome.length),
      baseDir: BaseDirectory.Home,
    }
  }

  // Exact match: path IS the home directory itself.
  if (absolutePath === home || absolutePath === normalizedHome.slice(0, -1)) {
    return { path: '', baseDir: BaseDirectory.Home }
  }

  // Outside $HOME — fall through with the absolute path unchanged.
  return { path: absolutePath, baseDir: undefined }
}

// ── Scoped wrappers ───────────────────────────────────────────────

/**
 * Create a directory with proper Tauri scope resolution.
 * Equivalent to `mkdir(absolutePath, { recursive })` but scoped.
 */
export async function scopedMkdir(
  absolutePath: string,
  recursive = true,
): Promise<void> {
  const { path, baseDir } = await resolveScope(absolutePath)
  try {
    await tauriMkdir(path, {
      recursive,
      ...(baseDir !== undefined ? { baseDir } : {}),
    })
  } catch (err) {
    console.error(`[scoped-fs] scopedMkdir failed for "${absolutePath}":`, err)
    throw err
  }
}

/**
 * Write a text file with proper Tauri scope resolution.
 * Equivalent to `writeTextFile(absolutePath, content)` but scoped.
 */
export async function scopedWriteTextFile(
  absolutePath: string,
  content: string,
): Promise<void> {
  const { path, baseDir } = await resolveScope(absolutePath)
  try {
    await tauriWriteTextFile(path, content, {
      ...(baseDir !== undefined ? { baseDir } : {}),
    })
  } catch (err) {
    console.error(
      `[scoped-fs] scopedWriteTextFile failed for "${absolutePath}":`,
      err,
    )
    throw err
  }
}

/**
 * Read a text file with proper Tauri scope resolution.
 * Equivalent to `readTextFile(absolutePath)` but scoped.
 */
export async function scopedReadTextFile(
  absolutePath: string,
): Promise<string> {
  const { path, baseDir } = await resolveScope(absolutePath)
  return tauriReadTextFile(path, {
    ...(baseDir !== undefined ? { baseDir } : {}),
  })
}

/**
 * Stat a path with proper Tauri scope resolution.
 * Equivalent to `stat(absolutePath)` but scoped.
 */
export async function scopedStat(absolutePath: string) {
  const { path, baseDir } = await resolveScope(absolutePath)
  try {
    return await tauriStat(path, {
      ...(baseDir !== undefined ? { baseDir } : {}),
    })
  } catch (err) {
    console.error(`[scoped-fs] scopedStat failed for "${absolutePath}":`, err)
    throw err
  }
}

/**
 * Read a directory with proper Tauri scope resolution.
 * Equivalent to `readDir(absolutePath)` but scoped.
 */
export async function scopedReadDir(absolutePath: string) {
  const { path, baseDir } = await resolveScope(absolutePath)
  return tauriReadDir(path, {
    ...(baseDir !== undefined ? { baseDir } : {}),
  })
}

/**
 * Remove a file or directory with proper Tauri scope resolution.
 * Equivalent to `remove(absolutePath, { recursive })` but scoped.
 */
export async function scopedRemove(
  absolutePath: string,
  recursive = true,
): Promise<void> {
  const { path, baseDir } = await resolveScope(absolutePath)
  await tauriRemove(path, {
    recursive,
    ...(baseDir !== undefined ? { baseDir } : {}),
  })
}
