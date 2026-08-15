import { join } from '@tauri-apps/api/path'
import * as fs from './fs'
import type { DirEntry, StorageBackend } from './storage-backend'

export class TauriStorageBackend implements StorageBackend {
  // ============================================
  // App Settings Operations
  // ============================================

  readAppFile<T>(relativePath: string): Promise<T> {
    return fs.readAppFile<T>(relativePath)
  }

  writeAppFile<T>(relativePath: string, data: T): Promise<void> {
    return fs.writeAppFile(relativePath, data)
  }

  ensureAppDir(relativePath: string): Promise<void> {
    return fs.ensureAppDir(relativePath)
  }

  async listAppDir(relativePath: string): Promise<DirEntry[]> {
    const entries = await fs.listAppDir(relativePath)
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory,
      isFile: e.isFile,
      isSymlink: e.isSymlink,
    }))
  }

  removeAppFile(relativePath: string): Promise<void> {
    return fs.removeAppFile(relativePath)
  }

  appFileExists(relativePath: string): Promise<boolean> {
    return fs.appFileExists(relativePath)
  }

  readAppTextFile(relativePath: string): Promise<string> {
    return fs.readAppTextFile(relativePath)
  }

  writeAppTextFile(relativePath: string, content: string): Promise<void> {
    return fs.writeAppTextFile(relativePath, content)
  }

  // ============================================
  // Project File Operations
  // ============================================

  readProjectFile<T>(projectPath: string, relativePath: string): Promise<T> {
    return fs.readProjectFile<T>(projectPath, relativePath)
  }

  writeProjectFile<T>(
    projectPath: string,
    relativePath: string,
    data: T,
  ): Promise<void> {
    return fs.writeProjectFile(projectPath, relativePath, data)
  }

  ensureProjectDir(projectPath: string, relativePath: string): Promise<void> {
    return fs.ensureProjectDir(projectPath, relativePath)
  }

  async listProjectDir(
    projectPath: string,
    relativePath: string,
  ): Promise<DirEntry[]> {
    const entries = await fs.listProjectDir(projectPath, relativePath)
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory,
      isFile: e.isFile,
      isSymlink: e.isSymlink,
    }))
  }

  removeProjectFile(projectPath: string, relativePath: string): Promise<void> {
    return fs.removeProjectFile(projectPath, relativePath)
  }

  projectFileExists(
    projectPath: string,
    relativePath: string,
  ): Promise<boolean> {
    return fs.projectFileExists(projectPath, relativePath)
  }

  isValidProject(folderPath: string): Promise<boolean> {
    return fs.isValidProject(folderPath)
  }

  folderExists(folderPath: string): Promise<boolean> {
    return fs.folderExists(folderPath)
  }

  async listFolder(folderPath: string): Promise<DirEntry[]> {
    const entries = await fs.listFolder(folderPath)
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory,
      isFile: e.isFile,
      isSymlink: e.isSymlink,
    }))
  }

  readProjectTextFile(
    projectPath: string,
    relativePath: string,
  ): Promise<string> {
    return fs.readProjectTextFile(projectPath, relativePath)
  }

  writeProjectTextFile(
    projectPath: string,
    relativePath: string,
    content: string,
  ): Promise<void> {
    return fs.writeProjectTextFile(projectPath, relativePath, content)
  }

  // ============================================
  // Dev Mode
  // ============================================

  getAppDataPath(): Promise<string> {
    return fs.getAppDataPath()
  }

  isDevMode(): boolean {
    return fs.isDevMode()
  }

  getDevDataPath(): string | undefined {
    return fs.getDevDataPath()
  }

  getDevProjectPath(): Promise<string | undefined> {
    return fs.getDevProjectPath()
  }

  // ============================================
  // Absolute File Access
  // ============================================

  async readAbsoluteFile(absolutePath: string): Promise<string> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    return readTextFile(absolutePath)
  }

  // ============================================
  // Path Helpers
  // ============================================

  joinPath(...segments: string[]): Promise<string> {
    return join(...segments)
  }
}
