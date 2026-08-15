import { useCallback, useEffect, useRef, useState } from 'react'
import { expandPath } from '@/features/lua-generator/deploy/path-resolution'
import { isMemoryMode } from '@/shared/lib/storage'
import { deleteBackup, listBackups, restoreBackup } from '../backup'
import type {
  BackupInfo,
  BackupsState,
  DeleteBackupResult,
  RestoreResult,
} from '../types'

interface UseBackupsReturn {
  /** Current backups state */
  state: BackupsState
  /** Reload backups list */
  refresh: () => Promise<void>
  /** Restore a backup */
  restore: (
    backupId: string,
    targetPath: string,
    neovimVersion: string,
  ) => Promise<RestoreResult>
  /** Delete a backup */
  remove: (backupId: string) => Promise<DeleteBackupResult>
  /** Whether currently loading */
  isLoading: boolean
  /** Shorthand: backups list if loaded */
  backups: BackupInfo[]
}

/**
 * Hook for managing backups.
 *
 * @param outputPath - The Neovim output path (used to derive backup folder location)
 */
export function useBackups(outputPath: string): UseBackupsReturn {
  const [state, setState] = useState<BackupsState>({ status: 'idle' })
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const refresh = useCallback(async (): Promise<void> => {
    // Memory mode: backups not available
    if (isMemoryMode()) {
      if (isMounted.current) {
        setState({ status: 'loaded', backups: [] })
      }
      return
    }

    if (isMounted.current) {
      setState({ status: 'loading' })
    }

    try {
      const expandedPath = await expandPath(outputPath)
      const result = await listBackups(expandedPath)
      if (!isMounted.current) return

      if (result.success) {
        setState({ status: 'loaded', backups: result.backups })
      } else {
        setState({ status: 'error', error: result.error })
      }
    } catch (error) {
      if (!isMounted.current) return
      setState({
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Failed to load backups',
      })
    }
  }, [outputPath])

  // Load on mount
  useEffect(() => {
    void refresh()
  }, [refresh])

  const restore = useCallback(
    async (
      backupId: string,
      targetPath: string,
      neovimVersion: string,
    ): Promise<RestoreResult> => {
      const result = await restoreBackup(backupId, targetPath, neovimVersion)
      if (result.success) {
        // Refresh list after restore (a new backup may have been created)
        await refresh()
      }
      return result
    },
    [refresh],
  )

  const remove = useCallback(
    async (backupId: string): Promise<DeleteBackupResult> => {
      const expandedPath = await expandPath(outputPath)
      const result = await deleteBackup(backupId, expandedPath)
      if (result.success) {
        await refresh()
      }
      return result
    },
    [refresh, outputPath],
  )

  const isLoading = state.status === 'loading'
  const backups = state.status === 'loaded' ? state.backups : []

  return { state, refresh, restore, remove, isLoading, backups }
}
