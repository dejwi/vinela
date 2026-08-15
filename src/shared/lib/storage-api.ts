/**
 * Storage API - drop-in replacement for direct fs.ts imports.
 *
 * Instead of:
 *   import { readProjectFile, writeProjectFile } from '@/shared/lib/fs'
 *
 * Use:
 *   import { readProjectFile, writeProjectFile } from '@/shared/lib/storage-api'
 *
 * This routes through the active storage backend (Tauri or Memory).
 */

import { getProjectStorageBackend, getStorageBackend } from './storage'
import type { DirEntry } from './storage-backend'

// Re-export type for consumers
export type { DirEntry }

// ============================================
// App Settings Operations
// ============================================

export async function readAppFile<T>(relativePath: string): Promise<T> {
  const backend = await getStorageBackend()
  return backend.readAppFile<T>(relativePath)
}

export async function writeAppFile<T>(
  relativePath: string,
  data: T,
): Promise<void> {
  const backend = await getStorageBackend()
  return backend.writeAppFile(relativePath, data)
}

export async function ensureAppDir(relativePath: string): Promise<void> {
  const backend = await getStorageBackend()
  return backend.ensureAppDir(relativePath)
}

export async function listAppDir(relativePath: string): Promise<DirEntry[]> {
  const backend = await getStorageBackend()
  return backend.listAppDir(relativePath)
}

export async function removeAppFile(relativePath: string): Promise<void> {
  const backend = await getStorageBackend()
  return backend.removeAppFile(relativePath)
}

export async function appFileExists(relativePath: string): Promise<boolean> {
  const backend = await getStorageBackend()
  return backend.appFileExists(relativePath)
}

export async function readAppTextFile(relativePath: string): Promise<string> {
  const backend = await getStorageBackend()
  return backend.readAppTextFile(relativePath)
}

export async function writeAppTextFile(
  relativePath: string,
  content: string,
): Promise<void> {
  const backend = await getStorageBackend()
  return backend.writeAppTextFile(relativePath, content)
}

// ============================================
// Project File Operations
// ============================================

export async function readProjectFile<T>(
  projectPath: string,
  relativePath: string,
): Promise<T> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.readProjectFile<T>(projectPath, relativePath)
}

export async function writeProjectFile<T>(
  projectPath: string,
  relativePath: string,
  data: T,
): Promise<void> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.writeProjectFile(projectPath, relativePath, data)
}

export async function ensureProjectDir(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.ensureProjectDir(projectPath, relativePath)
}

export async function listProjectDir(
  projectPath: string,
  relativePath: string,
): Promise<DirEntry[]> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.listProjectDir(projectPath, relativePath)
}

export async function removeProjectFile(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.removeProjectFile(projectPath, relativePath)
}

export async function projectFileExists(
  projectPath: string,
  relativePath: string,
): Promise<boolean> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.projectFileExists(projectPath, relativePath)
}

export async function isValidProject(folderPath: string): Promise<boolean> {
  const backend = await getProjectStorageBackend(folderPath)
  return backend.isValidProject(folderPath)
}

export async function folderExists(folderPath: string): Promise<boolean> {
  const backend = await getProjectStorageBackend(folderPath)
  return backend.folderExists(folderPath)
}

export async function listFolder(folderPath: string): Promise<DirEntry[]> {
  const backend = await getProjectStorageBackend(folderPath)
  return backend.listFolder(folderPath)
}

export async function readProjectTextFile(
  projectPath: string,
  relativePath: string,
): Promise<string> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.readProjectTextFile(projectPath, relativePath)
}

export async function writeProjectTextFile(
  projectPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const backend = await getProjectStorageBackend(projectPath)
  return backend.writeProjectTextFile(projectPath, relativePath, content)
}

// ============================================
// Dev Mode Utilities
// ============================================

export async function getAppDataPath(): Promise<string> {
  const backend = await getStorageBackend()
  return backend.getAppDataPath()
}

export function isDevMode(): boolean {
  return import.meta.env.DEV
}

export async function getDevDataPath(): Promise<string | undefined> {
  const backend = await getStorageBackend()
  return backend.getDevDataPath()
}

export async function getDevProjectPath(): Promise<string | undefined> {
  const backend = await getStorageBackend()
  return backend.getDevProjectPath()
}
