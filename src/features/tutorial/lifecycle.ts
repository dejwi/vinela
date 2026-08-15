/**
 * Tutorial project lifecycle functions.
 *
 * Implements safe project creation, cleanup, and opening for the tutorial.
 * Three-layer safety for cleanup (Fix #1):
 *   1. Strict path pattern validation
 *   2. Sentinel marker file check
 *   3. Unique per-run folder names with timestamp
 */
import { TUTORIAL_SENTINEL } from '@/shared/lib/app-identity'
import { PROJECT_PATHS } from '@/shared/lib/paths'
import { getProjectStorageBackend } from '@/shared/lib/storage'
import type { StorageBackend } from '@/shared/lib/storage-backend'
import {
  createTutorialSeedData,
  TUTORIAL_SEED_VERSION,
} from './data/seed-project'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Version file that tracks the seed data version for stale detection */
const TUTORIAL_VERSION_FILE = 'tutorial-version.json'

/** Identifier substring used in all tutorial project folder names */
const TUTORIAL_PATH_PREFIX = '/memory/projects/tutorial-'

// ── Path Helpers ──────────────────────────────────────────────────────────────

/**
 * Validates that a path is safe to delete as a tutorial project.
 * Memory mode: must start with /memory/projects/tutorial-
 */
function isSafeTutorialPath(projectPath: string): boolean {
  return projectPath.startsWith(TUTORIAL_PATH_PREFIX)
}

// ── Cleanup Helpers ───────────────────────────────────────────────────────────

/**
 * Removes all files for a tutorial project in memory mode.
 * Enumerates known files and graph directory entries.
 */
async function removeMemoryProjectFiles(
  backend: StorageBackend,
  projectPath: string,
): Promise<void> {
  const filesToRemove = [
    TUTORIAL_SENTINEL,
    PROJECT_PATHS.PROJECT_JSON,
    PROJECT_PATHS.KEYMAPS,
    PROJECT_PATHS.NEOVIM_OPTIONS,
  ]

  for (const file of filesToRemove) {
    try {
      await backend.removeProjectFile(projectPath, file)
    } catch {
      // Ignore individual file removal failures
    }
  }

  // Remove graph files
  try {
    const graphEntries = await backend.listProjectDir(
      projectPath,
      PROJECT_PATHS.GRAPHS,
    )
    for (const entry of graphEntries) {
      try {
        await backend.removeProjectFile(
          projectPath,
          `${PROJECT_PATHS.GRAPHS}/${entry.name}`,
        )
      } catch {
        // Ignore individual graph removal failures
      }
    }
  } catch {
    // Ignore if graphs dir doesn't exist
  }
}

/**
 * Creates the tutorial project on disk (or in memory mode).
 * Returns the project path.
 *
 * Safety: Writes a sentinel marker file for safe cleanup (Fix #1).
 * Uses unique per-run folder names with timestamp to prevent collisions.
 */
export async function createTutorialProject(): Promise<string> {
  const timestamp = Date.now()
  const tutorialPath = `${TUTORIAL_PATH_PREFIX}${timestamp}`
  const backend = await getProjectStorageBackend(tutorialPath)

  // Create directory structure
  await backend.ensureProjectDir(tutorialPath, '')
  await backend.ensureProjectDir(tutorialPath, PROJECT_PATHS.GRAPHS)
  await backend.ensureProjectDir(tutorialPath, PROJECT_PATHS.SCHEMAS)

  // Write sentinel marker file FIRST (Fix #1)
  await backend.writeProjectTextFile(
    tutorialPath,
    TUTORIAL_SENTINEL,
    `tutorial-project-created-at-${timestamp}`,
  )

  // Write seed data
  const seed = createTutorialSeedData()

  // Write tutorial version file for stale detection
  await backend.writeProjectFile(tutorialPath, TUTORIAL_VERSION_FILE, {
    version: seed.version,
  })
  await backend.writeProjectFile(
    tutorialPath,
    PROJECT_PATHS.PROJECT_JSON,
    seed.project,
  )

  for (const graph of seed.graphs) {
    await backend.writeProjectFile(
      tutorialPath,
      `${PROJECT_PATHS.GRAPHS}/${graph.id}.json`,
      graph,
    )
  }

  await backend.writeProjectFile(
    tutorialPath,
    PROJECT_PATHS.KEYMAPS,
    seed.keymaps,
  )
  await backend.writeProjectFile(
    tutorialPath,
    PROJECT_PATHS.NEOVIM_OPTIONS,
    seed.neovimOptions,
  )

  return tutorialPath
}

/**
 * Cleans up the tutorial project at the given path.
 *
 * Three-layer safety (Fix #1):
 * 1. Validates path matches expected pattern (strict path guard)
 * 2. Checks for sentinel marker file before deleting
 * 3. Silently returns on any validation failure (non-fatal)
 */
export async function cleanupTutorialProject(
  projectPath: string,
): Promise<void> {
  try {
    // Guard 1: Path pattern validation
    if (!isSafeTutorialPath(projectPath)) {
      console.warn(
        `[Tutorial] Refusing to clean up suspicious path: ${projectPath}`,
      )
      return
    }

    const backend = await getProjectStorageBackend(projectPath)

    // Guard 2: Sentinel file must exist
    const hasSentinel = await backend.projectFileExists(
      projectPath,
      TUTORIAL_SENTINEL,
    )
    if (!hasSentinel) {
      console.warn(
        `[Tutorial] No sentinel file found at ${projectPath}, skipping cleanup`,
      )
      return
    }

    // Safe to delete
    await removeMemoryProjectFiles(backend, projectPath)
  } catch (error) {
    // Cleanup failures are non-fatal — log and continue
    console.warn('[Tutorial] Cleanup failed:', error)
  }
}

/**
 * Opens the tutorial project using the project store.
 * Uses openProjectForTutorial to skip adding to recents (Fix #2).
 */
export async function openTutorialProject(projectPath: string): Promise<void> {
  // Dynamic import to avoid circular dependency at module load time
  const { useProjectStore } = await import('@/features/projects/store')
  const result = await useProjectStore
    .getState()
    .openProjectForTutorial(projectPath)
  if (!result.success) {
    throw new Error(`Failed to open tutorial project: ${result.message}`)
  }
}

// ── Version & Stale Detection ─────────────────────────────────────────────────

/**
 * Checks if a tutorial project is stale (outdated compared to current seed version).
 * Returns true if the project needs to be recreated with fresh seed data.
 */
export async function isTutorialStale(projectPath: string): Promise<boolean> {
  try {
    const backend = await getProjectStorageBackend(projectPath)
    const versionFile = await backend.readProjectFile<{
      version: number
    }>(projectPath, TUTORIAL_VERSION_FILE)
    return versionFile.version < TUTORIAL_SEED_VERSION
  } catch {
    // No version file = version 1 (pre-versioning) = stale
    return true
  }
}
