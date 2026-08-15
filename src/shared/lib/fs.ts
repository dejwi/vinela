/**
 * File System Utilities
 *
 * This module provides two categories of file operations:
 *
 * 1. **App Settings** - Always stored in system AppData directory
 *    - Use for: app-settings.json, global schemas, backups
 *    - Functions: readAppFile, writeAppFile, appFileExists, etc.
 *
 * 2. **Project Files** - Stored directly in user-chosen project folders
 *    - Use for: project.json, graphs/, schemas/, plugins.json, etc.
 *    - Functions: readProjectFile, writeProjectFile, projectFileExists, etc.
 *
 * Dev Mode:
 *    - When `import.meta.env.DEV` is true, defaults to `./dev-data/` in the repo
 *    - Use getDevDataPath() and isDevMode() for dev mode utilities
 */

import { invoke } from '@tauri-apps/api/core'
import { appDataDir, homeDir } from '@tauri-apps/api/path'
import {
  BaseDirectory,
  type MkdirOptions,
  mkdir,
  type ReadDirOptions,
  type ReadFileOptions,
  type RemoveOptions,
  readDir,
  readTextFile,
  remove,
  type StatOptions,
  stat,
  type WriteFileOptions,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { PROJECT_PATHS } from './paths'

// ============================================
// Path Resolution Helpers
// ============================================

/** Cached AppData path for performance */
let cachedAppDataPath: string | null = null

/** Cached Home path for performance */
let cachedHomePath: string | null = null

/**
 * Get cached AppData path. Initializes on first call.
 */
async function getAppDataPathCached(): Promise<string> {
  if (cachedAppDataPath === null) {
    cachedAppDataPath = await appDataDir()
  }
  return cachedAppDataPath
}

/**
 * Get cached Home path. Initializes on first call.
 */
async function getHomePathCached(): Promise<string> {
  if (cachedHomePath === null) {
    cachedHomePath = await homeDir()
  }
  return cachedHomePath
}

/**
 * Check if a path is within the AppData directory.
 * If so, returns the relative path; otherwise returns null.
 */
async function getRelativeAppDataPath(
  absolutePath: string,
): Promise<string | null> {
  const appData = await getAppDataPathCached()
  // Normalize paths for comparison (handle trailing slashes)
  const normalizedAppData = appData.endsWith('/') ? appData : `${appData}/`
  const normalizedPath = absolutePath.endsWith('/')
    ? absolutePath
    : `${absolutePath}/`

  if (
    absolutePath.startsWith(normalizedAppData) ||
    normalizedPath.startsWith(normalizedAppData)
  ) {
    // Return the relative path (strip AppData prefix)
    return absolutePath.slice(normalizedAppData.length)
  }
  return null
}

/**
 * Check if a path is within the Home directory.
 * If so, returns the relative path; otherwise returns null.
 */
async function getRelativeHomePath(
  absolutePath: string,
): Promise<string | null> {
  const home = await getHomePathCached()
  // Normalize paths for comparison (handle trailing slashes)
  const normalizedHome = home.endsWith('/') ? home : `${home}/`
  const normalizedPath = absolutePath.endsWith('/')
    ? absolutePath
    : `${absolutePath}/`

  if (
    absolutePath.startsWith(normalizedHome) ||
    normalizedPath.startsWith(normalizedHome)
  ) {
    // Return the relative path (strip Home prefix)
    return absolutePath.slice(normalizedHome.length)
  }
  return null
}

/**
 * Get fs options that work with Tauri's permission system.
 * For paths in AppData, uses BaseDirectory.AppData with relative path.
 * For paths in Home, uses BaseDirectory.Home with relative path.
 * For other paths, uses absolute path (requires explicit scope permissions).
 */
async function resolvePathForFs(absolutePath: string): Promise<{
  path: string
  options: ReadFileOptions | WriteFileOptions | StatOptions
}> {
  // First check AppData (more specific)
  const relativeAppDataPath = await getRelativeAppDataPath(absolutePath)
  if (relativeAppDataPath !== null) {
    return {
      path: relativeAppDataPath,
      options: { baseDir: BaseDirectory.AppData },
    }
  }

  // Then check Home directory
  const relativeHomePath = await getRelativeHomePath(absolutePath)
  if (relativeHomePath !== null) {
    return {
      path: relativeHomePath,
      options: { baseDir: BaseDirectory.Home },
    }
  }

  // Fallback to absolute path (needs scope permissions)
  return {
    path: absolutePath,
    options: {},
  }
}

/**
 * Check if a path exists using stat() as a workaround.
 * The exists() function from Tauri fs plugin hangs on non-existent paths.
 * This uses stat() which properly throws an error for non-existent paths.
 */
async function safeExists(
  path: string,
  options: StatOptions,
): Promise<boolean> {
  try {
    await stat(path, options)
    return true
  } catch {
    // stat throws when path doesn't exist
    return false
  }
}

/**
 * Resolve path with mkdir-specific options.
 */
async function resolvePathForMkdir(
  absolutePath: string,
  recursive = true,
): Promise<{
  path: string
  options: MkdirOptions
}> {
  // First check AppData (more specific)
  const relativeAppDataPath = await getRelativeAppDataPath(absolutePath)
  if (relativeAppDataPath !== null) {
    return {
      path: relativeAppDataPath,
      options: { baseDir: BaseDirectory.AppData, recursive },
    }
  }

  // Then check Home directory
  const relativeHomePath = await getRelativeHomePath(absolutePath)
  if (relativeHomePath !== null) {
    return {
      path: relativeHomePath,
      options: { baseDir: BaseDirectory.Home, recursive },
    }
  }

  return {
    path: absolutePath,
    options: { recursive },
  }
}

/**
 * Resolve path with remove-specific options.
 */
async function resolvePathForRemove(
  absolutePath: string,
  recursive = true,
): Promise<{
  path: string
  options: RemoveOptions
}> {
  // First check AppData (more specific)
  const relativeAppDataPath = await getRelativeAppDataPath(absolutePath)
  if (relativeAppDataPath !== null) {
    return {
      path: relativeAppDataPath,
      options: { baseDir: BaseDirectory.AppData, recursive },
    }
  }

  // Then check Home directory
  const relativeHomePath = await getRelativeHomePath(absolutePath)
  if (relativeHomePath !== null) {
    return {
      path: relativeHomePath,
      options: { baseDir: BaseDirectory.Home, recursive },
    }
  }

  return {
    path: absolutePath,
    options: { recursive },
  }
}

/**
 * Resolve path for readDir.
 */
async function resolvePathForReadDir(absolutePath: string): Promise<{
  path: string
  options: ReadDirOptions
}> {
  // First check AppData (more specific)
  const relativeAppDataPath = await getRelativeAppDataPath(absolutePath)
  if (relativeAppDataPath !== null) {
    return {
      path: relativeAppDataPath,
      options: { baseDir: BaseDirectory.AppData },
    }
  }

  // Then check Home directory
  const relativeHomePath = await getRelativeHomePath(absolutePath)
  if (relativeHomePath !== null) {
    return {
      path: relativeHomePath,
      options: { baseDir: BaseDirectory.Home },
    }
  }

  return {
    path: absolutePath,
    options: {},
  }
}

// ============================================
// Constants
// ============================================

/** Relative path to dev data from repo root */
const DEV_DATA_RELATIVE_PATH = './dev-data'

// ============================================
// Dev Mode Utilities
// ============================================

/**
 * Check if running in development mode.
 * Uses Vite's import.meta.env.DEV which is automatically set.
 */
export function isDevMode(): boolean {
  return import.meta.env.DEV
}

/**
 * Get the dev data path for local development.
 * Returns undefined in production mode.
 */
export function getDevDataPath(): string | undefined {
  if (isDevMode()) {
    return DEV_DATA_RELATIVE_PATH
  }
  return undefined
}

/**
 * Get the default project path for dev mode as an absolute path.
 * This is where the auto-created dev project lives.
 * Calls a Rust command that returns the path only in debug builds.
 */
export async function getDevProjectPath(): Promise<string | undefined> {
  if (!isDevMode()) {
    return undefined
  }
  try {
    // Check if we're running inside Tauri (not just in browser for HMR)
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const devProjectPath = await invoke<string | null>('get_dev_project_path')
      return devProjectPath ?? undefined
    }
    return undefined
  } catch {
    return undefined
  }
}

// ============================================
// App Settings File Operations
// ============================================
// These functions operate on files in the system AppData directory.
// Used for: app-settings.json, global schemas, backups

/**
 * Get the app data directory path.
 * This is the system-provided application data location.
 */
export async function getAppDataPath(): Promise<string> {
  return appDataDir()
}

/**
 * Read a JSON file from the app data directory.
 * @param relativePath - Path relative to app data dir (e.g., "app-settings.json")
 */
export async function readAppFile<T>(relativePath: string): Promise<T> {
  const content = await readTextFile(relativePath, {
    baseDir: BaseDirectory.AppData,
  })
  return JSON.parse(content) as T
}

/**
 * Write a JSON file to the app data directory.
 * @param relativePath - Path relative to app data dir
 * @param data - Data to serialize as JSON
 */
export async function writeAppFile<T>(
  relativePath: string,
  data: T,
): Promise<void> {
  const content = JSON.stringify(data, null, 2)
  await writeTextFile(relativePath, content, {
    baseDir: BaseDirectory.AppData,
  })
}

/**
 * Ensure a directory exists in the app data directory.
 * Creates parent directories as needed.
 */
export async function ensureAppDir(relativePath: string): Promise<void> {
  const dirExists = await safeExists(relativePath, {
    baseDir: BaseDirectory.AppData,
  })
  if (!dirExists) {
    await mkdir(relativePath, {
      baseDir: BaseDirectory.AppData,
      recursive: true,
    })
  }
}

/**
 * List contents of a directory in app data.
 */
export async function listAppDir(relativePath: string) {
  return readDir(relativePath, {
    baseDir: BaseDirectory.AppData,
  })
}

/**
 * Delete a file or directory in app data.
 */
export async function removeAppFile(relativePath: string): Promise<void> {
  await remove(relativePath, {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  })
}

/**
 * Check if a file exists in app data directory.
 * @param relativePath - Path relative to app data dir
 */
export async function appFileExists(relativePath: string): Promise<boolean> {
  return safeExists(relativePath, { baseDir: BaseDirectory.AppData })
}

/**
 * Check if a path is a valid project (has project.json at the project root).
 */
export async function isValidProject(folderPath: string): Promise<boolean> {
  return projectFileExists(folderPath, PROJECT_PATHS.PROJECT_JSON)
}

/**
 * Read a text file from app data (not JSON).
 */
export async function readAppTextFile(relativePath: string): Promise<string> {
  return readTextFile(relativePath, {
    baseDir: BaseDirectory.AppData,
  })
}

/**
 * Write a text file to app data (not JSON).
 */
export async function writeAppTextFile(
  relativePath: string,
  content: string,
): Promise<void> {
  await writeTextFile(relativePath, content, {
    baseDir: BaseDirectory.AppData,
  })
}

// ============================================
// Project File Operations
// ============================================
// These functions operate on files within project folders.
// Project files are stored directly under the selected project root.
// For paths within AppData or Home, uses appropriate BaseDirectory for proper permissions.

function getProjectFileAbsolutePath(
  projectPath: string,
  relativePath: string,
): string {
  return `${projectPath}/${relativePath}`
}

/**
 * Read a JSON file from a project folder.
 * @param projectPath - Absolute path to project folder
 * @param relativePath - Path relative to the project root (e.g., "project.json", "graphs/main.json")
 */
export async function readProjectFile<T>(
  projectPath: string,
  relativePath: string,
): Promise<T> {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const resolved = await resolvePathForFs(fullPath)
  const content = await readTextFile(resolved.path, resolved.options)
  return JSON.parse(content) as T
}

/**
 * Write a JSON file to a project folder.
 * @param projectPath - Absolute path to project folder
 * @param relativePath - Path relative to the project root
 * @param data - Data to serialize as JSON
 */
export async function writeProjectFile<T>(
  projectPath: string,
  relativePath: string,
  data: T,
): Promise<void> {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const content = JSON.stringify(data, null, 2)
  const resolved = await resolvePathForFs(fullPath)
  await writeTextFile(resolved.path, content, resolved.options)
}

/**
 * Ensure a directory exists within a project folder.
 * @param projectPath - Absolute path to project folder
 * @param relativePath - Path relative to the project root (e.g., "graphs", "schemas")
 */
export async function ensureProjectDir(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const existsResolved = await resolvePathForFs(fullPath)
  const dirExists = await safeExists(
    existsResolved.path,
    existsResolved.options,
  )
  if (!dirExists) {
    const mkdirResolved = await resolvePathForMkdir(fullPath)
    await mkdir(mkdirResolved.path, mkdirResolved.options)
  }
}

/**
 * List contents of a directory in a project folder.
 * @param projectPath - Absolute path to project folder
 * @param relativePath - Path relative to the project root
 */
export async function listProjectDir(
  projectPath: string,
  relativePath: string,
) {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const resolved = await resolvePathForReadDir(fullPath)
  return readDir(resolved.path, resolved.options)
}

/**
 * Delete a file or directory in a project folder.
 * @param projectPath - Absolute path to project folder
 * @param relativePath - Path relative to the project root
 */
export async function removeProjectFile(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const resolved = await resolvePathForRemove(fullPath)
  await remove(resolved.path, resolved.options)
}

/**
 * Check if a file or directory exists in a project folder.
 * @param projectPath - Absolute path to project folder
 * @param relativePath - Path relative to the project root
 */
export async function projectFileExists(
  projectPath: string,
  relativePath: string,
): Promise<boolean> {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const resolved = await resolvePathForFs(fullPath)
  // Use safeExists instead of exists() which hangs on non-existent paths
  return safeExists(resolved.path, resolved.options)
}

/**
 * Check if a folder exists (for validating user-selected paths).
 * @param folderPath - Absolute path to check
 */
export async function folderExists(folderPath: string): Promise<boolean> {
  const resolved = await resolvePathForFs(folderPath)
  // Use safeExists instead of exists() which hangs on non-existent paths
  return safeExists(resolved.path, resolved.options)
}

/**
 * List contents of a folder.
 * Useful for checking if a folder has existing files before creating a project.
 * @param folderPath - Absolute path to folder
 */
export async function listFolder(folderPath: string) {
  const resolved = await resolvePathForReadDir(folderPath)
  return readDir(resolved.path, resolved.options)
}

/**
 * Read a text file from the project root (not JSON).
 */
export async function readProjectTextFile(
  projectPath: string,
  relativePath: string,
): Promise<string> {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const resolved = await resolvePathForFs(fullPath)
  return readTextFile(resolved.path, resolved.options)
}

/**
 * Write a text file to the project root (not JSON).
 */
export async function writeProjectTextFile(
  projectPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = getProjectFileAbsolutePath(projectPath, relativePath)
  const resolved = await resolvePathForFs(fullPath)
  await writeTextFile(resolved.path, content, resolved.options)
}
