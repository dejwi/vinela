import {
  AlertTriangle,
  Archive,
  FolderOpen,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { expandPath } from '@/features/lua-generator/deploy/path-resolution'
import { useAppSettings } from '@/features/settings/hooks/useAppSettings'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { getDefaultNeovimOutputPath } from '@/shared/lib/settings'
import { isMemoryMode } from '@/shared/lib/storage'
import { openBackupFolder } from '../backup'
import { useBackups, useNeovimStatus } from '../hooks'
import type { BackupInfo } from '../types'
import { MAX_BACKUPS } from '../types'
import { BackupRestoreDialog } from './BackupRestoreDialog'

/**
 * Format a date as relative time using native Intl.RelativeTimeFormat.
 * No date-fns dependency required.
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diffMs = date.getTime() - now
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHour = Math.round(diffMin / 60)
  const diffDay = Math.round(diffHour / 24)

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, 'second')
  }
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute')
  }
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, 'hour')
  }
  return rtf.format(diffDay, 'day')
}

export function BackupManager(): React.JSX.Element {
  // Get output path from settings (source of truth)
  const { settings } = useAppSettings()
  const outputPath = settings?.neovimOutputPath ?? getDefaultNeovimOutputPath()

  const { state, backups, isLoading, restore, remove } = useBackups(outputPath)
  const { result: neovimResult } = useNeovimStatus()
  const [restoreTarget, setRestoreTarget] = useState<BackupInfo | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Memory mode
  if (isMemoryMode()) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm">
          Backups are not available in browser mode
        </span>
      </div>
    )
  }

  // Loading
  if (isLoading || state.status === 'idle') {
    return <BackupManagerSkeleton />
  }

  // Error
  if (state.status === 'error') {
    return (
      <div className="text-sm text-destructive py-4">
        Failed to load backups: {state.error}
      </div>
    )
  }

  // No backups
  if (backups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Archive className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No backups yet. Backups are created when you generate a config and an
          existing non-generated config is found.
        </p>
      </div>
    )
  }

  const handleRestore = async (backup: BackupInfo): Promise<void> => {
    if (!neovimResult?.found) {
      toast.error('Cannot restore: Neovim not detected')
      return
    }

    setIsRestoring(true)
    const result = await restore(
      backup.id,
      backup.sourcePath,
      neovimResult.version,
    )
    setIsRestoring(false)
    setRestoreTarget(null)

    if (result.success) {
      toast.success('Backup restored successfully')
    } else {
      toast.error('Failed to restore backup', { description: result.error })
    }
  }

  const handleDelete = async (backupId: string): Promise<void> => {
    setDeletingId(backupId)
    const result = await remove(backupId)
    setDeletingId(null)

    if (result.success) {
      toast.success('Backup deleted')
    } else {
      toast.error('Failed to delete backup', { description: result.error })
    }
  }

  const handleOpenFolder = async (): Promise<void> => {
    try {
      const expandedPath = await expandPath(outputPath)
      await openBackupFolder(expandedPath)
    } catch (error) {
      let message: string
      if (error instanceof Error) {
        message = error.message
      } else if (typeof error === 'string') {
        message = error
      } else {
        message = 'Unknown error'
      }
      toast.error('Failed to open backup folder', {
        description: message,
      })
    }
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header with Open Folder button */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Backups</h4>
          {backups.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleOpenFolder()}
              title="Open backup folder"
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Open Folder
            </Button>
          )}
        </div>

        {/* Backup list */}
        <div className="rounded-lg border divide-y">
          {backups.map((backup) => (
            <BackupRow
              key={backup.id}
              backup={backup}
              onRestore={() => setRestoreTarget(backup)}
              onDelete={() => void handleDelete(backup.id)}
              isDeleting={deletingId === backup.id}
            />
          ))}
        </div>

        {/* Info text */}
        <p className="text-xs text-muted-foreground">
          {MAX_BACKUPS} backups maximum. Oldest backups are automatically
          deleted.
        </p>
      </div>

      {/* Restore confirmation dialog */}
      <BackupRestoreDialog
        backup={restoreTarget}
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null)
        }}
        onConfirm={() => {
          if (restoreTarget) {
            void handleRestore(restoreTarget)
          }
        }}
        isRestoring={isRestoring}
      />
    </>
  )
}

interface BackupRowProps {
  backup: BackupInfo
  onRestore: () => void
  onDelete: () => void
  isDeleting: boolean
}

function BackupRow({
  backup,
  onRestore,
  onDelete,
  isDeleting,
}: BackupRowProps): React.JSX.Element {
  const date = new Date(backup.createdAt)
  const relativeTime = formatRelativeTime(date)
  const absoluteTime = date.toLocaleString()
  const sizeKB = (backup.sizeBytes / 1024).toFixed(1)

  return (
    <div className="flex items-center justify-between p-3 gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">init.lua</span>
          <span className="text-xs text-muted-foreground">({sizeKB} KB)</span>
        </div>
        <p className="text-xs text-muted-foreground" title={absoluteTime}>
          {relativeTime} · Neovim {backup.neovimVersion}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRestore}
          title="Restore this backup"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete this backup"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function BackupManagerSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  )
}
