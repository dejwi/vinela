// Types

export {
  createBackup,
  deleteBackup,
  enforceRetention,
  listBackups,
  openBackupFolder,
  restoreBackup,
} from './backup'
// Components
export { BackupManager, BackupRestoreDialog, NeovimStatus } from './components'

// Functions
export { detectNeovim } from './detection'
// Hooks
export { useBackups, useNeovimStatus } from './hooks'
export type {
  BackupInfo,
  BackupMetadata,
  BackupResult,
  BackupsState,
  DeleteBackupResult,
  ListBackupsResult,
  NeovimDetectionErrorCode,
  NeovimDetectionResult,
  NeovimStatusState,
  RestoreResult,
  SkipReason,
} from './types'
export { GENERATED_CONFIG_MARKER, MAX_BACKUPS } from './types'
