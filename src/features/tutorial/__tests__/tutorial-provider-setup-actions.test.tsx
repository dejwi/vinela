/**
 * TutorialProvider Setup Action Tests
 *
 * Tests for: Step-entry gating, setup action error handling, retry behavior
 *
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TutorialRuntimeState } from '@/shared/types/tutorial'
import { TutorialProvider } from '../components/TutorialProvider'
import * as setupActions from '../data/setup-actions'
import { TUTORIAL_STEPS } from '../data/steps'
import {
  _resetTutorialStoreForTest,
  _setTotalStepCountForTest,
  useTutorialStore,
} from '../store'

/** Type guard for active runtime state */
function isActiveRuntimeState(
  state: TutorialRuntimeState,
): state is Extract<TutorialRuntimeState, { status: 'active' }> {
  return state.status === 'active'
}

// Mock the setup actions module
vi.mock('../data/setup-actions', () => ({
  runSetupAction: vi.fn(),
}))

// Mock the hooks with mutable state for per-test control
const mockTargetState = {
  element: null as HTMLElement | null,
  rect: null as DOMRect | null,
  lastStableRect: null as DOMRect | null,
  isSearching: false,
  isReacquiring: false,
}

vi.mock('../hooks/useTutorialTarget', () => ({
  useTutorialTarget: vi.fn(() => mockTargetState),
}))

vi.mock('../hooks/useClickTargetFallbackTimer', () => ({
  useClickTargetFallbackTimer: vi.fn(() => ({
    fallbackElapsed: false,
    remainingSeconds: 5,
  })),
}))

// Mock utility functions - must include all exports
vi.mock('../utils', async () => {
  const actual = await vi.importActual('../utils')
  return {
    ...(actual as Record<string, unknown>),
    calculateTooltipPositionWithCollision: vi.fn(() => ({
      x: 100,
      y: 100,
      actualPlacement: 'bottom',
    })),
    detectOpenFloatingSurfaces: vi.fn(() => []),
    formatSectionName: vi.fn((s: string) => s),
    renderSimpleMarkdown: vi.fn((text: string) => text),
  }
})

// Helper to render provider with router context
function renderProvider() {
  return render(
    <MemoryRouter>
      <TutorialProvider>
        <div data-testid="test-children">Children</div>
      </TutorialProvider>
    </MemoryRouter>,
  )
}

// Helper to setup minimal tutorial steps with setup actions
function setupTestSteps(
  steps: Array<{
    id: string
    setupActionId?: string
  }>,
): void {
  // Create minimal step definitions from provided steps
  const fullSteps = steps.map((s, index) => ({
    id: s.id,
    section: 'welcome' as const,
    title: `Step ${index + 1}`,
    content: `Content for step ${index + 1}`,
    target: null,
    tooltipPlacement: 'center' as const,
    advanceCondition: { type: 'click-next' as const },
    requiredRoute: null,
    setupActionId: s.setupActionId,
  }))

  // Override TUTORIAL_STEPS by modifying the underlying array
  const stepsArray = TUTORIAL_STEPS as unknown as Array<
    (typeof TUTORIAL_STEPS)[0]
  >
  stepsArray.length = 0
  fullSteps.forEach((step) => {
    stepsArray.push(step as (typeof TUTORIAL_STEPS)[0])
  })
  _setTotalStepCountForTest(fullSteps.length)
}

describe('TutorialProvider setup action gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetTutorialStoreForTest()
    // Reset target mock state
    mockTargetState.element = null
    mockTargetState.rect = null
    mockTargetState.lastStableRect = null
    mockTargetState.isSearching = false
    mockTargetState.isReacquiring = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs setup action once when entering a step', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    runSetupActionSpy.mockResolvedValue(undefined)

    setupTestSteps([
      { id: 'step-1', setupActionId: 'action-1' },
      { id: 'step-2', setupActionId: 'action-2' },
    ])

    renderProvider()

    // Start tutorial at step 0
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Wait for setup action to be called
    await waitFor(() => {
      expect(runSetupActionSpy).toHaveBeenCalledWith('action-1')
    })

    expect(runSetupActionSpy).toHaveBeenCalledTimes(1)

    // Simulate runtime state mutation (e.g., advanceConditionMet changes)
    // This should NOT trigger another setup action
    act(() => {
      useTutorialStore.getState().satisfyAdvanceCondition()
    })

    // Give time for any potential re-runs
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Should still only be called once
    expect(runSetupActionSpy).toHaveBeenCalledTimes(1)
  })

  it('re-runs setup action when re-entering a step after leaving', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    runSetupActionSpy.mockResolvedValue(undefined)

    setupTestSteps([
      { id: 'step-1', setupActionId: 'action-1' },
      { id: 'step-2', setupActionId: 'action-2' },
    ])

    renderProvider()

    // Start tutorial at step 0
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    await waitFor(() => {
      expect(runSetupActionSpy).toHaveBeenCalledWith('action-1')
    })

    expect(runSetupActionSpy).toHaveBeenCalledTimes(1)

    // Go to next step
    await act(async () => {
      await useTutorialStore.getState().nextStep()
    })

    await waitFor(() => {
      expect(runSetupActionSpy).toHaveBeenCalledWith('action-2')
    })

    expect(runSetupActionSpy).toHaveBeenCalledTimes(2)

    // Go back to previous step
    act(() => {
      useTutorialStore.getState().previousStep()
    })

    // Should re-run setup action for step 1
    await waitFor(() => {
      expect(runSetupActionSpy).toHaveBeenCalledTimes(3)
    })

    expect(runSetupActionSpy).toHaveBeenLastCalledWith('action-1')
  })

  it('does NOT re-run setup action on paused->active resume for same step', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    runSetupActionSpy.mockResolvedValue(undefined)

    setupTestSteps([{ id: 'step-1', setupActionId: 'action-1' }])

    renderProvider()

    // Start tutorial
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    await waitFor(() => {
      expect(runSetupActionSpy).toHaveBeenCalledTimes(1)
    })

    // Pause the tutorial
    act(() => {
      useTutorialStore.getState().pauseTutorial('target-not-found')
    })

    // Resume the tutorial (same step)
    act(() => {
      useTutorialStore.getState().resumeTutorial()
    })

    // Give time for any potential re-runs
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Should still only be called once (no re-run on resume)
    expect(runSetupActionSpy).toHaveBeenCalledTimes(1)
  })

  it('does not run setup action when step has no setupActionId', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    runSetupActionSpy.mockResolvedValue(undefined)

    setupTestSteps([
      { id: 'step-1' }, // No setup action
      { id: 'step-2', setupActionId: 'action-2' },
    ])

    renderProvider()

    // Start tutorial at step 0 (no setup action)
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Give time for any potential calls
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Should not have been called
    expect(runSetupActionSpy).not.toHaveBeenCalled()

    // Go to step 2 (has setup action)
    await act(async () => {
      await useTutorialStore.getState().nextStep()
    })

    await waitFor(() => {
      expect(runSetupActionSpy).toHaveBeenCalledWith('action-2')
    })
  })
})

describe('TutorialProvider setup action error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetTutorialStoreForTest()
    // Reset target mock state
    mockTargetState.element = null
    mockTargetState.rect = null
    mockTargetState.lastStableRect = null
    mockTargetState.isSearching = false
    mockTargetState.isReacquiring = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('pauses tutorial with setup-action-failed reason when setup action throws', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    runSetupActionSpy.mockRejectedValue(
      new Error('Failed to prepare plugin install'),
    )

    setupTestSteps([{ id: 'step-1', setupActionId: 'action-1' }])

    renderProvider()

    // Start tutorial
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Wait for error handling
    await waitFor(() => {
      const state = useTutorialStore.getState().runtimeState
      expect(state.status).toBe('paused')
    })

    const runtimeState = useTutorialStore.getState().runtimeState
    expect(runtimeState.status).toBe('paused')
    expect(runtimeState.status === 'paused' && runtimeState.reason).toBe(
      'setup-action-failed',
    )
  })

  it('captures error message for display', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    const errorMessage = 'Telescope did not finish installing within 8 seconds'
    runSetupActionSpy.mockRejectedValue(new Error(errorMessage))

    setupTestSteps([{ id: 'step-1', setupActionId: 'action-1' }])

    const { container } = renderProvider()

    // Start tutorial
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Wait for error state
    await waitFor(() => {
      const state = useTutorialStore.getState().runtimeState
      expect(state.status).toBe('paused')
    })

    // Check if error message is displayed in the overlay
    await waitFor(() => {
      expect(container.textContent).toContain(errorMessage)
    })
  })

  it('ignores stale promise results when step changes during execution', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)

    // First action takes a while and then fails
    runSetupActionSpy.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('First action failed'))
          }, 100)
        }),
    )

    // Second action succeeds immediately
    runSetupActionSpy.mockResolvedValueOnce(undefined)

    setupTestSteps([
      { id: 'step-1', setupActionId: 'slow-action' },
      { id: 'step-2', setupActionId: 'fast-action' },
    ])

    renderProvider()

    // Start tutorial at step 0
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Immediately go to step 1 (before first action completes)
    await act(async () => {
      await useTutorialStore.getState().nextStep()
    })

    // Wait for both potential outcomes
    await new Promise((resolve) => setTimeout(resolve, 200))

    // Should be active on step 2, not paused from the stale error
    const runtimeState = useTutorialStore.getState().runtimeState
    expect(runtimeState.status).toBe('active')
    if (runtimeState.status === 'active') {
      expect(runtimeState.currentStepIndex).toBe(1)
    }
  })
})

describe('TutorialProvider edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetTutorialStoreForTest()
    // Reset target mock state
    mockTargetState.element = null
    mockTargetState.rect = null
    mockTargetState.lastStableRect = null
    mockTargetState.isSearching = false
    mockTargetState.isReacquiring = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles non-Error exceptions gracefully', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    runSetupActionSpy.mockRejectedValue('String error') // Non-Error rejection

    setupTestSteps([{ id: 'step-1', setupActionId: 'action-1' }])

    const { container } = renderProvider()

    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    await waitFor(() => {
      const state = useTutorialStore.getState().runtimeState
      expect(state.status).toBe('paused')
    })

    // Should show generic error message
    await waitFor(() => {
      expect(container.textContent).toContain('Setup action failed')
    })
  })

  it('handles unknown setup action IDs gracefully', async () => {
    const runSetupActionSpy = vi.mocked(setupActions.runSetupAction)
    // runSetupAction returns silently for unknown IDs
    runSetupActionSpy.mockResolvedValue(undefined)

    setupTestSteps([{ id: 'step-1', setupActionId: 'unknown-action' }])

    renderProvider()

    // Should not throw or pause
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    const state = useTutorialStore.getState().runtimeState
    expect(state.status).toBe('active')
    expect(runSetupActionSpy).toHaveBeenCalledWith('unknown-action')
  })
})

// ── Auto-Advance Tests (Phase 2) ──────────────────────────────────────────────

describe('TutorialProvider auto-advance behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetTutorialStoreForTest()
    // Reset target mock state
    mockTargetState.element = null
    mockTargetState.rect = null
    mockTargetState.lastStableRect = null
    mockTargetState.isSearching = false
    mockTargetState.isReacquiring = false
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    // Clean up any appended target elements
    for (const el of document.querySelectorAll('[data-tutorial]')) {
      el.remove()
    }
  })

  it('auto-advances when click-target has onSuccess: auto-next', async () => {
    // Setup: Create a step with auto-next policy
    const stepsWithAutoNext = [
      {
        id: 'auto-next-step',
        section: 'welcome' as const,
        title: 'Auto Next Step',
        content: 'Click the target to auto-advance',
        target: 'click-target-test',
        tooltipPlacement: 'bottom' as const,
        advanceCondition: {
          type: 'click-target' as const,
          onSuccess: 'auto-next' as const,
          advanceDebounceMs: 100,
        },
        requiredRoute: null,
      },
      {
        id: 'next-step',
        section: 'welcome' as const,
        title: 'Next Step',
        content: 'You should be here after auto-advance',
        target: null,
        tooltipPlacement: 'center' as const,
        advanceCondition: { type: 'click-next' as const },
        requiredRoute: null,
      },
    ]

    // Override TUTORIAL_STEPS
    const stepsArray = TUTORIAL_STEPS as unknown as Array<
      (typeof TUTORIAL_STEPS)[0]
    >
    stepsArray.length = 0
    stepsWithAutoNext.forEach((step) => {
      stepsArray.push(step as (typeof TUTORIAL_STEPS)[0])
    })
    _setTotalStepCountForTest(stepsWithAutoNext.length)

    // Create clickable target with mocked rect for useTutorialTarget
    const targetEl = document.createElement('button')
    targetEl.setAttribute('data-tutorial', 'click-target-test')
    // Mock getBoundingClientRect to provide valid rect
    targetEl.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 100,
      width: 50,
      height: 30,
      top: 100,
      left: 100,
      right: 150,
      bottom: 130,
      toJSON: () => ({}),
    }))
    document.body.appendChild(targetEl)

    // Set the target element in the mock so click listener attaches
    mockTargetState.element = targetEl
    mockTargetState.rect = targetEl.getBoundingClientRect()
    mockTargetState.lastStableRect = mockTargetState.rect

    renderProvider()

    // Start tutorial
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Verify we're on step 0
    const state0 = useTutorialStore.getState().runtimeState
    expect(state0.status).toBe('active')
    expect(isActiveRuntimeState(state0) && state0.currentStepIndex).toBe(0)

    // Click the target (now the listener is attached)
    await act(async () => {
      fireEvent.click(targetEl)
    })

    // Advance timers past debounce
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    // Should have auto-advanced to step 1
    await waitFor(() => {
      const state = useTutorialStore.getState().runtimeState
      expect(state.status).toBe('active')
      expect(isActiveRuntimeState(state) && state.currentStepIndex).toBe(1)
    })

    document.body.removeChild(targetEl)
  })

  it('does NOT auto-advance when onSuccess is manual (default)', async () => {
    // Setup: Create a step with manual policy (default)
    const stepsWithManual = [
      {
        id: 'manual-step',
        section: 'welcome' as const,
        title: 'Manual Step',
        content: 'Click the target but stay on step',
        target: 'click-target-manual',
        tooltipPlacement: 'bottom' as const,
        advanceCondition: { type: 'click-target' as const }, // No onSuccess = manual
        requiredRoute: null,
      },
    ]

    // Override TUTORIAL_STEPS
    const stepsArray = TUTORIAL_STEPS as unknown as Array<
      (typeof TUTORIAL_STEPS)[0]
    >
    stepsArray.length = 0
    stepsWithManual.forEach((step) => {
      stepsArray.push(step as (typeof TUTORIAL_STEPS)[0])
    })
    _setTotalStepCountForTest(stepsWithManual.length)

    // Create clickable target with mocked rect for useTutorialTarget
    const targetEl = document.createElement('button')
    targetEl.setAttribute('data-tutorial', 'click-target-manual')
    targetEl.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 100,
      width: 50,
      height: 30,
      top: 100,
      left: 100,
      right: 150,
      bottom: 130,
      toJSON: () => ({}),
    }))
    document.body.appendChild(targetEl)

    // Set the target element in the mock so click listener attaches
    mockTargetState.element = targetEl
    mockTargetState.rect = targetEl.getBoundingClientRect()
    mockTargetState.lastStableRect = mockTargetState.rect

    renderProvider()

    // Start tutorial
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Click the target (now the listener is attached)
    await act(async () => {
      fireEvent.click(targetEl)
    })

    // Advance timers
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    // Should still be on step 0 (manual mode)
    const state = useTutorialStore.getState().runtimeState
    expect(state.status).toBe('active')
    expect(isActiveRuntimeState(state) && state.currentStepIndex).toBe(0)
    expect(isActiveRuntimeState(state) && state.advanceConditionMet).toBe(true)
  })

  it('auto-next respects advanceDebounceMs timing', async () => {
    const customDebounce = 300
    const stepsWithCustomDebounce = [
      {
        id: 'custom-debounce-step',
        section: 'welcome' as const,
        title: 'Custom Debounce',
        content: 'Click with custom debounce',
        target: 'click-target-debounce',
        tooltipPlacement: 'bottom' as const,
        advanceCondition: {
          type: 'click-target' as const,
          onSuccess: 'auto-next' as const,
          advanceDebounceMs: customDebounce,
        },
        requiredRoute: null,
      },
      {
        id: 'next-step-debounce',
        section: 'welcome' as const,
        title: 'Next Step',
        content: 'After debounce',
        target: null,
        tooltipPlacement: 'center' as const,
        advanceCondition: { type: 'click-next' as const },
        requiredRoute: null,
      },
    ]

    const stepsArray = TUTORIAL_STEPS as unknown as Array<
      (typeof TUTORIAL_STEPS)[0]
    >
    stepsArray.length = 0
    stepsWithCustomDebounce.forEach((step) => {
      stepsArray.push(step as (typeof TUTORIAL_STEPS)[0])
    })
    _setTotalStepCountForTest(stepsWithCustomDebounce.length)

    // Create clickable target with mocked rect for useTutorialTarget
    const targetEl = document.createElement('button')
    targetEl.setAttribute('data-tutorial', 'click-target-debounce')
    targetEl.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 100,
      width: 50,
      height: 30,
      top: 100,
      left: 100,
      right: 150,
      bottom: 130,
      toJSON: () => ({}),
    }))
    document.body.appendChild(targetEl)

    // Set the target element in the mock so click listener attaches
    mockTargetState.element = targetEl
    mockTargetState.rect = targetEl.getBoundingClientRect()
    mockTargetState.lastStableRect = mockTargetState.rect

    renderProvider()

    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Click the target (now the listener is attached)
    await act(async () => {
      fireEvent.click(targetEl)
    })

    // Check before debounce - should still be on step 0
    await act(async () => {
      vi.advanceTimersByTime(customDebounce - 50)
    })

    const beforeState = useTutorialStore.getState().runtimeState
    expect(
      isActiveRuntimeState(beforeState) && beforeState.currentStepIndex,
    ).toBe(0)

    // After debounce - should advance
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    await waitFor(() => {
      const afterState = useTutorialStore.getState().runtimeState
      expect(
        isActiveRuntimeState(afterState) && afterState.currentStepIndex,
      ).toBe(1)
    })

    document.body.removeChild(targetEl)
  })
})
