import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import type { BackupInfo } from '../types'

interface BackupRestoreDialogProps {
  backup: BackupInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isRestoring: boolean
}

export function BackupRestoreDialog({
  backup,
  open,
  onOpenChange,
  onConfirm,
  isRestoring,
}: BackupRestoreDialogProps): React.JSX.Element | null {
  if (!backup) {
    return null
  }

  const date = new Date(backup.createdAt).toLocaleString()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore Backup?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will restore your Neovim config from the backup created on{' '}
                <strong>{date}</strong>.
              </p>

              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-xs font-medium">Restore to:</p>
                <code className="text-xs">{backup.sourcePath}</code>
              </div>

              <p className="text-sm">
                A safety backup of your current config will be created first. If
                the safety backup fails, the restore will be cancelled.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isRestoring}>
            {isRestoring ? 'Restoring...' : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
