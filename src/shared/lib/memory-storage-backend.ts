import { PROJECT_PATHS } from './paths'
import type { DirEntry, StorageBackend } from './storage-backend'

interface MemoryStorageSnapshot {
  version: 1
  files: Array<readonly [string, string]>
  directories: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type NotFoundError = Error & { code: 'ENOENT' }

function createNotFoundError(path: string): NotFoundError {
  const error = new Error(`File not found: ${path}`) as NotFoundError
  error.code = 'ENOENT'
  return error
}

function isMemoryStorageSnapshot(
  value: unknown,
): value is MemoryStorageSnapshot {
  if (!isRecord(value)) {
    return false
  }

  const snapshotVersion = value['version']
  if (snapshotVersion !== 1) {
    return false
  }

  const snapshotFiles = value['files']
  const snapshotDirectories = value['directories']

  if (!Array.isArray(snapshotFiles) || !Array.isArray(snapshotDirectories)) {
    return false
  }

  const hasValidFiles = snapshotFiles.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === 'string' &&
      typeof entry[1] === 'string',
  )
  if (!hasValidFiles) {
    return false
  }

  return snapshotDirectories.every((entry) => typeof entry === 'string')
}

/**
 * In-memory storage backend for browser mode.
 * Uses a simple Map<string, string> as a flat file store.
 * Directories are implicit (derived from file paths).
 */
export class MemoryStorageBackend implements StorageBackend {
  /**
   * Flat file store: full path -> content string
   * Paths are normalized: no trailing slashes, forward slashes only
   * Example keys:
   *   "::appdata::/app-settings.json"
   *   "/memory/projects/demo/project.json"
   *   "/memory/projects/demo/graphs/abc-123.json"
   */
  private files = new Map<string, string>()

  /**
   * Set of paths that are explicitly created directories.
   * Used for ensureDir/folderExists checks.
   */
  private directories = new Set<string>()

  /** Prefix for app data files (simulated AppData directory) */
  private readonly appDataPrefix = '::appdata::'

  /** Browser persistence key for memory mode snapshot */
  private readonly persistenceStorageKey = 'vinela::memory-storage::v1'

  /** Base path for dev project */
  private readonly devProjectPath = '/memory/projects/demo'

  constructor() {
    this.ensureBaseDirectories()
    this.hydrateFromPersistence()
  }

  private ensureBaseDirectories(): void {
    this.directories.add('/memory')
    this.directories.add('/memory/projects')
    this.directories.add(this.devProjectPath)
    this.directories.add(`${this.devProjectPath}/${PROJECT_PATHS.GRAPHS}`)
    this.directories.add(`${this.devProjectPath}/${PROJECT_PATHS.SCHEMAS}`)
  }

  private persistSnapshot(): void {
    if (
      typeof window === 'undefined' ||
      typeof window.localStorage === 'undefined'
    ) {
      return
    }

    const snapshot: MemoryStorageSnapshot = {
      version: 1,
      files: Array.from(this.files.entries()),
      directories: Array.from(this.directories),
    }

    try {
      window.localStorage.setItem(
        this.persistenceStorageKey,
        JSON.stringify(snapshot),
      )
    } catch (error) {
      console.warn('Failed to persist memory storage snapshot', error)
    }
  }

  private hydrateFromPersistence(): void {
    if (
      typeof window === 'undefined' ||
      typeof window.localStorage === 'undefined'
    ) {
      return
    }

    try {
      const rawSnapshot = window.localStorage.getItem(
        this.persistenceStorageKey,
      )
      if (rawSnapshot === null) {
        return
      }

      const parsedSnapshot: unknown = JSON.parse(rawSnapshot)
      if (!isMemoryStorageSnapshot(parsedSnapshot)) {
        return
      }

      this.files = new Map(
        parsedSnapshot.files.map(([path, content]) => [
          this.normalizePath(path),
          content,
        ]),
      )
      this.directories = new Set(
        parsedSnapshot.directories.map((path) => this.normalizePath(path)),
      )
      this.ensureBaseDirectories()
    } catch (error) {
      console.warn('Failed to load memory storage snapshot', error)
    }
  }

  // ============================================
  // Internal helpers
  // ============================================

  private normalizePath(path: string): string {
    return path.replace(/\/+/g, '/').replace(/\/$/, '')
  }

  private appPath(relativePath: string): string {
    return `${this.appDataPrefix}/${this.normalizePath(relativePath)}`
  }

  private projectFilePath(projectPath: string, relativePath: string): string {
    return this.normalizePath(`${projectPath}/${relativePath}`)
  }

  private getFilesInDir(dirPath: string): DirEntry[] {
    const normalized = this.normalizePath(dirPath)
    const prefix = `${normalized}/`
    const entries = new Map<string, DirEntry>()

    // Find files directly in this directory (not nested deeper)
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const remainder = key.slice(prefix.length)
        // Only direct children (no more slashes)
        if (!remainder.includes('/')) {
          entries.set(remainder, {
            name: remainder,
            isDirectory: false,
            isFile: true,
            isSymlink: false,
          })
        }
      }
    }

    // Find subdirectories directly in this directory
    for (const dir of this.directories) {
      if (dir.startsWith(prefix)) {
        const remainder = dir.slice(prefix.length)
        if (!remainder.includes('/') && remainder.length > 0) {
          entries.set(remainder, {
            name: remainder,
            isDirectory: true,
            isFile: false,
            isSymlink: false,
          })
        }
      }
    }

    return Array.from(entries.values())
  }

  // ============================================
  // App Settings Operations
  // ============================================

  async readAppFile<T>(relativePath: string): Promise<T> {
    const key = this.appPath(relativePath)
    const content = this.files.get(key)
    if (content === undefined) {
      throw createNotFoundError(relativePath)
    }
    return JSON.parse(content) as T
  }

  async writeAppFile<T>(relativePath: string, data: T): Promise<void> {
    const key = this.appPath(relativePath)
    this.files.set(key, JSON.stringify(data, null, 2))
    this.persistSnapshot()
  }

  async ensureAppDir(relativePath: string): Promise<void> {
    this.directories.add(this.appPath(relativePath))
    this.persistSnapshot()
  }

  async listAppDir(relativePath: string): Promise<DirEntry[]> {
    return this.getFilesInDir(this.appPath(relativePath))
  }

  async removeAppFile(relativePath: string): Promise<void> {
    const key = this.appPath(relativePath)
    this.files.delete(key)
    // Also remove any files under this path (recursive)
    const prefix = `${key}/`
    for (const k of this.files.keys()) {
      if (k.startsWith(prefix)) {
        this.files.delete(k)
      }
    }
    this.directories.delete(key)
    this.persistSnapshot()
  }

  async appFileExists(relativePath: string): Promise<boolean> {
    const key = this.appPath(relativePath)
    return this.files.has(key) || this.directories.has(key)
  }

  async readAppTextFile(relativePath: string): Promise<string> {
    const key = this.appPath(relativePath)
    const content = this.files.get(key)
    if (content === undefined) {
      throw createNotFoundError(relativePath)
    }
    return content
  }

  async writeAppTextFile(relativePath: string, content: string): Promise<void> {
    const key = this.appPath(relativePath)
    this.files.set(key, content)
    this.persistSnapshot()
  }

  // ============================================
  // Project File Operations
  // ============================================

  async readProjectFile<T>(
    projectPath: string,
    relativePath: string,
  ): Promise<T> {
    const key = this.projectFilePath(projectPath, relativePath)
    const content = this.files.get(key)
    if (content === undefined) {
      throw createNotFoundError(`${projectPath}/${relativePath}`)
    }
    return JSON.parse(content) as T
  }

  async writeProjectFile<T>(
    projectPath: string,
    relativePath: string,
    data: T,
  ): Promise<void> {
    const key = this.projectFilePath(projectPath, relativePath)
    this.files.set(key, JSON.stringify(data, null, 2))
    this.persistSnapshot()
  }

  async ensureProjectDir(
    projectPath: string,
    relativePath: string,
  ): Promise<void> {
    const key = this.projectFilePath(projectPath, relativePath)
    this.directories.add(key)
    this.persistSnapshot()
  }

  async listProjectDir(
    projectPath: string,
    relativePath: string,
  ): Promise<DirEntry[]> {
    const key = this.projectFilePath(projectPath, relativePath)
    return this.getFilesInDir(key)
  }

  async removeProjectFile(
    projectPath: string,
    relativePath: string,
  ): Promise<void> {
    const key = this.projectFilePath(projectPath, relativePath)
    this.files.delete(key)
    const prefix = `${key}/`
    for (const k of this.files.keys()) {
      if (k.startsWith(prefix)) {
        this.files.delete(k)
      }
    }
    this.directories.delete(key)
    this.persistSnapshot()
  }

  async projectFileExists(
    projectPath: string,
    relativePath: string,
  ): Promise<boolean> {
    const key = this.projectFilePath(projectPath, relativePath)
    return this.files.has(key) || this.directories.has(key)
  }

  async isValidProject(folderPath: string): Promise<boolean> {
    return this.projectFileExists(folderPath, PROJECT_PATHS.PROJECT_JSON)
  }

  async folderExists(folderPath: string): Promise<boolean> {
    const normalized = this.normalizePath(folderPath)
    // A folder exists if it's in directories set OR if any file has it as prefix
    if (this.directories.has(normalized)) return true
    const prefix = `${normalized}/`
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true
    }
    return false
  }

  async listFolder(folderPath: string): Promise<DirEntry[]> {
    return this.getFilesInDir(this.normalizePath(folderPath))
  }

  async readProjectTextFile(
    projectPath: string,
    relativePath: string,
  ): Promise<string> {
    const key = this.projectFilePath(projectPath, relativePath)
    const content = this.files.get(key)
    if (content === undefined) {
      throw createNotFoundError(`${projectPath}/${relativePath}`)
    }
    return content
  }

  async writeProjectTextFile(
    projectPath: string,
    relativePath: string,
    content: string,
  ): Promise<void> {
    const key = this.projectFilePath(projectPath, relativePath)
    this.files.set(key, content)
    this.persistSnapshot()
  }

  // ============================================
  // Dev Mode
  // ============================================

  async getAppDataPath(): Promise<string> {
    return this.appDataPrefix
  }

  isDevMode(): boolean {
    return import.meta.env.DEV
  }

  getDevDataPath(): string | undefined {
    return '/memory/projects'
  }

  async getDevProjectPath(): Promise<string | undefined> {
    return this.devProjectPath
  }

  // ============================================
  // Absolute File Access
  // ============================================

  async readAbsoluteFile(_absolutePath: string): Promise<string> {
    throw new Error(
      'readAbsoluteFile is not supported in memory mode. Use paste input instead.',
    )
  }

  // ============================================
  // Path Helpers
  // ============================================

  async joinPath(...segments: string[]): Promise<string> {
    return segments.join('/')
  }

  // ============================================
  // Debug: Inspect in-memory state
  // ============================================

  /** Debug helper: get all stored files (for console inspection) */
  _debugGetAllFiles(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of this.files.entries()) {
      result[key] = value
    }
    return result
  }

  /** Debug helper: get all directories */
  _debugGetAllDirectories(): string[] {
    return Array.from(this.directories)
  }
}
