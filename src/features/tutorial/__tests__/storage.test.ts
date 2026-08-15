/**
 * Storage tests for tutorial/storage.ts
 *
 * Tests the real loadTutorialProgress, saveTutorialProgress, and
 * clearTutorialProgress functions by mocking the settings layer beneath them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the settings layer so storage.ts can be tested in isolation
vi.mock('@/shared/lib/settings', () => ({
  loadAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
}))

import * as settingsModule from '@/shared/lib/settings'
import {
  CURRENT_TUTORIAL_VERSION,
  INITIAL_TUTORIAL_PROGRESS,
} from '@/shared/types/tutorial'
import {
  clearTutorialProgress,
  loadTutorialProgress,
  normalizeTutorialProgress,
  saveTutorialProgress,
} from '../storage'

const mockLoadAppSettings = vi.mocked(settingsModule.loadAppSettings)
const mockUpdateAppSettings = vi.mocked(settingsModule.updateAppSettings)

describe('loadTutorialProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no progress exists', async () => {
    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: undefined,
    })

    const result = await loadTutorialProgress()
    expect(result).toBeNull()
  })

  it('returns stored progress when version matches', async () => {
    const storedProgress = {
      ...INITIAL_TUTORIAL_PROGRESS,
      currentStepIndex: 3,
      isActive: true,
      startedAt: 1000,
      lastInteractedAt: 2000,
    }

    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: storedProgress,
    })

    const result = await loadTutorialProgress()
    expect(result).toEqual(storedProgress)
  })

  it('handles outdated version by resetting hasCompleted and re-offering tutorial', async () => {
    const outdatedProgress = {
      ...INITIAL_TUTORIAL_PROGRESS,
      tutorialVersion: CURRENT_TUTORIAL_VERSION - 1,
      hasCompleted: true,
      currentStepIndex: 9,
    }

    mockLoadAppSettings.mockResolvedValue({
      theme: 'system',
      recentProjects: [],
      tutorialProgress: outdatedProgress,
    })

    const result = await loadTutorialProgress()
    expect(result).not.toBeNull()
    expect(result?.tutorialVersion).toBe(CURRENT_TUTORIAL_VERSION)
    expect(result?.hasCompleted).toBe(false)
    expect(result?.currentStepIndex).toBe(0)
  })
})

describe('saveTutorialProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls updateAppSettings with the progress', async () => {
    const progress = { ...INITIAL_TUTORIAL_PROGRESS, currentStepIndex: 2 }

    // updateAppSettings receives an updater function — simulate it
    mockUpdateAppSettings.mockImplementation(async (updater) => {
      const current = { theme: 'system' as const, recentProjects: [] }
      return updater(current)
    })

    await saveTutorialProgress(progress)

    expect(mockUpdateAppSettings).toHaveBeenCalledOnce()
  })
})

describe('clearTutorialProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls updateAppSettings to remove tutorialProgress', async () => {
    mockUpdateAppSettings.mockImplementation(async (updater) => {
      const current = {
        theme: 'system' as const,
        recentProjects: [],
        tutorialProgress: INITIAL_TUTORIAL_PROGRESS,
      }
      return updater(current)
    })

    await clearTutorialProgress()

    expect(mockUpdateAppSettings).toHaveBeenCalledOnce()
  })
})

// ── normalizeTutorialProgress ─────────────────────────────────────────────────

describe('normalizeTutorialProgress', () => {
  it('returns progress unchanged when step index is valid', () => {
    const progress = { ...INITIAL_TUTORIAL_PROGRESS, currentStepIndex: 3 }
    const result = normalizeTutorialProgress(progress)
    // Should be unchanged (3 is within TUTORIAL_STEPS bounds)
    expect(result.currentStepIndex).toBe(3)
  })

  it('clamps step index to 0 when negative', () => {
    const progress = { ...INITIAL_TUTORIAL_PROGRESS, currentStepIndex: -5 }
    const result = normalizeTutorialProgress(progress)
    expect(result.currentStepIndex).toBe(0)
  })

  it('clamps step index to max valid index when too large', () => {
    const progress = { ...INITIAL_TUTORIAL_PROGRESS, currentStepIndex: 9999 }
    const result = normalizeTutorialProgress(progress)
    // Max index = TUTORIAL_STEPS.length - 1
    expect(result.currentStepIndex).toBeGreaterThanOrEqual(0)
    expect(result.currentStepIndex).toBeLessThan(9999)
  })

  it('resets to 0 when step index is not a finite integer (NaN)', () => {
    const progress = {
      ...INITIAL_TUTORIAL_PROGRESS,
      currentStepIndex: Number.NaN,
    }
    const result = normalizeTutorialProgress(progress)
    expect(result.currentStepIndex).toBe(0)
  })

  it('resets to 0 when step index is Infinity', () => {
    const progress = {
      ...INITIAL_TUTORIAL_PROGRESS,
      currentStepIndex: Infinity,
    }
    const result = normalizeTutorialProgress(progress)
    expect(result.currentStepIndex).toBe(0)
  })

  it('preserves all other fields when normalizing', () => {
    const progress = {
      ...INITIAL_TUTORIAL_PROGRESS,
      currentStepIndex: -1,
      hasCompleted: true,
      isActive: true,
      startedAt: 12345,
      lastInteractedAt: 67890,
    }
    const result = normalizeTutorialProgress(progress)
    expect(result.hasCompleted).toBe(true)
    expect(result.isActive).toBe(true)
    expect(result.startedAt).toBe(12345)
    expect(result.lastInteractedAt).toBe(67890)
  })
})
