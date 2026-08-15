// src/features/lua-generator/deploy/deploy.ts

import {
  createBackup,
  detectNeovim,
  GENERATED_CONFIG_MARKER,
} from '@/features/neovim'
import {
  deployToPath,
  fileUidDirect,
  pathExistsDirect,
  readTextFileDirect,
} from '@/shared/lib/direct-fs'
import { isMemoryMode } from '@/shared/lib/storage'
import type { DeployRequest, DeployResult } from '../types'
import { resolveOutputPath } from './path-resolution'

const PARENT_DIRECTORY_ERROR_PREFIX = 'Failed to create parent directory'

function normalizeBackendError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string' && error.length > 0) {
    return error
  }
  return 'Unknown write error'
}

function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('permission') ||
    message.includes('EACCES') ||
    message.includes('EPERM')
  )
}

function mapDeployWriteError(
  error: unknown,
  outputPath: string,
  parentDir: string,
): Extract<DeployResult, { success: false }> {
  const message = normalizeBackendError(error)

  if (message.startsWith(PARENT_DIRECTORY_ERROR_PREFIX)) {
    return {
      success: false,
      error: `Could not create output directory for ${outputPath} (parent ${parentDir}): ${message}`,
      errorCode: 'directory-creation-failed',
    }
  }

  if (isPermissionError(message)) {
    return {
      success: false,
      error: `Permission denied: cannot write to ${outputPath}. Check file permissions.`,
      errorCode: 'permission-denied',
    }
  }

  return {
    success: false,
    error: `Failed to write init.lua: ${message}`,
    errorCode: 'write-failed',
  }
}

/**
 * Deploy generated init.lua to the Neovim config directory.
 *
 * Safety guarantees:
 * - Memory mode is blocked (no filesystem access)
 * - Existing configs are backed up unless ownership is verified
 * - Backup failure aborts deploy (never overwrites without backup)
 * - Parent directory is created if it doesn't exist
 * - Write is verified after completion
 *
 * @param request - Deploy request payload from Domain 8
 */
export async function deployGeneratedConfig(
  request: DeployRequest,
): Promise<DeployResult> {
  // ── Step 1: Memory mode guard ──────────────────────────────────
  if (isMemoryMode()) {
    return {
      success: false,
      error:
        'Deploy is not available in browser mode. Use the desktop app to deploy.',
      errorCode: 'memory-mode',
    }
  }

  try {
    // ── Step 2: Resolve output path ────────────────────────────────
    const pathResult = await resolveOutputPath()
    if (!pathResult.resolved) {
      return {
        success: false,
        error: pathResult.error,
        errorCode: 'no-output-path',
      }
    }

    const { outputPath, parentDir } = pathResult
    const code = request.initLua

    // ── Step 3: Check existing config ──────────────────────────────
    let backupCreated = false
    let backupPath: string | undefined

    const configExists = await pathExistsDirect(outputPath).catch(() => false)

    if (configExists) {
      const isOurFile = await checkIsOurOwnedGeneratedConfig(outputPath)

      // ── Step 4: Backup unless ownership is verified ─────────────────
      if (!isOurFile) {
        // Get Neovim version for backup metadata (best-effort)
        const neovimVersion = await getNeovimVersionForBackup()

        const backupResult = await createBackup(outputPath, neovimVersion, true)

        if (!backupResult.success) {
          // CRITICAL: Backup failed — abort deploy to protect user data
          return {
            success: false,
            error: `Cannot deploy: backup of existing config failed. ${backupResult.error}`,
            errorCode: 'backup-failed',
          }
        }

        // Backup creation is mandatory in this branch.
        if ('backup' in backupResult) {
          backupCreated = true
          backupPath = backupResult.backup.backupPath
        } else {
          return {
            success: false,
            error: 'Cannot deploy: backup did not produce a backup artifact.',
            errorCode: 'backup-failed',
          }
        }
      }
      // If ownership is verified, skip backup entirely (replaceable)
    }

    // ── Step 5: Deploy via direct Rust std::fs ────────────────────
    // Bypasses plugin-fs scope entirely — immune to symlink mismatch issues.
    try {
      await deployToPath(parentDir, outputPath, code)
    } catch (writeError) {
      return mapDeployWriteError(writeError, outputPath, parentDir)
    }

    // ── Step 6: Verify write ─────────────────────────────────────
    try {
      const written = await readTextFileDirect(outputPath)
      const firstLine = written.split('\n')[0]?.trim() ?? ''
      if (!firstLine.startsWith(GENERATED_CONFIG_MARKER)) {
        console.warn(
          'Deploy verification: written file does not start with marker comment. File may have been modified by another process.',
        )
      }
    } catch {
      // Verification failure is non-fatal — file was written successfully
      console.warn('Deploy verification: could not read back deployed file.')
    }

    // ── Step 7: Return success ───────────────────────────────────
    return {
      success: true,
      outputPath,
      backupCreated,
      backupPath,
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Deploy failed unexpectedly',
      errorCode: 'write-failed',
    }
  }
}

// ── Internal Helpers ───────────────────────────────────────────────

/**
 * Check if an existing config file is both generated by vinela
 * and owned by the current user.
 */
async function checkIsOurOwnedGeneratedConfig(
  configPath: string,
): Promise<boolean> {
  try {
    const content = await readTextFileDirect(configPath)
    const firstLine = content.split('\n')[0]?.trim() ?? ''
    if (!firstLine.startsWith(GENERATED_CONFIG_MARKER)) {
      return false
    }

    const ownership = await verifyFileOwnership(configPath)
    return ownership.ownedByCurrentUser
  } catch {
    // If we can't read or verify, assume it's not ours (safer to backup)
    return false
  }
}

/**
 * Verify output file ownership for marker-based overwrite safety.
 * Uses fileUidDirect so both calls bypass plugin-fs scope checking.
 * If ownership cannot be proven, return false (conservative).
 */
async function verifyFileOwnership(
  path: string,
): Promise<{ ownedByCurrentUser: boolean; reason?: string }> {
  try {
    const fileUid = await fileUidDirect(path)
    const { homeDir } = await import('@tauri-apps/api/path')
    const home = await homeDir()
    const homeUid = await fileUidDirect(home)

    if (fileUid == null || homeUid == null) {
      return { ownedByCurrentUser: false, reason: 'uid-unavailable' }
    }

    if (fileUid !== homeUid) {
      return { ownedByCurrentUser: false, reason: 'uid-mismatch' }
    }

    return { ownedByCurrentUser: true }
  } catch (error) {
    return {
      ownedByCurrentUser: false,
      reason: error instanceof Error ? error.message : 'ownership-check-failed',
    }
  }
}

/**
 * Get the Neovim version for backup metadata.
 * Best-effort: returns 'unknown' if detection fails.
 */
async function getNeovimVersionForBackup(): Promise<string> {
  try {
    const result = await detectNeovim()
    if (result.found) {
      return result.version
    }
    return 'unknown'
  } catch {
    return 'unknown'
  }
}
