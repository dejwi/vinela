export interface GitSnapshot {
  headOid: string | null
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  changedFiles: number
  conflictedFiles: number
}

export type GitRepositoryState =
  | { status: 'inactive' }
  | { status: 'checking' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: GitSnapshot }

export type GitOperation = 'fetching' | 'pulling' | 'committing' | 'pushing'

export type GitCommandResult =
  | { success: true; stdout: string }
  | { success: false; error: string }

export type GitSnapshotResult =
  | { success: true; snapshot: GitSnapshot }
  | { success: false; error: string }

export type GitInspectResult =
  | { success: true; repository: false }
  | { success: true; repository: true; snapshot: GitSnapshot }
  | { success: false; error: string }

export type GitActionResult =
  | { success: true; didPull: boolean }
  | { success: false; error: string; didPull: boolean }
