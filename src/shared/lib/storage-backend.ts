/**
 * Storage backend interface.
 * Abstracts filesystem operations so the app can run with either
 * a real filesystem (Tauri) or an in-memory store (browser).
 */

export interface DirEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

export interface StorageBackend {
  // ============================================
  // App Settings Operations (AppData equivalent)
  // ============================================

  /** Read a JSON file from app data */
  readAppFile<T>(relativePath: string): Promise<T>

  /** Write a JSON file to app data */
  writeAppFile<T>(relativePath: string, data: T): Promise<void>

  /** Ensure a directory exists in app data */
  ensureAppDir(relativePath: string): Promise<void>

  /** List directory contents in app data */
  listAppDir(relativePath: string): Promise<DirEntry[]>

  /** Delete a file/directory in app data */
  removeAppFile(relativePath: string): Promise<void>

  /** Check if a file exists in app data */
  appFileExists(relativePath: string): Promise<boolean>

  /** Read raw text from app data */
  readAppTextFile(relativePath: string): Promise<string>

  /** Write raw text to app data */
  writeAppTextFile(relativePath: string, content: string): Promise<void>

  // ============================================
  // Project File Operations
  // ============================================

  /** Read a JSON file from a project folder */
  readProjectFile<T>(projectPath: string, relativePath: string): Promise<T>

  /** Write a JSON file to a project folder */
  writeProjectFile<T>(
    projectPath: string,
    relativePath: string,
    data: T,
  ): Promise<void>

  /** Ensure a directory exists in a project folder */
  ensureProjectDir(projectPath: string, relativePath: string): Promise<void>

  /** List directory contents in a project folder */
  listProjectDir(projectPath: string, relativePath: string): Promise<DirEntry[]>

  /** Delete a file/directory in a project folder */
  removeProjectFile(projectPath: string, relativePath: string): Promise<void>

  /** Check if a file/directory exists in a project folder */
  projectFileExists(projectPath: string, relativePath: string): Promise<boolean>

  /** Check if path is a valid project (has project.json) */
  isValidProject(folderPath: string): Promise<boolean>

  /** Check if a folder exists */
  folderExists(folderPath: string): Promise<boolean>

  /** List folder contents */
  listFolder(folderPath: string): Promise<DirEntry[]>

  /** Read raw text from project folder */
  readProjectTextFile(
    projectPath: string,
    relativePath: string,
  ): Promise<string>

  /** Write raw text to project folder */
  writeProjectTextFile(
    projectPath: string,
    relativePath: string,
    content: string,
  ): Promise<void>

  // ============================================
  // Dev Mode
  // ============================================

  /** Get the app data directory path */
  getAppDataPath(): Promise<string>

  /** Check if running in dev mode */
  isDevMode(): boolean

  /** Get dev data path */
  getDevDataPath(): string | undefined

  /** Get dev project path (absolute) */
  getDevProjectPath(): Promise<string | undefined>

  // ============================================
  // Absolute File Access
  // ============================================

  /**
   * Read raw text from an absolute filesystem path.
   * Used for importing local JSON files via a file picker.
   *
   * In Tauri mode: delegates to readTextFile(absolutePath) from @tauri-apps/plugin-fs.
   * In memory mode: throws — use paste input instead (no filesystem access in browser).
   */
  readAbsoluteFile(absolutePath: string): Promise<string>

  // ============================================
  // Path Helpers
  // ============================================

  /** Join path segments (replaces Tauri's async join) */
  joinPath(...segments: string[]): Promise<string>
}
