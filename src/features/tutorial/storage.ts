import { loadAppSettings, updateAppSettings } from '@/shared/lib/settings'
import type { TutorialProgress } from '@/shared/types/tutorial'
import {
  CURRENT_TUTORIAL_VERSION,
  INITIAL_TUTORIAL_PROGRESS,
} from '@/shared/types/tutorial'
import { TUTORIAL_STEPS } from './data/steps'

/**
 * Normalizes raw tutorial progress loaded from storage.
 *
 * Guards against:
 * - Non-number `currentStepIndex` (corrupted data)
 * - Out-of-range step index (clamped to valid bounds)
 *
 * Logs a warning in dev mode when normalization is applied.
 */
export function normalizeTutorialProgress(
  progress: TutorialProgress,
): TutorialProgress {
  const maxIndex = Math.max(0, TUTORIAL_STEPS.length - 1)
  const rawIndex = progress.currentStepIndex

  // Guard: must be a finite integer
  if (!Number.isFinite(rawIndex) || !Number.isInteger(rawIndex)) {
    if (import.meta.env.DEV) {
      console.warn(
        '[Tutorial] normalizeTutorialProgress: currentStepIndex is not a finite integer',
        rawIndex,
        '— resetting to 0',
      )
    }
    return { ...progress, currentStepIndex: 0 }
  }

  // Clamp to valid range
  const clamped = Math.max(0, Math.min(rawIndex, maxIndex))
  if (clamped !== rawIndex) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Tutorial] normalizeTutorialProgress: currentStepIndex ${rawIndex} out of range [0, ${maxIndex}] — clamped to ${clamped}`,
      )
    }
    return { ...progress, currentStepIndex: clamped }
  }

  return progress
}

/**
 * Loads tutorial progress from app settings.
 * Returns null if no progress exists. Migrates outdated versions to a reset state.
 * Normalizes step index on load to guard against corrupted data.
 */
export async function loadTutorialProgress(): Promise<TutorialProgress | null> {
  const settings = await loadAppSettings()
  const progress = settings.tutorialProgress ?? null

  if (progress === null) return null

  // Version migration: if stored version is older, treat as outdated and re-offer
  if (progress.tutorialVersion < CURRENT_TUTORIAL_VERSION) {
    // Reset completion state so the tutorial is re-offered
    return {
      ...INITIAL_TUTORIAL_PROGRESS,
      tutorialVersion: CURRENT_TUTORIAL_VERSION,
      hasCompleted: false,
    }
  }

  // Normalize step index to guard against corrupted/stale data
  return normalizeTutorialProgress(progress)
}

/**
 * Saves tutorial progress to app settings.
 */
export async function saveTutorialProgress(
  progress: TutorialProgress,
): Promise<void> {
  await updateAppSettings((current) => ({
    ...current,
    tutorialProgress: progress,
  }))
}

/**
 * Clears tutorial progress from app settings.
 */
export async function clearTutorialProgress(): Promise<void> {
  await updateAppSettings((current) => {
    const { tutorialProgress: _, ...rest } = current
    return rest as typeof current
  })
}
