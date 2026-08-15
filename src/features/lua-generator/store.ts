// Type helper for immer stores (no undo needed)
import { createStore } from '@/shared/lib/store'
import type {
  TargetNeovimPreflightState,
  TargetNeovimSnapshot,
} from './lib/target-neovim'
import { resolveTargetNeovimSnapshot } from './lib/target-neovim'
import type {
  DeployResult,
  GenerationDiagnostic,
  GenerationDialogPhase,
  GenerationPhase,
  GenerationResult,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Timeout Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Dynamic import timeout (10 seconds). Prevents indefinite hang if chunk fails to load. */
const IMPORT_TIMEOUT_MS = 10_000

/** Overall generation timeout (60 seconds). Safety net for hung operations. */
const GENERATION_TIMEOUT_MS = 60_000

/**
 * Wrap a dynamic import with a timeout.
 * In Vite preview builds, a failed chunk load can result in a permanently
 * pending Promise (no rejection). This ensures we always get a result or error.
 */
function importWithTimeout<T>(
  importFn: () => Promise<T>,
  timeoutMs: number = IMPORT_TIMEOUT_MS,
): Promise<T> {
  return Promise.race([
    importFn(),
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`Module import timed out after ${timeoutMs}ms`)),
        timeoutMs,
      )
    }),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationState {
  // State
  dialogOpen: boolean
  dialogPhase: GenerationDialogPhase
  targetNeovimPreflight: TargetNeovimPreflightState
  lastResult: GenerationResult | null
  lastGeneratedAt: number | null
  lastDeployResult: DeployResult | null
  lastDeployedAt: number | null

  // Non-serializable runtime control
  activeAbortController: AbortController | null

  openDialog: () => void
  closeDialog: () => void
  beginTargetNeovimPreflight: () => void
  restartGenerationPreflight: () => void
  generate: () => Promise<void>
  cancelGeneration: () => void
  deploy: (projectId: string, projectPath: string) => Promise<void>
  resetForProjectClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store Implementation
// ─────────────────────────────────────────────────────────────────────────────

let generationCounter = 0
let preflightRequestCounter = 0

function invalidatePreflightRequests(): void {
  preflightRequestCounter += 1
}

function nextPreflightRequestId(): number {
  preflightRequestCounter += 1
  return preflightRequestCounter
}

function captureReadyTargetNeovimSnapshot(
  state: GenerationState,
): TargetNeovimSnapshot | null {
  const preflight = state.targetNeovimPreflight
  if (preflight.kind !== 'ready') {
    return null
  }
  return preflight.snapshot
}

export const useGenerationStore = createStore<GenerationState>((set, get) => ({
  dialogOpen: false,
  dialogPhase: { type: 'pre-flight' },
  targetNeovimPreflight: { kind: 'idle' },
  lastResult: null,
  lastGeneratedAt: null,
  lastDeployResult: null,
  lastDeployedAt: null,
  activeAbortController: null,

  openDialog: () => {
    set((state) => {
      state.dialogOpen = true
      if (state.lastResult !== null) {
        state.dialogPhase = {
          type: 'generation',
          progress: { type: 'complete', result: state.lastResult },
        }
      } else {
        state.dialogPhase = { type: 'pre-flight' }
      }
    })
    get().beginTargetNeovimPreflight()
  },

  closeDialog: () => {
    // Closing allowed only when no active generation/deploy work
    const phase = get().dialogPhase
    if (phase.type === 'generation') {
      const p = phase.progress.type
      if (p !== 'complete' && p !== 'error' && p !== 'idle') return
    }
    if (phase.type === 'deploying') return
    set((state) => {
      state.dialogOpen = false
      state.targetNeovimPreflight = { kind: 'idle' }
    })
  },

  beginTargetNeovimPreflight: () => {
    const requestId = nextPreflightRequestId()

    set((state) => {
      state.targetNeovimPreflight = { kind: 'loading', requestId }
    })

    void resolveTargetNeovimSnapshot()
      .then((snapshot) => {
        if (preflightRequestCounter !== requestId) {
          return
        }
        const { dialogOpen, dialogPhase } = get()
        if (!dialogOpen || dialogPhase.type !== 'pre-flight') {
          return
        }
        set((state) => {
          state.targetNeovimPreflight = {
            kind: 'ready',
            requestId,
            snapshot,
          }
        })
      })
      .catch(() => {
        if (preflightRequestCounter !== requestId) {
          return
        }
        const { dialogOpen, dialogPhase } = get()
        if (!dialogOpen || dialogPhase.type !== 'pre-flight') {
          return
        }
        set((state) => {
          state.targetNeovimPreflight = {
            kind: 'ready',
            requestId,
            snapshot: { kind: 'undetected', reason: 'execution-failed' },
          }
        })
      })
  },

  restartGenerationPreflight: () => {
    if (selectIsOperationInProgress(get())) {
      return
    }

    set((state) => {
      state.dialogPhase = { type: 'pre-flight' }
      if (state.lastResult !== null) {
        state.lastResult = null
      }
      state.targetNeovimPreflight = { kind: 'idle' }
    })

    get().beginTargetNeovimPreflight()
  },

  generate: async () => {
    const targetNeovim = captureReadyTargetNeovimSnapshot(get())
    if (targetNeovim === null) {
      return
    }

    generationCounter += 1
    const runId = generationCounter

    // Cancel previous run if still active
    get().activeAbortController?.abort()
    const controller = new AbortController()

    set((state) => {
      state.activeAbortController = controller
      state.dialogPhase = {
        type: 'generation',
        progress: { type: 'validating', checkName: 'prepare-context' },
      }
    })

    try {
      const { useProjectStore } = await importWithTimeout(
        () => import('@/features/projects/store'),
      )
      const projectPath =
        useProjectStore.getState().currentProject?.absolutePath

      if (projectPath === undefined) {
        if (runId === generationCounter) {
          set((state) => {
            state.dialogPhase = {
              type: 'generation',
              progress: {
                type: 'error',
                error: 'No active project path available',
              },
            }
            state.activeAbortController = null
          })
        }
        return
      }

      const { generateInitLua } = await importWithTimeout(
        () => import('./orchestrator'),
      )

      // Race generation against an overall timeout.
      // On timeout, abort the controller so the orchestrator can clean up.
      const result = await Promise.race([
        generateInitLua({
          projectPath,
          signal: controller.signal,
          targetNeovim,
          onProgress: (progress: GenerationPhase) => {
            if (runId !== generationCounter) return
            set((state) => {
              state.dialogPhase = { type: 'generation', progress }
            })
          },
        }),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            controller.abort()
            reject(
              new Error(
                `Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s`,
              ),
            )
          }, GENERATION_TIMEOUT_MS)
        }),
      ])

      if (runId === generationCounter) {
        set((state) => {
          state.dialogPhase = {
            type: 'generation',
            progress: { type: 'complete', result },
          }
          state.lastResult = result
          state.lastGeneratedAt = Date.now()
        })
      }
    } catch (err) {
      if (runId === generationCounter) {
        set((state) => {
          state.dialogPhase = {
            type: 'generation',
            progress: {
              type: 'error',
              error: controller.signal.aborted
                ? 'Generation cancelled'
                : err instanceof Error
                  ? err.message
                  : 'Generation failed unexpectedly',
            },
          }
        })
      }
    } finally {
      if (runId === generationCounter) {
        set((state) => {
          state.activeAbortController = null
        })
      }
    }
  },

  cancelGeneration: () => {
    generationCounter += 1
    const { activeAbortController } = get()
    activeAbortController?.abort()

    set((state) => {
      state.dialogPhase = {
        type: 'generation',
        progress: { type: 'idle' },
      }
      state.activeAbortController = null
    })
  },

  deploy: async (projectId: string, projectPath: string) => {
    const { lastResult } = get()
    if (
      lastResult === null ||
      !lastResult.success ||
      lastResult.initLua === undefined
    ) {
      const failedResult: DeployResult = {
        success: false,
        error: 'No generated Lua to deploy',
        errorCode: 'no-output-path',
      }
      set((state) => {
        state.lastDeployResult = failedResult
        state.dialogPhase = { type: 'deployed', deployResult: failedResult }
      })
      return
    }

    set((state) => {
      state.dialogPhase = { type: 'deploying', result: lastResult }
    })

    try {
      const { deployGeneratedConfig } = await importWithTimeout(
        () => import('./deploy/deploy'),
      )
      const deployResult = await deployGeneratedConfig({
        projectId,
        projectPath,
        initLua: lastResult.initLua,
      })

      set((state) => {
        state.lastDeployResult = deployResult
        state.lastDeployedAt = Date.now()
        state.dialogPhase = { type: 'deployed', deployResult }
      })
    } catch (err) {
      const deployResult: DeployResult = {
        success: false,
        error:
          err instanceof Error ? err.message : 'Deploy failed unexpectedly',
        errorCode: 'write-failed',
      }
      set((state) => {
        state.lastDeployResult = deployResult
        state.dialogPhase = { type: 'deployed', deployResult }
      })
    }
  },

  resetForProjectClose: () => {
    generationCounter += 1
    invalidatePreflightRequests()
    get().activeAbortController?.abort()
    set((state) => {
      state.dialogOpen = false
      state.dialogPhase = { type: 'pre-flight' }
      state.targetNeovimPreflight = { kind: 'idle' }
      state.lastResult = null
      state.lastGeneratedAt = null
      state.lastDeployResult = null
      state.lastDeployedAt = null
      state.activeAbortController = null
    })
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (derived state)
// ─────────────────────────────────────────────────────────────────────────────

export function selectCurrentResult(
  state: GenerationState,
): GenerationResult | null {
  const phase = state.dialogPhase
  if (phase.type === 'generation' && phase.progress.type === 'complete') {
    return phase.progress.result
  }
  if (phase.type === 'deploying') return phase.result
  return state.lastResult
}

export function selectDiagnostics(
  state: GenerationState,
): GenerationDiagnostic[] {
  return selectCurrentResult(state)?.diagnostics ?? []
}

export function selectCanDeploy(state: GenerationState): boolean {
  const result = selectCurrentResult(state)
  if (result === null || !result.success || result.initLua === undefined)
    return false
  return !result.diagnostics.some(
    (d: GenerationDiagnostic) => d.severity === 'error',
  )
}

export function selectIsPreflightLoading(state: GenerationState): boolean {
  return state.targetNeovimPreflight.kind === 'loading'
}

export function selectCanGenerate(state: GenerationState): boolean {
  return state.targetNeovimPreflight.kind === 'ready'
}

export function selectCanCancel(state: GenerationState): boolean {
  if (state.dialogPhase.type !== 'generation') return false
  const t = state.dialogPhase.progress.type
  return (
    t === 'validating' ||
    t === 'generating-sections' ||
    t === 'generating-graphs' ||
    t === 'validating-output'
  )
}

export function selectIsOperationInProgress(state: GenerationState): boolean {
  if (state.dialogPhase.type === 'deploying') return true
  if (state.dialogPhase.type === 'generation') {
    const t = state.dialogPhase.progress.type
    return (
      t === 'validating' ||
      t === 'generating-sections' ||
      t === 'generating-graphs' ||
      t === 'validating-output'
    )
  }
  return false
}
