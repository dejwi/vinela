import { createStore } from '@/shared/lib/store'
import type {
  UpdateCheckResult,
  UpdateCheckSource,
  UpdateDownloadProgress,
  UpdateInstallResult,
  UpdateStoreState,
} from './types'
import { getIdleUpdateDownloadProgress, getUpdateInfoFromStatus } from './types'
import {
  checkForAvailableUpdate,
  clearPendingUpdateResource,
  installPendingUpdate,
} from './update-service'

interface InFlightCheck {
  promise: Promise<UpdateCheckResult>
}

interface CachedUpdateContext {
  updateId: string
}

let inFlightCheck: InFlightCheck | null = null
let installPromise: Promise<UpdateInstallResult> | null = null
let checkGeneration = 0
let cachedUpdateContext: CachedUpdateContext | null = null

function clearCachedUpdateContext(): void {
  cachedUpdateContext = null
}

function isCachedUpdateContextCurrent(updateId: string): boolean {
  if (cachedUpdateContext === null) {
    return false
  }

  if (cachedUpdateContext.updateId !== updateId) {
    return false
  }

  return true
}

function recordCachedUpdateContext(updateId: string): void {
  cachedUpdateContext = { updateId }
}

function toInvalidatedCheckResult(
  source: UpdateCheckSource,
): UpdateCheckResult {
  return { success: true, outcome: 'stale', source }
}

function normalizeCheckResult(
  result: UpdateCheckResult,
  source: UpdateCheckSource,
  requestGeneration: number,
): UpdateCheckResult {
  if (requestGeneration !== checkGeneration) {
    return toInvalidatedCheckResult(source)
  }

  if (result.success && result.outcome === 'stale') {
    return result
  }

  return result
}

export const useUpdateStore = createStore<UpdateStoreState>((set, get) => ({
  status: { state: 'idle' },
  lastCheckSource: undefined,
  hasCheckedThisSession: false,

  checkForUpdates: async (
    source: UpdateCheckSource,
  ): Promise<UpdateCheckResult> => {
    if (inFlightCheck !== null) {
      return inFlightCheck.promise
    }

    const currentUpdate = getUpdateInfoFromStatus(get().status)
    const currentState = get().status.state

    if (
      currentUpdate !== null &&
      (currentState === 'available' ||
        currentState === 'downloading' ||
        currentState === 'installing')
    ) {
      if (isCachedUpdateContextCurrent(currentUpdate.updateId)) {
        return {
          success: true,
          outcome: 'available',
          update: currentUpdate,
        }
      }

      checkGeneration += 1
      inFlightCheck = null
      clearCachedUpdateContext()
      await clearPendingUpdateResource()
      set((state) => {
        if (state.status.state !== 'unsupported') {
          state.status = { state: 'idle' }
        }
      })

      return toInvalidatedCheckResult(source)
    }

    checkGeneration += 1
    const requestGeneration = checkGeneration
    set((state) => {
      state.status = { state: 'checking', source }
      state.lastCheckSource = source
    })

    const requestPromise = (async (): Promise<UpdateCheckResult> => {
      const rawResult = await checkForAvailableUpdate(source)
      const result = normalizeCheckResult(rawResult, source, requestGeneration)

      set((state) => {
        if (requestGeneration !== checkGeneration) {
          return
        }

        state.hasCheckedThisSession = true
        state.lastCheckSource = source

        if (
          state.status.state === 'downloading' ||
          state.status.state === 'installing'
        ) {
          return
        }

        if (!result.success) {
          clearCachedUpdateContext()
          state.status = { state: 'error', error: result.error }
          return
        }

        switch (result.outcome) {
          case 'available':
            recordCachedUpdateContext(result.update.updateId)
            state.status = { state: 'available', update: result.update }
            return
          case 'none':
            clearCachedUpdateContext()
            state.status = { state: 'idle' }
            return
          case 'unsupported':
            clearCachedUpdateContext()
            state.status = { state: 'unsupported' }
            return
          case 'stale':
            clearCachedUpdateContext()
            return
        }
      })

      return result
    })()

    const trackedPromise = requestPromise.finally(() => {
      if (inFlightCheck?.promise === trackedPromise) {
        inFlightCheck = null
      }
    })

    inFlightCheck = {
      promise: trackedPromise,
    }

    return trackedPromise
  },

  installAndRelaunch: async (
    updateId: string,
  ): Promise<UpdateInstallResult> => {
    if (installPromise !== null) {
      return installPromise
    }

    const currentUpdate = getUpdateInfoFromStatus(get().status)
    if (currentUpdate !== null) {
      set((state) => {
        state.status = {
          state: 'downloading',
          update: currentUpdate,
          progress: getIdleUpdateDownloadProgress(),
        }
      })
    }

    const updateProgress = (progress: UpdateDownloadProgress): void => {
      set((state) => {
        const update = getUpdateInfoFromStatus(state.status)
        if (update === null || update.updateId !== updateId) {
          return
        }

        if (progress.phase === 'finished') {
          state.status = { state: 'installing', update }
          return
        }

        state.status = { state: 'downloading', update, progress }
      })
    }

    const requestPromise = (async (): Promise<UpdateInstallResult> => {
      const result = await installPendingUpdate(updateId, updateProgress)

      set((state) => {
        const currentStateUpdate = getUpdateInfoFromStatus(state.status)
        const update = currentStateUpdate ?? currentUpdate

        if (!result.success) {
          state.status = { state: 'error', error: result.error }
          return
        }

        if (result.outcome === 'unsupported') {
          state.status = { state: 'unsupported' }
          return
        }

        if (update === null) {
          state.status = { state: 'idle' }
          return
        }

        if (result.relaunch === 'manual-restart-required') {
          state.status = {
            state: 'installed',
            update,
            relaunch: 'manual-restart-required',
            message: result.message,
          }
          return
        }

        state.status = {
          state: 'installed',
          update,
          relaunch: 'succeeded',
        }
      })

      return result
    })()

    const trackedPromise = requestPromise.finally(() => {
      if (installPromise === trackedPromise) {
        installPromise = null
      }
    })

    installPromise = trackedPromise
    return trackedPromise
  },

  clearPendingUpdateState: async (): Promise<void> => {
    checkGeneration += 1
    inFlightCheck = null
    clearCachedUpdateContext()
    await clearPendingUpdateResource()

    set((state) => {
      if (state.status.state === 'unsupported') {
        return
      }

      state.status = { state: 'idle' }
    })
  },

  resetError: (): void => {
    set((state) => {
      if (state.status.state === 'error') {
        state.status = { state: 'idle' }
      }
    })
  },

  resetForProjectClose: (): void => {
    // App-scoped state: intentionally no-op.
  },
}))

export function _resetUpdateStoreForTests(): void {
  inFlightCheck = null
  installPromise = null
  checkGeneration = 0
  cachedUpdateContext = null
  useUpdateStore.setState(
    {
      status: { state: 'idle' },
      lastCheckSource: undefined,
      hasCheckedThisSession: false,
    },
    false,
  )
}
