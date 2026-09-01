/**
 * TutorialProvider route sync tests
 *
 * Tests for: Route sync including backward navigation and stale ref reset
 *
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TutorialRuntimeState } from '@/shared/types/tutorial'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../data/setup-actions', () => ({
  runSetupAction: vi.fn(),
}))

vi.mock('../hooks/useTutorialTarget', () => ({
  useTutorialTarget: vi.fn(() => ({
    element: null,
    rect: null,
    lastStableRect: null,
    isSearching: false,
    isReacquiring: false,
  })),
}))

vi.mock('../hooks/useClickTargetFallbackTimer', () => ({
  useClickTargetFallbackTimer: vi.fn(() => ({
    fallbackElapsed: false,
    remainingSeconds: 5,
  })),
}))

// Mock utility functions
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
    clampTooltipPositionToViewport: vi.fn(
      (pos: { x: number; y: number }) => pos,
    ),
    getViewportSize: vi.fn(() => ({ width: 1024, height: 768 })),
  }
})

import { TutorialProvider } from '../components/TutorialProvider'
import { TUTORIAL_STEPS } from '../data/steps'
import {
  _resetTutorialStoreForTest,
  _setTotalStepCountForTest,
  useTutorialStore,
} from '../store'

// Helper to render provider with router
function renderProvider(initialEntries: string[] = ['/']) {
  function LocationDisplay() {
    const location = useLocation()
    return <div data-testid="current-path">{location.pathname}</div>
  }

  function RouteControls() {
    const navigate = useNavigate()
    return (
      <button
        type="button"
        data-testid="go-settings"
        onClick={() => navigate('/settings')}
      >
        Go to settings
      </button>
    )
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          path="*"
          element={
            <TutorialProvider>
              <LocationDisplay />
              <RouteControls />
              <div data-testid="test-children">Children</div>
            </TutorialProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

// Helper to setup test steps with required routes
function setupTestStepsWithRoutes(
  steps: Array<{
    id: string
    requiredRoute: string | null
  }>,
): void {
  const fullSteps = steps.map((s, index) => ({
    id: s.id,
    section: 'welcome' as const,
    title: `Step ${index + 1}`,
    content: `Content for step ${index + 1}`,
    target: null,
    tooltipPlacement: 'center' as const,
    advanceCondition: { type: 'click-next' as const },
    requiredRoute: s.requiredRoute,
  }))

  const stepsArray = TUTORIAL_STEPS as unknown as Array<
    (typeof TUTORIAL_STEPS)[0]
  >
  stepsArray.length = 0
  fullSteps.forEach((step) => {
    stepsArray.push(step as (typeof TUTORIAL_STEPS)[0])
  })
  _setTotalStepCountForTest(fullSteps.length)
}

/** Type guard for active runtime state */
function isActiveRuntimeState(
  state: TutorialRuntimeState,
): state is Extract<TutorialRuntimeState, { status: 'active' }> {
  return state.status === 'active'
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TutorialProvider route sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetTutorialStoreForTest()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('syncs route on forward navigation', async () => {
    setupTestStepsWithRoutes([
      { id: 'step-1', requiredRoute: '/plugins' },
      { id: 'step-2', requiredRoute: '/keymaps' },
    ])

    const { getByTestId } = renderProvider(['/plugins'])

    // Start at step 0 on /plugins
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Verify we're on step 0
    const state = useTutorialStore.getState().runtimeState
    expect(state.status).toBe('active')
    expect(isActiveRuntimeState(state) && state.currentStepIndex).toBe(0)

    // Navigate to next step (requires /keymaps)
    await act(async () => {
      await useTutorialStore.getState().nextStep()
    })

    // Should have navigated to /keymaps
    await waitFor(() => {
      expect(getByTestId('current-path').textContent).toBe('/keymaps')
    })
  })

  it('syncs route on backward navigation', async () => {
    setupTestStepsWithRoutes([
      { id: 'step-1', requiredRoute: '/plugins' },
      { id: 'step-2', requiredRoute: '/keymaps' },
    ])

    const { getByTestId } = renderProvider(['/plugins'])

    // Start at step 0
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Navigate to step 1 (requires /keymaps)
    await act(async () => {
      await useTutorialStore.getState().nextStep()
    })

    await waitFor(() => {
      expect(getByTestId('current-path').textContent).toBe('/keymaps')
    })

    // Go back to step 0 (requires /plugins)
    act(() => {
      useTutorialStore.getState().previousStep()
    })

    // Should have navigated back to /plugins
    await waitFor(() => {
      expect(getByTestId('current-path').textContent).toBe('/plugins')
    })
  })

  it('resets route-sync ref when transitioning to idle/loading', async () => {
    setupTestStepsWithRoutes([{ id: 'step-1', requiredRoute: '/plugins' }])

    const { getByTestId } = renderProvider(['/plugins'])

    // Start at step 0
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Skip the tutorial (goes to idle)
    await act(async () => {
      await useTutorialStore.getState().skipTutorial()
    })

    // Verify we're idle
    let state = useTutorialStore.getState().runtimeState
    expect(state.status).toBe('idle')

    // Navigate away from /plugins while tutorial is idle.
    fireEvent.click(getByTestId('go-settings'))
    await waitFor(() => {
      expect(getByTestId('current-path').textContent).toBe('/settings')
    })

    // Restarting at the same step index should still re-sync route and navigate.
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    await waitFor(() => {
      expect(getByTestId('current-path').textContent).toBe('/plugins')
    })

    state = useTutorialStore.getState().runtimeState
    expect(state.status).toBe('active')
  })

  it('triggers navigation when restarting at same index on mismatched route', async () => {
    setupTestStepsWithRoutes([{ id: 'step-1', requiredRoute: '/plugins' }])

    const { getByTestId } = renderProvider(['/plugins'])

    // Start at step 0 on /plugins
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Skip tutorial (goes to idle, resets refs)
    await act(async () => {
      await useTutorialStore.getState().skipTutorial()
    })

    // Navigate to a different route while tutorial is idle.
    fireEvent.click(getByTestId('go-settings'))
    await waitFor(() => {
      expect(getByTestId('current-path').textContent).toBe('/settings')
    })

    // Then restart tutorial - it should navigate to /plugins.
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    await waitFor(() => {
      expect(getByTestId('current-path').textContent).toBe('/plugins')
    })

    // Should be active on step 0
    const state = useTutorialStore.getState().runtimeState
    expect(state.status).toBe('active')
    expect(isActiveRuntimeState(state) && state.currentStepIndex).toBe(0)
  })

  it('does not trigger duplicate navigation when route already matches', async () => {
    setupTestStepsWithRoutes([
      { id: 'step-1', requiredRoute: '/plugins' },
      { id: 'step-2', requiredRoute: '/plugins' },
    ])

    const { getByTestId } = renderProvider(['/plugins'])

    // Start at step 0
    await act(async () => {
      await useTutorialStore.getState().startTutorial(0)
    })

    // Navigate to step 1 (also requires /plugins, same route)
    await act(async () => {
      await useTutorialStore.getState().nextStep()
    })

    // Should remain on /plugins without duplicate navigation
    expect(getByTestId('current-path').textContent).toBe('/plugins')

    const state = useTutorialStore.getState().runtimeState
    expect(state.status).toBe('active')
    expect(isActiveRuntimeState(state) && state.currentStepIndex).toBe(1)
  })
})
