// src/shared/lib/scope.ts
//
// Runtime filesystem scope extension via Tauri commands.
// Used to grant access to the Neovim output directory, which static
// capabilities can't reliably cover (dotfile directories like
// ~/.config/nvim fail Tauri's glob matching on macOS/Linux).

import { invoke } from '@tauri-apps/api/core'
import { isMemoryMode } from '@/shared/lib/storage'

/**
 * Extend the Tauri filesystem scope to allow access to the Neovim
 * output directory.
 *
 * This calls a Rust command that uses `fs_scope().allow_directory()`
 * to add the path to the runtime allow-list. The Rust side validates
 * that the path is under $HOME before granting access.
 *
 * Must be called BEFORE any filesystem operations (mkdir, write, read)
 * on the output directory or its contents.
 *
 * Safe to call multiple times with the same path (idempotent).
 * No-op in memory mode or outside Tauri runtime.
 *
 * @param absolutePath - The absolute path to the directory to allow
 *   (e.g., "/Users/example/.config/nvim")
 * @returns true if scope was extended, false if skipped (memory mode / no Tauri)
 * @throws never — errors are logged and swallowed; callers should handle
 *   downstream filesystem failures as the authoritative failure signal
 */
export async function allowOutputDirectory(
  absolutePath: string,
): Promise<boolean> {
  if (isMemoryMode()) {
    return false
  }

  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return false
  }

  try {
    await invoke('allow_output_directory', { path: absolutePath })
    return true
  } catch (error) {
    console.error(
      `[scope] Failed to allow output directory: ${absolutePath}`,
      error instanceof Error ? error.message : error,
    )
    return false
  }
}
