/**
 * TutorialAutoStart migrated-reset re-offer tests
 *
 * Tests for: Migrated reset signature triggers exactly one startTutorial call
 *
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock functions - defined here but will be used via getState mock
const mockFns = {
  startTutorial: vi.fn(),
  resumeTutorialAtStep: vi.fn(),
}

vi.mock('@/features/projects/store', () => ({
  useProjectStore: vi.fn(() => ({ getState: () => ({}) })),
}))

vi.mock('@/features/tutorial/store', () => {
  const store = {
    startTutorial: (...args: unknown[]) => mockFns.startTutorial(...args),
    resumeTutorialAtStep: (...args: unknown[]) =>
      mockFns.resumeTutorialAtStep(...args),
  }
  const useTutorialStoreMock = vi.fn(() => ({
    getState: () => store,
  })) as ReturnType<typeof vi.fn> & { getState: () => typeof store }
  useTutorialStoreMock.getState = () => store
  return {
    useTutorialStore: useTutorialStoreMock,
    _resetTutorialStoreForTest: vi.fn(),
    _setTotalStepCountForTest: vi.fn(),
  }
})

vi.mock('@/features/tutorial/data/steps', () => ({
  TUTORIAL_STEPS: [{ id: 'step-1' }, { id: 'step-2' }],
}))

vi.mock('@/features/tutorial/lifecycle', () => ({
  cleanupTutorialProject: vi.fn(),
}))

vi.mock('@/features/tutorial/storage', () => ({
  loadTutorialProgress: vi.fn(),
  saveTutorialProgress: vi.fn(),
}))

import { loadTutorialProgress } from '@/features/tutorial/storage'
import { CURRENT_TUTORIAL_VERSION } from '@/shared/types/tutorial'
import { TutorialAutoStart } from '../hooks/useTutorialAutoStart'

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMigratedResetProgress(): {
  tutorialVersion: number
  hasCompleted: boolean
  isActive: boolean
  currentStepIndex: number
  startedAt: number
  lastInteractedAt: number
  tutorialProjectPath: null
} {
  return {
    tutorialVersion: CURRENT_TUTORIAL_VERSION,
    hasCompleted: false,
    isActive: false,
    currentStepIndex: 0,
    startedAt: 0,
    lastInteractedAt: 0,
    tutorialProjectPath: null,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TutorialAutoStart migrated-reset re-offer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers startTutorial exactly once for migrated-reset signature', async () => {
    vi.mocked(loadTutorialProgress).mockResolvedValue(
      createMigratedResetProgress(),
    )

    render(<TutorialAutoStart />)

    await waitFor(() => {
      expect(mockFns.startTutorial).toHaveBeenCalledTimes(1)
    })
  })

  it('does NOT auto-start when version differs', async () => {
    const progress = createMigratedResetProgress()
    vi.mocked(loadTutorialProgress).mockResolvedValue({
      ...progress,
      tutorialVersion: CURRENT_TUTORIAL_VERSION - 1,
    })

    render(<TutorialAutoStart />)

    // Wait a bit to ensure no auto-start
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(mockFns.startTutorial).not.toHaveBeenCalled()
  })

  it('does NOT auto-start when hasCompleted is true', async () => {
    const progress = createMigratedResetProgress()
    vi.mocked(loadTutorialProgress).mockResolvedValue({
      ...progress,
      hasCompleted: true,
    })

    render(<TutorialAutoStart />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(mockFns.startTutorial).not.toHaveBeenCalled()
  })

  it('does NOT auto-start when isActive is true', async () => {
    const progress = createMigratedResetProgress()
    vi.mocked(loadTutorialProgress).mockResolvedValue({
      ...progress,
      isActive: true,
    })

    render(<TutorialAutoStart />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(mockFns.startTutorial).not.toHaveBeenCalled()
    // Should show resume dialog instead
    expect(screen.getByText('Resume Tutorial?')).toBeInTheDocument()
  })

  it('does NOT auto-start when currentStepIndex is not 0', async () => {
    const progress = createMigratedResetProgress()
    vi.mocked(loadTutorialProgress).mockResolvedValue({
      ...progress,
      currentStepIndex: 5,
    })

    render(<TutorialAutoStart />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(mockFns.startTutorial).not.toHaveBeenCalled()
  })

  it('does NOT auto-start when startedAt is not 0', async () => {
    const progress = createMigratedResetProgress()
    vi.mocked(loadTutorialProgress).mockResolvedValue({
      ...progress,
      startedAt: Date.now(),
    })

    render(<TutorialAutoStart />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(mockFns.startTutorial).not.toHaveBeenCalled()
  })

  it('does NOT auto-start when tutorialProjectPath is not null', async () => {
    const progress = createMigratedResetProgress()
    vi.mocked(loadTutorialProgress).mockResolvedValue({
      ...progress,
      tutorialProjectPath: '/some/path',
    })

    render(<TutorialAutoStart />)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    expect(mockFns.startTutorial).not.toHaveBeenCalled()
  })
})
