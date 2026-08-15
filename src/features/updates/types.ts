export type UpdateCheckSource = 'startup' | 'manual'

export interface UpdateInfo {
  updateId: string
  version: string
  currentVersion: string
  date?: string | undefined
  body?: string | undefined
}

export type UpdateCheckResult =
  | { success: true; outcome: 'available'; update: UpdateInfo }
  | { success: true; outcome: 'none' }
  | { success: true; outcome: 'unsupported' }
  | { success: true; outcome: 'stale'; source: UpdateCheckSource }
  | { success: false; error: string }

export type UpdateInstallResult =
  | { success: true; outcome: 'installed'; relaunch: 'succeeded' }
  | {
      success: true
      outcome: 'installed'
      relaunch: 'manual-restart-required'
      message: string
    }
  | { success: true; outcome: 'unsupported' }
  | { success: false; error: string }

export type UpdateDownloadProgress =
  | { phase: 'idle' }
  | { phase: 'started'; contentLength: number | null }
  | { phase: 'progress'; downloadedBytes: number; contentLength: number | null }
  | { phase: 'finished' }

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking'; source: UpdateCheckSource }
  | { state: 'available'; update: UpdateInfo }
  | {
      state: 'downloading'
      update: UpdateInfo
      progress: UpdateDownloadProgress
    }
  | { state: 'installing'; update: UpdateInfo }
  | {
      state: 'installed'
      update: UpdateInfo
      relaunch: 'succeeded' | 'manual-restart-required'
      message?: string | undefined
    }
  | { state: 'error'; error: string }
  | { state: 'unsupported' }

export interface UpdateStoreState {
  status: UpdateStatus
  lastCheckSource?: UpdateCheckSource | undefined
  hasCheckedThisSession: boolean
  checkForUpdates: (source: UpdateCheckSource) => Promise<UpdateCheckResult>
  installAndRelaunch: (updateId: string) => Promise<UpdateInstallResult>
  clearPendingUpdateState: () => Promise<void>
  resetError: () => void
  resetForProjectClose: () => void
}

export function getIdleUpdateDownloadProgress(): UpdateDownloadProgress {
  return { phase: 'idle' }
}

export function getUpdateProgress(
  status: UpdateStatus,
): UpdateDownloadProgress {
  if (status.state !== 'downloading') {
    return getIdleUpdateDownloadProgress()
  }

  return status.progress
}

export function getUpdateInfoFromStatus(
  status: UpdateStatus,
): UpdateInfo | null {
  switch (status.state) {
    case 'available':
    case 'downloading':
    case 'installing':
    case 'installed':
      return status.update
    case 'idle':
    case 'checking':
    case 'error':
    case 'unsupported':
      return null
  }
}
