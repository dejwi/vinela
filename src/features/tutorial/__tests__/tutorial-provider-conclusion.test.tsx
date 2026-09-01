/**
 * TutorialProvider conclusion flow tests
 *
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('../utils', async () => {
  const actual = await vi.importActual<typeof import('../utils')>('../utils')
  return {
    ...actual,
    calculateTooltipPositionWithCollision: vi.fn(() => ({
      x: 100,
      y: 100,
      actualPlacement: 'bottom',
    })),
    detectOpenFloatingSurfaces: vi.fn(() => []),
    getViewportSize: vi.fn(() => ({ width: 1280, height: 720 })),
  }
})

import { TutorialProvider } from '../components/TutorialProvider'
import { TUTORIAL_STEPS } from '../data/steps'
import { _resetTutorialStoreForTest, useTutorialStore } from '../store'

function LocationDisplay(): React.ReactElement {
  const location = useLocation()
  return <div data-testid="current-path">{location.pathname}</div>
}

describe('TutorialProvider conclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetTutorialStoreForTest()
  })

  it('navigates home after closing tutorial project from conclusion step', async () => {
    const conclusionIndex = TUTORIAL_STEPS.findIndex(
      (step) => step.id === 'conclusion',
    )
    expect(conclusionIndex).toBeGreaterThanOrEqual(0)

    const completeTutorialSpy = vi
      .spyOn(useTutorialStore.getState(), 'completeTutorial')
      .mockResolvedValue(undefined)

    useTutorialStore.setState((state) => {
      state.runtimeState = {
        status: 'active',
        currentStepIndex: conclusionIndex,
        isTransitioning: false,
        advanceConditionMet: false,
      }
      state.tutorialProjectPath = '/memory/tutorial-test'
    })

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route
            path="*"
            element={
              <TutorialProvider>
                <LocationDisplay />
              </TutorialProvider>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /close tutorial project/i }),
    )

    await waitFor(() => {
      expect(completeTutorialSpy).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByTestId('current-path').textContent).toBe('/')
    })
  })
})
