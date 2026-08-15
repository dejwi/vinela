import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { isTauriAvailable } from '@/shared/lib/tauri-runtime'
import { CHECK_FOR_UPDATES_EVENT } from '../events'
import { useUpdateStore } from '../store'
import type {
  UpdateCheckResult,
  UpdateDownloadProgress,
  UpdateInfo,
  UpdateStatus,
} from '../types'
import { getUpdateProgress } from '../types'

const STARTUP_CHECK_DELAY_MS = 4_000
const MANUAL_CHECK_TOAST_ID = 'updates-manual-check'

interface ActiveUpdateToast {
  toastId: string
  updateId: string
}

function buildAvailableUpdateDescription(update: UpdateInfo): string {
  const summary = update.body?.split('\n').find((line) => line.trim() !== '')
  if (summary !== undefined && summary.trim() !== '') {
    return `Current version ${update.currentVersion}. ${summary.trim()}`
  }

  return `Current version ${update.currentVersion}.`
}

function buildProgressMessage(progress: UpdateDownloadProgress): string {
  switch (progress.phase) {
    case 'idle':
      return 'Preparing download…'
    case 'started':
      return 'Downloading update…'
    case 'progress': {
      if (progress.contentLength === null || progress.contentLength <= 0) {
        return 'Downloading update…'
      }

      const percentage = Math.min(
        100,
        Math.round((progress.downloadedBytes / progress.contentLength) * 100),
      )
      return `Downloading update… ${percentage}%`
    }
    case 'finished':
      return 'Installing update…'
  }
}

function isUpdateStatusWithToast(
  status: UpdateStatus,
): status is
  | Extract<UpdateStatus, { state: 'available' }>
  | Extract<UpdateStatus, { state: 'downloading' }>
  | Extract<UpdateStatus, { state: 'installing' }>
  | Extract<UpdateStatus, { state: 'installed' }> {
  return (
    status.state === 'available' ||
    status.state === 'downloading' ||
    status.state === 'installing' ||
    status.state === 'installed'
  )
}

export function UpdateManager() {
  const status = useUpdateStore((state) => state.status)
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates)
  const installAndRelaunch = useUpdateStore((state) => state.installAndRelaunch)
  const activeToastRef = useRef<ActiveUpdateToast | null>(null)

  const dismissActiveToast = useCallback((): void => {
    if (activeToastRef.current === null) {
      return
    }

    toast.dismiss(activeToastRef.current.toastId)
    activeToastRef.current = null
  }, [])

  const handleInstall = useCallback(
    async (updateId: string): Promise<void> => {
      const result = await installAndRelaunch(updateId)

      if (!result.success) {
        toast.error(result.error, {
          id: activeToastRef.current?.toastId ?? updateId,
        })
        return
      }

      if (result.outcome === 'unsupported') {
        toast.info('Updates are only available in the packaged desktop app.', {
          id: activeToastRef.current?.toastId ?? updateId,
        })
      }
    },
    [installAndRelaunch],
  )

  const showAvailableUpdateToast = useCallback(
    (update: UpdateInfo): void => {
      const toastId = `update-${update.updateId}`
      if (activeToastRef.current?.updateId !== update.updateId) {
        dismissActiveToast()
      }

      activeToastRef.current = { toastId, updateId: update.updateId }

      toast(`vinela ${update.version} is available`, {
        id: toastId,
        duration: Number.POSITIVE_INFINITY,
        description: buildAvailableUpdateDescription(update),
        action: {
          label: 'Install and relaunch',
          onClick: () => {
            void handleInstall(update.updateId)
          },
        },
        cancel: {
          label: 'Later',
          onClick: () => {
            toast.dismiss(toastId)
            if (activeToastRef.current?.updateId === update.updateId) {
              activeToastRef.current = null
            }
          },
        },
      })
    },
    [dismissActiveToast, handleInstall],
  )

  const handleManualResult = useCallback(
    (result: UpdateCheckResult): void => {
      if (!result.success) {
        toast.error(result.error, { id: MANUAL_CHECK_TOAST_ID })
        return
      }

      switch (result.outcome) {
        case 'none':
          toast.success("You're up to date", { id: MANUAL_CHECK_TOAST_ID })
          return
        case 'unsupported':
          toast.info(
            'Updates are only available in the packaged desktop app.',
            {
              id: MANUAL_CHECK_TOAST_ID,
            },
          )
          return
        case 'available':
          toast.dismiss(MANUAL_CHECK_TOAST_ID)
          showAvailableUpdateToast(result.update)
          return
        case 'stale':
          toast.dismiss(MANUAL_CHECK_TOAST_ID)
          return
      }
    },
    [showAvailableUpdateToast],
  )

  const runManualCheck = useCallback(async (): Promise<void> => {
    toast.loading('Checking for updates…', { id: MANUAL_CHECK_TOAST_ID })
    const result = await checkForUpdates('manual')
    handleManualResult(result)
  }, [checkForUpdates, handleManualResult])

  useEffect(() => {
    if (!isTauriAvailable()) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      void checkForUpdates('startup')
    }, STARTUP_CHECK_DELAY_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [checkForUpdates])

  useEffect(() => {
    if (!isTauriAvailable()) {
      return undefined
    }

    let isDisposed = false
    let unlisten: (() => void) | null = null

    void listen(CHECK_FOR_UPDATES_EVENT, () => runManualCheck())
      .then((cleanup) => {
        if (isDisposed) {
          cleanup()
          return
        }

        unlisten = cleanup
      })
      .catch((error: unknown) => {
        console.warn('[updates] Failed to register update menu listener', error)
      })

    return () => {
      isDisposed = true
      unlisten?.()
    }
  }, [runManualCheck])

  useEffect(() => {
    if (!isUpdateStatusWithToast(status)) {
      dismissActiveToast()
      return
    }

    const toastId = `update-${status.update.updateId}`
    if (activeToastRef.current?.updateId !== status.update.updateId) {
      dismissActiveToast()
    }

    switch (status.state) {
      case 'available':
        showAvailableUpdateToast(status.update)
        return
      case 'downloading':
        toast.loading(buildProgressMessage(getUpdateProgress(status)), {
          id: toastId,
          duration: Number.POSITIVE_INFINITY,
        })
        return
      case 'installing':
        toast.loading('Installing update…', {
          id: toastId,
          duration: Number.POSITIVE_INFINITY,
        })
        return
      case 'installed':
        if (status.relaunch === 'manual-restart-required') {
          toast.success('Update installed — restart vinela to finish.', {
            id: toastId,
            duration: Number.POSITIVE_INFINITY,
            description: status.message,
          })
        } else {
          toast.success('Update installed — relaunching…', {
            id: toastId,
            duration: 4_000,
          })
        }
        activeToastRef.current = null
        return
    }
  }, [dismissActiveToast, showAvailableUpdateToast, status])

  return null
}
