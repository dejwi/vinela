// src/shared/lib/direct-fs.ts
//
// Direct filesystem operations via Rust std::fs.
// Bypasses Tauri's plugin-fs scope system entirely.
//
// Used for deploy and backup operations on dotfile paths (e.g. ~/.config/nvim)
// where plugin-fs scope checking fails due to symlink resolution
// mismatches between allow_directory() and is_allowed().
//
// Security: All operations validate paths are under $HOME on the Rust side.

import { invoke } from '@tauri-apps/api/core'

// ============================================================
// Return types from Rust direct-fs commands
// ============================================================

/**
 * A directory entry returned by readDirDirect().
 * Field names match the snake_case Rust struct (Tauri does not camelCase
 * struct fields in serialised responses).
 */
export interface DirectDirEntry {
  name: string
  is_file: boolean
  is_dir: boolean
}

/**
 * File/directory metadata returned by statDirect().
 */
export interface DirectStatResult {
  size: number
  is_file: boolean
  is_dir: boolean
}

// ============================================================
// Existing commands (deploy / read / existence / uid)
// ============================================================

/**
 * Deploy generated init.lua to the target path.
 * Rust resolves safe in-home directory symlinks (including dangling directory links),
 * creates missing authorized suffixes with checked single-level `create_dir`, and writes
 * only through the canonical-parent-derived ordinary file path.
 * Pre-existing output-file symlinks are rejected without following or replacing them.
 *
 * `parentDir` is a validated ancestor of `outputPath` supplied as part of the
 * command security contract; Rust derives and prepares the output file's actual
 * parent directory. It is not merely "the directory to create."
 *
 * @param parentDir - Absolute validated ancestor of `outputPath`
 * @param outputPath - Absolute path to write the init.lua file
 * @param code - The generated Lua code to write
 * @returns Number of bytes written
 * @throws Error from Rust if path is outside $HOME or write fails
 */
export async function deployToPath(
  parentDir: string,
  outputPath: string,
  code: string,
): Promise<number> {
  return invoke<number>('deploy_to_path', {
    parentDir,
    outputPath,
    code,
  })
}

/**
 * Read a text file directly via Rust std::fs.
 * Bypasses plugin-fs scope checking.
 *
 * @throws Error from Rust if path is outside $HOME or file doesn't exist
 */
export async function readTextFileDirect(path: string): Promise<string> {
  return invoke<string>('read_text_file_direct', { path })
}

/**
 * Check if a path exists directly via Rust std::fs.
 * Bypasses plugin-fs scope checking.
 *
 * @throws Error from Rust if path is outside $HOME
 */
export async function pathExistsDirect(path: string): Promise<boolean> {
  return invoke<boolean>('path_exists_direct', { path })
}

/**
 * Get the uid of a file owner, or null if not available (Windows).
 * Used for ownership verification during deploy.
 *
 * @throws Error from Rust if path is outside $HOME
 */
export async function fileUidDirect(path: string): Promise<number | null> {
  return invoke<number | null>('file_uid_direct', { path })
}

// ============================================================
// New commands (backup operations)
// ============================================================

/**
 * Write a text file directly via Rust std::fs.
 * Uses the same safe directory preparation and output-file symlink rejection as deploy:
 * writes only through the canonical-parent-derived path, never through a pre-existing
 * output-file symlink.
 *
 * @param path - Absolute path to write
 * @param content - Text content to write
 * @returns Number of bytes written
 * @throws Error from Rust if path is outside $HOME or write fails
 */
export async function writeTextFileDirect(
  path: string,
  content: string,
): Promise<number> {
  return invoke<number>('write_text_file_direct', { path, content })
}

/**
 * Create a directory directly via Rust std::fs with checked single-level creation.
 * Safe in-home directory symlinks (including dangling directory links whose normalized
 * target is under `$HOME`) are resolved and missing authorized suffixes are created
 * component-by-component.
 *
 * @throws Error from Rust if path is outside $HOME or creation fails
 */
export async function mkdirDirect(path: string): Promise<void> {
  return invoke<void>('mkdir_direct', { path })
}

/**
 * List directory entries directly via Rust std::fs.
 * Bypasses plugin-fs scope checking.
 *
 * @throws Error from Rust if path is outside $HOME or directory can't be read
 */
export async function readDirDirect(path: string): Promise<DirectDirEntry[]> {
  return invoke<DirectDirEntry[]>('read_dir_direct', { path })
}

/**
 * Get file/directory metadata directly via Rust std::fs.
 * Bypasses plugin-fs scope checking.
 *
 * @throws Error from Rust if path is outside $HOME or metadata can't be read
 *         (e.g. file does not exist)
 */
export async function statDirect(path: string): Promise<DirectStatResult> {
  return invoke<DirectStatResult>('stat_direct', { path })
}

/**
 * Remove a file or directory directly via Rust std::fs.
 * Bypasses plugin-fs scope checking.
 * No-op if path does not exist.
 *
 * @param path - Absolute path to remove
 * @param recursive - If true, remove directory and all contents
 * @throws Error from Rust if path is outside $HOME or removal fails
 */
export async function removeDirect(
  path: string,
  recursive: boolean,
): Promise<void> {
  return invoke<void>('remove_direct', { path, recursive })
}

/**
 * Open a path in the system file manager via std::process::Command.
 * Bypasses Tauri's opener plugin scope entirely, avoiding symlink
 * canonicalization issues that cause "Not allowed to open path" errors.
 *
 * @param path - Absolute path to open in the file manager
 * @throws Error from Rust if path is outside $HOME, doesn't exist, or open fails
 */
export async function openPathDirect(path: string): Promise<void> {
  return invoke<void>('open_path_direct', { path })
}
