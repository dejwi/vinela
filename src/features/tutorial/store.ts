import { createStore } from '@/shared/lib/store'
import type {
  TutorialProgress,
  TutorialRuntimeState,
} from '@/shared/types/tutorial'
import { CURRENT_TUTORIAL_VERSION } from '@/shared/types/tutorial'
import { TUTORIAL_STEPS } from './data/steps'
import {
  cleanupTutorialProject,
  createTutorialProject,
  openTutorialProject,
} from './lifecycle'
import {
  loadTutorialProgress,
  normalizeTutorialProgress,
  saveTutorialProgress,
} from './storage'

// ── Total step count (driven by TUTORIAL_STEPS) ───────────────────────────────
let _totalStepCount = TUTORIAL_STEPS.length

/**
 * Override the total step count. Used by tests to control step boundaries.
 */
export function _setTotalStepCountForTest(count: number): void {
  _totalStepCount = count
}

// ── Store interface ───────────────────────────────────────────────────────────

export interface TutorialStoreState {
  /** Runtime state (not persisted) */
  readonly runtimeState: TutorialRuntimeState

  /** Cached tutorial project path (set during start, used during cleanup) */
  readonly tutorialProjectPath: string | null

  // ─── Actions ─────────────────────────────────────────────────────────────

  /**
   * Start the tutorial fresh from step 0.
   * Transitions: idle → loading → active
   */
  startTutorial: (atStep?: number) => Promise<void>

  /**
   * Resume the tutorial at a specific saved step index.
   * Validates and clamps the index, then recreates the tutorial project.
   * Transitions: idle → loading → active (at saved step)
   */
  resumeTutorialAtStep: (stepIndex: number) => Promise<void>

  /**
   * Advance to the next step.
   * Transitions: active → active (next step) or active → completing → idle
   */
  nextStep: () => Promise<void>

  /**
   * Go back to the previous step.
   * Transitions: active → active (previous step)
   */
  previousStep: () => void

  /**
   * Skip/exit the tutorial.
   * Transitions: active|paused → idle
   */
  skipTutorial: () => Promise<void>

  /**
   * Complete the tutorial (final step).
   * Transitions: active → completing → idle
   */
  completeTutorial: () => Promise<void>

  /**
   * Mark tutorial as completed but keep the project open for exploration.
   * Transitions: active → idle (no project cleanup, no project close)
   */
  keepExploring: () => Promise<void>

  /**
   * Mark the advance condition as met for the current step.
   */
  satisfyAdvanceCondition: () => void

  /**
   * Handle route change during tutorial.
   * May transition to paused if on wrong route.
   * @param newRoute - The new route pathname.
   * @param isNavIntentActive - When true, a nav-intent grace window is active
   *   (user just clicked a nav target), so route mismatches are tolerated.
   */
  handleRouteChange: (newRoute: string, isNavIntentActive?: boolean) => void

  /**
   * Reset runtime state to idle. Called on app startup if tutorial not active.
   */
  resetRuntime: () => void

  /**
   * Pause the tutorial (e.g., target not found).
   */
  pauseTutorial: (
    reason: 'target-not-found' | 'wrong-route' | 'setup-action-failed',
  ) => void

  /**
   * Resume from paused state (retry finding target).
   */
  resumeTutorial: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determines whether a route change is allowed for the current tutorial step.
 *
 * A route is allowed when:
 * - The step has no `requiredRoute` (null → any route is fine)
 * - The new route matches the step's `requiredRoute`
 * - The step is a `click-target` nav step (target is a nav element) and the
 *   new route is the expected destination for that nav click. This prevents
 *   false wrong-route pauses during in-flight navigation.
 *
 * @param newRoute - The route being navigated to.
 * @param stepIndex - Current step index.
 * @param isNavIntentActive - True when a nav-intent grace window is active.
 */
export function isRouteAllowedForCurrentStep(
  newRoute: string,
  stepIndex: number,
  isNavIntentActive: boolean,
): boolean {
  const step = TUTORIAL_STEPS[stepIndex]
  if (step === undefined) return true

  // No required route → any route is fine
  if (step.requiredRoute === null || step.requiredRoute === undefined) {
    return true
  }

  // Route matches required route
  if (newRoute === step.requiredRoute) {
    return true
  }

  // Nav-intent grace window: a click-target step just had its target clicked
  // and the route is in flight. Allow the transition.
  if (isNavIntentActive && step.advanceCondition.type === 'click-target') {
    return true
  }

  return false
}

function buildActiveProgress(
  stepIndex: number,
  projectPath: string | null,
  existing: TutorialProgress | null,
): TutorialProgress {
  const now = Date.now()
  return {
    tutorialVersion: CURRENT_TUTORIAL_VERSION,
    currentStepIndex: stepIndex,
    hasCompleted: existing?.hasCompleted ?? false,
    isActive: true,
    startedAt: existing?.startedAt ?? now,
    lastInteractedAt: now,
    tutorialProjectPath: projectPath,
  }
}

async function closeLoadedProject(): Promise<void> {
  const { useProjectStore } = await import('@/features/projects/store')
  useProjectStore.getState().closeProject()
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTutorialStore = createStore<TutorialStoreState>((set, get) => ({
  runtimeState: { status: 'idle' },
  tutorialProjectPath: null,

  startTutorial: async (atStep = 0) => {
    const current = get().runtimeState
    // Guard: don't start if already loading or active
    if (current.status === 'loading' || current.status === 'active') {
      return
    }

    set((state) => {
      state.runtimeState = {
        status: 'loading',
        message: 'Setting up tutorial…',
      }
    })

    let projectPath: string | null = null
    let projectOpenedSuccessfully = false

    try {
      // Load existing progress for resume context
      const existingProgress = await loadTutorialProgress()

      // Fix 6: Clean up any prior tutorial project before creating a new one
      const oldPath = existingProgress?.tutorialProjectPath ?? null
      if (oldPath !== null) {
        await cleanupTutorialProject(oldPath)
      }

      // Create the tutorial project
      projectPath = await createTutorialProject()

      // Fix 1: Open the project BEFORE entering active state
      await openTutorialProject(projectPath)
      projectOpenedSuccessfully = true

      // Only set path in store after open succeeds
      set((state) => {
        state.tutorialProjectPath = projectPath
      })

      const stepIndex = atStep

      // Persist progress
      const progress = buildActiveProgress(
        stepIndex,
        projectPath,
        existingProgress,
      )
      await saveTutorialProgress(progress)

      set((state) => {
        state.runtimeState = {
          status: 'active',
          currentStepIndex: stepIndex,
          isTransitioning: false,
          advanceConditionMet: false,
        }
      })
    } catch (err) {
      // On failure: cleanup created project, reset to idle, clear path
      if (projectPath !== null) {
        await cleanupTutorialProject(projectPath).catch(() => {})
      }
      if (projectOpenedSuccessfully) {
        await closeLoadedProject().catch(() => {})
      }
      set((state) => {
        state.runtimeState = { status: 'idle' }
        state.tutorialProjectPath = null
      })
      throw err
    }
  },

  resumeTutorialAtStep: async (stepIndex: number) => {
    const current = get().runtimeState
    // Guard: don't start if already loading or active
    if (current.status === 'loading' || current.status === 'active') {
      return
    }

    // Validate and clamp the step index
    const maxIndex = Math.max(0, _totalStepCount - 1)
    const clampedIndex = Math.max(0, Math.min(stepIndex, maxIndex))

    set((state) => {
      state.runtimeState = {
        status: 'loading',
        message: 'Resuming tutorial…',
      }
    })

    let projectPath: string | null = null
    let projectOpenedSuccessfully = false

    try {
      // Load existing progress for context (timestamps, etc.)
      const existingProgress = await loadTutorialProgress()

      // Clean up any prior tutorial project before creating a new one
      const oldPath = existingProgress?.tutorialProjectPath ?? null
      if (oldPath !== null) {
        await cleanupTutorialProject(oldPath)
      }

      // Create the tutorial project
      projectPath = await createTutorialProject()

      // Open the project BEFORE entering active state
      await openTutorialProject(projectPath)
      projectOpenedSuccessfully = true

      // Only set path in store after open succeeds
      set((state) => {
        state.tutorialProjectPath = projectPath
      })

      // Persist normalized progress at the saved step
      const normalizedProgress = normalizeTutorialProgress(
        buildActiveProgress(clampedIndex, projectPath, existingProgress),
      )
      await saveTutorialProgress(normalizedProgress)

      set((state) => {
        state.runtimeState = {
          status: 'active',
          currentStepIndex: normalizedProgress.currentStepIndex,
          isTransitioning: false,
          advanceConditionMet: false,
        }
      })
    } catch (err) {
      // On failure: cleanup created project, reset to idle, clear path
      if (projectPath !== null) {
        await cleanupTutorialProject(projectPath).catch(() => {})
      }
      if (projectOpenedSuccessfully) {
        await closeLoadedProject().catch(() => {})
      }
      set((state) => {
        state.runtimeState = { status: 'idle' }
        state.tutorialProjectPath = null
      })
      throw err
    }
  },

  nextStep: async () => {
    const current = get().runtimeState
    if (current.status !== 'active' || current.isTransitioning) {
      return
    }

    const nextIndex = current.currentStepIndex + 1

    // If we've passed the last step, complete the tutorial
    if (nextIndex >= _totalStepCount) {
      await get().completeTutorial()
      return
    }

    // Set transitioning flag to prevent race conditions
    set((state) => {
      if (state.runtimeState.status === 'active') {
        state.runtimeState = {
          status: 'active',
          currentStepIndex: current.currentStepIndex,
          isTransitioning: true,
          advanceConditionMet: false,
        }
      }
    })

    // Fix 7: try/finally ensures isTransitioning is always reset on error
    try {
      // Persist progress
      const projectPath = get().tutorialProjectPath
      const progress = buildActiveProgress(nextIndex, projectPath, null)
      await saveTutorialProgress({
        ...progress,
        currentStepIndex: nextIndex,
      })

      set((state) => {
        state.runtimeState = {
          status: 'active',
          currentStepIndex: nextIndex,
          isTransitioning: false,
          advanceConditionMet: false,
        }
      })
    } catch (err) {
      // Reset isTransitioning so the user can retry
      set((state) => {
        if (state.runtimeState.status === 'active') {
          state.runtimeState = {
            status: 'active',
            currentStepIndex: current.currentStepIndex,
            isTransitioning: false,
            advanceConditionMet: false,
          }
        }
      })
      throw err
    }
  },

  previousStep: () => {
    const current = get().runtimeState
    if (current.status !== 'active') {
      return
    }

    const prevIndex = Math.max(0, current.currentStepIndex - 1)

    set((state) => {
      state.runtimeState = {
        status: 'active',
        currentStepIndex: prevIndex,
        isTransitioning: false,
        advanceConditionMet: false,
      }
    })
  },

  skipTutorial: async () => {
    const current = get().runtimeState
    if (current.status !== 'active' && current.status !== 'paused') {
      return
    }

    const projectPath = get().tutorialProjectPath

    // Persist skipped state
    const now = Date.now()
    const stepIndex =
      current.status === 'active' || current.status === 'paused'
        ? current.currentStepIndex
        : 0

    await saveTutorialProgress({
      tutorialVersion: CURRENT_TUTORIAL_VERSION,
      currentStepIndex: stepIndex,
      hasCompleted: false,
      isActive: false,
      startedAt: 0,
      lastInteractedAt: now,
      tutorialProjectPath: null,
    })

    // Cleanup tutorial project
    if (projectPath !== null) {
      await cleanupTutorialProject(projectPath)
    }

    await closeLoadedProject()

    set((state) => {
      state.runtimeState = { status: 'idle' }
      state.tutorialProjectPath = null
    })
  },

  completeTutorial: async () => {
    const current = get().runtimeState
    if (current.status !== 'active' && current.status !== 'completing') {
      return
    }

    set((state) => {
      state.runtimeState = { status: 'completing' }
    })

    const projectPath = get().tutorialProjectPath
    const now = Date.now()

    try {
      // Persist completed state
      await saveTutorialProgress({
        tutorialVersion: CURRENT_TUTORIAL_VERSION,
        currentStepIndex: _totalStepCount - 1,
        hasCompleted: true,
        isActive: false,
        startedAt: 0,
        lastInteractedAt: now,
        tutorialProjectPath: null,
      })
    } finally {
      try {
        // Always cleanup and close even if persistence fails
        if (projectPath !== null) {
          await cleanupTutorialProject(projectPath).catch(() => {})
          await closeLoadedProject().catch(() => {})
        }
      } finally {
        set((state) => {
          state.runtimeState = { status: 'idle' }
          state.tutorialProjectPath = null
        })
      }
    }
  },

  satisfyAdvanceCondition: () => {
    const current = get().runtimeState
    if (current.status !== 'active') {
      return
    }

    set((state) => {
      if (state.runtimeState.status === 'active') {
        state.runtimeState = {
          status: 'active',
          currentStepIndex: current.currentStepIndex,
          isTransitioning: current.isTransitioning,
          advanceConditionMet: true,
        }
      }
    })
  },

  handleRouteChange: (newRoute: string, isNavIntentActive = false) => {
    const current = get().runtimeState

    // When paused due to wrong-route, check if the user has navigated to the
    // required route and auto-resume if so.
    if (current.status === 'paused' && current.reason === 'wrong-route') {
      const allowed = isRouteAllowedForCurrentStep(
        newRoute,
        current.currentStepIndex,
        isNavIntentActive,
      )
      if (allowed) {
        get().resumeTutorial()
      }
      return
    }

    // Only validate routes when the tutorial is active
    if (current.status !== 'active') {
      return
    }

    // Use the intent-aware route check helper
    const allowed = isRouteAllowedForCurrentStep(
      newRoute,
      current.currentStepIndex,
      isNavIntentActive,
    )

    if (!allowed) {
      get().pauseTutorial('wrong-route')
    }
  },

  resetRuntime: () => {
    set((state) => {
      state.runtimeState = { status: 'idle' }
      state.tutorialProjectPath = null
    })
  },

  pauseTutorial: (reason) => {
    const current = get().runtimeState
    if (current.status !== 'active') {
      return
    }

    set((state) => {
      state.runtimeState = {
        status: 'paused',
        reason,
        currentStepIndex: current.currentStepIndex,
      }
    })
  },

  resumeTutorial: () => {
    const current = get().runtimeState
    if (current.status !== 'paused') {
      return
    }

    set((state) => {
      state.runtimeState = {
        status: 'active',
        currentStepIndex: current.currentStepIndex,
        isTransitioning: false,
        advanceConditionMet: false,
      }
    })
  },

  keepExploring: async () => {
    const current = get().runtimeState
    if (current.status !== 'active' && current.status !== 'completing') {
      return
    }

    const now = Date.now()

    // Persist completed state (same as completeTutorial, but no cleanup)
    await saveTutorialProgress({
      tutorialVersion: CURRENT_TUTORIAL_VERSION,
      currentStepIndex: _totalStepCount - 1,
      hasCompleted: true,
      isActive: false,
      startedAt: 0,
      lastInteractedAt: now,
      tutorialProjectPath: null,
    })

    // Transition to idle without closing or cleaning up the project
    set((state) => {
      state.runtimeState = { status: 'idle' }
      state.tutorialProjectPath = null
    })
  },
}))

/**
 * Reset store to initial state for test isolation.
 * Call in beforeEach to prevent state leaking between tests.
 */
export function _resetTutorialStoreForTest(): void {
  useTutorialStore.setState((state) => {
    state.runtimeState = { status: 'idle' }
    state.tutorialProjectPath = null
  })
  // Fix 4: Restore from TUTORIAL_STEPS.length (not hardcoded 10)
  _totalStepCount = TUTORIAL_STEPS.length
}
