import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'
import { isTauriAvailable } from '@/shared/lib/tauri-runtime'
import type {
  UpdateCheckResult,
  UpdateCheckSource,
  UpdateDownloadProgress,
  UpdateInfo,
  UpdateInstallResult,
} from './types'

const UPDATE_TIMEOUT_MS = 30_000

interface PendingUpdateResource {
  updateId: string
  version: string
  update: Update
}

let pendingUpdateResource: PendingUpdateResource | null = null
let fallbackUpdateIdCounter = 0
let updateCheckResourceGeneration = 0

function beginUpdateCheckResourceGeneration(): number {
  updateCheckResourceGeneration += 1
  return updateCheckResourceGeneration
}

function isCurrentUpdateCheckResourceGeneration(generation: number): boolean {
  return generation === updateCheckResourceGeneration
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function createUpdateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  fallbackUpdateIdCounter += 1
  return `update-${fallbackUpdateIdCounter}`
}

function toUpdateInfo(updateId: string, update: Update): UpdateInfo {
  return {
    updateId,
    version: update.version,
    currentVersion: update.currentVersion,
    date: update.date,
    body: update.body,
  }
}

async function disposeUpdateResource(update: Update): Promise<void> {
  try {
    await update.close()
  } catch {
    // Ignore resource cleanup failures.
  }
}

async function replacePendingUpdateResource(
  nextResource: PendingUpdateResource | null,
): Promise<void> {
  const previousResource = pendingUpdateResource
  pendingUpdateResource = nextResource

  if (
    previousResource !== null &&
    previousResource.updateId !== nextResource?.updateId
  ) {
    await disposeUpdateResource(previousResource.update)
  }
}

function mapDownloadEvent(
  event: DownloadEvent,
  downloadedBytes: number,
): { progress: UpdateDownloadProgress; downloadedBytes: number } {
  switch (event.event) {
    case 'Started':
      return {
        progress: {
          phase: 'started',
          contentLength: event.data.contentLength ?? null,
        },
        downloadedBytes: 0,
      }
    case 'Progress': {
      const nextDownloadedBytes = downloadedBytes + event.data.chunkLength
      return {
        progress: {
          phase: 'progress',
          downloadedBytes: nextDownloadedBytes,
          contentLength: null,
        },
        downloadedBytes: nextDownloadedBytes,
      }
    }
    case 'Finished':
      return {
        progress: { phase: 'finished' },
        downloadedBytes,
      }
  }
}

export async function clearPendingUpdateResource(): Promise<void> {
  updateCheckResourceGeneration += 1
  await replacePendingUpdateResource(null)
}

export async function checkForAvailableUpdate(
  source: UpdateCheckSource,
): Promise<UpdateCheckResult> {
  if (!isTauriAvailable()) {
    return { success: true, outcome: 'unsupported' }
  }

  const resourceGeneration = beginUpdateCheckResourceGeneration()

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check({ timeout: UPDATE_TIMEOUT_MS })

    if (!isCurrentUpdateCheckResourceGeneration(resourceGeneration)) {
      if (update !== null) {
        await disposeUpdateResource(update)
      }
      return { success: true, outcome: 'stale', source }
    }

    if (update === null) {
      await replacePendingUpdateResource(null)
      return { success: true, outcome: 'none' }
    }

    const updateId = createUpdateId()
    await replacePendingUpdateResource({
      updateId,
      version: update.version,
      update,
    })

    return {
      success: true,
      outcome: 'available',
      update: toUpdateInfo(updateId, update),
    }
  } catch (error) {
    if (!isCurrentUpdateCheckResourceGeneration(resourceGeneration)) {
      return { success: true, outcome: 'stale', source }
    }

    return {
      success: false,
      error: toErrorMessage(error),
    }
  }
}

export async function installPendingUpdate(
  expectedUpdateId: string,
  onProgress: (progress: UpdateDownloadProgress) => void,
): Promise<UpdateInstallResult> {
  if (!isTauriAvailable()) {
    return { success: true, outcome: 'unsupported' }
  }

  const resource = pendingUpdateResource

  if (resource === null) {
    return {
      success: false,
      error: 'Selected update is no longer available. Check for updates again.',
    }
  }

  if (resource.updateId !== expectedUpdateId) {
    return {
      success: false,
      error: 'Selected update changed. Check for updates again.',
    }
  }

  let downloadedBytes = 0
  let startedContentLength: number | null = null

  try {
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await resource.update.downloadAndInstall((event) => {
      const mappedEvent = mapDownloadEvent(event, downloadedBytes)
      downloadedBytes = mappedEvent.downloadedBytes

      if (event.event === 'Started') {
        startedContentLength = event.data.contentLength ?? null
      }

      if (event.event === 'Progress') {
        onProgress({
          phase: 'progress',
          downloadedBytes,
          contentLength: startedContentLength,
        })
        return
      }

      onProgress(mappedEvent.progress)
    })

    await replacePendingUpdateResource(null)

    try {
      await relaunch()
      return { success: true, outcome: 'installed', relaunch: 'succeeded' }
    } catch (error) {
      return {
        success: true,
        outcome: 'installed',
        relaunch: 'manual-restart-required',
        message: toErrorMessage(error),
      }
    }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error),
    }
  }
}

export async function _resetUpdateServiceForTests(): Promise<void> {
  updateCheckResourceGeneration = 0
  await replacePendingUpdateResource(null)
  fallbackUpdateIdCounter = 0
}

export function _getPendingUpdateIdForTests(): string | null {
  return pendingUpdateResource?.updateId ?? null
}
