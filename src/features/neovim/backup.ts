import {
  mkdirDirect,
  openPathDirect,
  pathExistsDirect,
  readDirDirect,
  readTextFileDirect,
  removeDirect,
  statDirect,
  writeTextFileDirect,
} from '@/shared/lib/direct-fs'
import { getBackupFolderPath } from '@/shared/lib/settings'
import { isMemoryMode } from '@/shared/lib/storage'
import type {
  BackupInfo,
  BackupMetadata,
  BackupResult,
  DeleteBackupResult,
  ListBackupsResult,
  RestoreResult,
} from './types'
import {
  BACKUP_EXTENSION,
  BACKUP_META_EXTENSION,
  GENERATED_CONFIG_MARKER,
  MAX_BACKUPS,
} from './types'

// ============================================
// Path Helpers
// ============================================

/**
 * Check if a path exists using pathExistsDirect() (std::fs, no scope issues).
 */
async function safePathExists(path: string): Promise<boolean> {
  try {
    return await pathExistsDirect(path)
  } catch {
    return false
  }
}

/**
 * Ensure backup folder exists.
 */
async function ensureBackupFolder(backupFolderPath: string): Promise<void> {
  await mkdirDirect(backupFolderPath)
}

// ============================================
// Public API
// ============================================

/**
 * Create a backup of the config file at configPath.
 *
 * @param configPath - Absolute path to the config file (e.g., ~/.config/nvim/init.lua)
 * @param neovimVersion - Current Neovim version for metadata
 * @param force - If true, backup even if config is ours (used for pre-restore safety backup)
 */
export async function createBackup(
  configPath: string,
  neovimVersion: string,
  force = false,
): Promise<BackupResult> {
  if (isMemoryMode()) {
    return { success: true, skipped: true, reason: 'memory-mode' }
  }

  try {
    const backupFolderPath = getBackupFolderPath(configPath)

    // Step 1: Check if config file exists
    const configExists = await safePathExists(configPath)
    if (!configExists) {
      return { success: true, skipped: true, reason: 'no-existing-config' }
    }

    // Step 2: Read config content
    const content = await readTextFileDirect(configPath)

    // Step 3: Check for generated marker
    const firstLine = content.split('\n')[0]?.trim() ?? ''
    if (!force && firstLine.startsWith(GENERATED_CONFIG_MARKER)) {
      return { success: true, skipped: true, reason: 'our-config' }
    }

    // Step 4: Get file size
    const fileStat = await statDirect(configPath)
    const sizeBytes = fileStat.size

    // Step 5: Create backup folder
    await ensureBackupFolder(backupFolderPath)

    // Step 6: Write backup file + metadata
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFilename = `init.lua.${timestamp}${BACKUP_EXTENSION}`
    const metaFilename = `init.lua.${timestamp}${BACKUP_META_EXTENSION}`
    const backupPath = `${backupFolderPath}/${backupFilename}`
    const metaPath = `${backupFolderPath}/${metaFilename}`

    const metadata: BackupMetadata = {
      sourcePath: configPath,
      createdAt: new Date().toISOString(),
      neovimVersion,
      sizeBytes,
    }

    await writeTextFileDirect(backupPath, content)
    await writeTextFileDirect(metaPath, JSON.stringify(metadata, null, 2))

    // Step 7: Enforce retention
    await enforceRetention(configPath)

    const backup: BackupInfo = {
      id: timestamp,
      backupPath,
      sourcePath: configPath,
      createdAt: metadata.createdAt,
      neovimVersion,
      sizeBytes,
    }

    return { success: true, backup }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create backup'
    console.error('[backup] createBackup FAILED:', message)
    return { success: false, error: message }
  }
}

/**
 * List all backups for a given output path, sorted newest first.
 *
 * @param outputPath - The Neovim output path (used to derive backup folder)
 */
export async function listBackups(
  outputPath: string,
): Promise<ListBackupsResult> {
  if (isMemoryMode()) {
    return { success: true, backups: [] }
  }

  try {
    const backupFolderPath = getBackupFolderPath(outputPath)
    const dirExists = await safePathExists(backupFolderPath)
    if (!dirExists) {
      return { success: true, backups: [] }
    }

    const entries = await readDirDirect(backupFolderPath)
    const backups: BackupInfo[] = []

    for (const entry of entries) {
      if (!entry.is_file || !entry.name.endsWith(BACKUP_EXTENSION)) {
        continue
      }

      const metaFilename = entry.name.replace(
        BACKUP_EXTENSION,
        BACKUP_META_EXTENSION,
      )
      const metaPath = `${backupFolderPath}/${metaFilename}`

      try {
        const metaContent = await readTextFileDirect(metaPath)
        const metadata = JSON.parse(metaContent) as BackupMetadata

        const id = entry.name
          .replace('init.lua.', '')
          .replace(BACKUP_EXTENSION, '')

        backups.push({
          id,
          backupPath: `${backupFolderPath}/${entry.name}`,
          sourcePath: metadata.sourcePath,
          createdAt: metadata.createdAt,
          neovimVersion: metadata.neovimVersion,
          sizeBytes: metadata.sizeBytes,
        })
      } catch {
        console.warn(
          `[backup] Skipping backup with missing metadata: ${entry.name}`,
        )
      }
    }

    backups.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    return { success: true, backups }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list backups',
    }
  }
}

/**
 * Restore a backup to the target path.
 */
export async function restoreBackup(
  backupId: string,
  targetPath: string,
  neovimVersion: string,
): Promise<RestoreResult> {
  if (isMemoryMode()) {
    return { success: false, error: 'Restore is not available in browser mode' }
  }

  try {
    const listResult = await listBackups(targetPath)
    if (!listResult.success) {
      return { success: false, error: listResult.error }
    }

    const backup = listResult.backups.find((b) => b.id === backupId)
    if (!backup) {
      return { success: false, error: `Backup not found: ${backupId}` }
    }

    // Safety backup before restore
    const safetyBackupResult = await createBackup(
      targetPath,
      neovimVersion,
      true,
    )
    if (!safetyBackupResult.success) {
      return {
        success: false,
        error: `Cannot restore: failed to create safety backup. ${safetyBackupResult.error}`,
      }
    }

    console.log(`[backup] Restoring backup ${backupId} to "${targetPath}"`)
    const content = await readTextFileDirect(backup.backupPath)
    await writeTextFileDirect(targetPath, content)
    console.log('[backup] Restore complete')

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to restore backup',
    }
  }
}

/**
 * Delete a specific backup.
 */
export async function deleteBackup(
  backupId: string,
  outputPath: string,
): Promise<DeleteBackupResult> {
  if (isMemoryMode()) {
    return { success: false, error: 'Delete is not available in browser mode' }
  }

  try {
    const backupFolderPath = getBackupFolderPath(outputPath)
    const backupFilename = `init.lua.${backupId}${BACKUP_EXTENSION}`
    const metaFilename = `init.lua.${backupId}${BACKUP_META_EXTENSION}`

    await removeDirect(`${backupFolderPath}/${backupFilename}`, false)
    await removeDirect(`${backupFolderPath}/${metaFilename}`, false)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete backup',
    }
  }
}

/**
 * Enforce retention policy for backups at a given output path.
 */
export async function enforceRetention(
  outputPath: string,
  maxBackups = MAX_BACKUPS,
): Promise<void> {
  if (isMemoryMode()) {
    return
  }

  const listResult = await listBackups(outputPath)
  if (!listResult.success) {
    return
  }

  const { backups } = listResult
  if (backups.length <= maxBackups) {
    return
  }

  const toDelete = backups.slice(maxBackups)
  for (const backup of toDelete) {
    await deleteBackup(backup.id, outputPath)
  }
}

/**
 * Open the backup folder in the system file manager.
 *
 * Uses a direct Rust command (std::process::Command) instead of Tauri's
 * opener plugin, which suffers from symlink canonicalization issues
 * ("Not allowed to open path" errors on symlinked directories).
 */
export async function openBackupFolder(outputPath: string): Promise<void> {
  const backupFolderPath = getBackupFolderPath(outputPath)

  // Ensure folder exists before opening
  const exists = await safePathExists(backupFolderPath)
  if (!exists) {
    await ensureBackupFolder(backupFolderPath)
  }

  await openPathDirect(backupFolderPath)
}
