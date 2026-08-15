import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import {
  clearPersistedActiveProjectPath,
  getPersistedActiveProjectPath,
  useProjectStore,
} from '@/features/projects/store'
import { useTutorialStore } from '@/features/tutorial/store'

/**
 * Route wrapper that requires a project to be loaded.
 * Redirects to home (start screen) if no project is active.
 *
 * Tutorial-aware recovery: if the project becomes null while a tutorial is
 * active, paused, loading, or completing, attempt to reopen the tutorial
 * project before redirecting. A one-shot `hasAttemptedRecovery` latch
 * prevents infinite retry loops — if recovery fails, the redirect proceeds.
 *
 * This prevents sidebar navigation from kicking the user back to the start
 * screen during transient null-project windows.
 */
export function RequireProject() {
  const currentProject = useProjectStore((state) => state.currentProject)
  const runtimeState = useTutorialStore((state) => state.runtimeState)
  const tutorialProjectPath = useTutorialStore(
    (state) => state.tutorialProjectPath,
  )

  // One-shot latch: true after the first recovery attempt fires.
  // Resets when the project becomes non-null (recovery succeeded).
  const hasAttemptedRecoveryRef = useRef(false)
  const hasAttemptedProjectRecoveryRef = useRef(false)
  // Track whether recovery is currently in flight.
  const [recoveryFailed, setRecoveryFailed] = useState(false)
  const [projectRecoveryFailed, setProjectRecoveryFailed] = useState(false)

  // Recoverable tutorial states: any state where the tutorial is in progress
  // and may have a valid project path to reopen.
  const isTutorialRecoverable =
    runtimeState.status === 'active' ||
    runtimeState.status === 'paused' ||
    runtimeState.status === 'loading' ||
    runtimeState.status === 'completing'

  // Reset latch when project is successfully loaded.
  useEffect(() => {
    if (currentProject !== null) {
      hasAttemptedRecoveryRef.current = false
      hasAttemptedProjectRecoveryRef.current = false
      setRecoveryFailed(false)
      setProjectRecoveryFailed(false)
    }
  }, [currentProject])

  // Recovery effect: if project is null during a recoverable tutorial state,
  // attempt to reopen the tutorial project once.
  useEffect(() => {
    if (currentProject !== null) return
    if (!isTutorialRecoverable) return
    if (tutorialProjectPath === null) return
    if (hasAttemptedRecoveryRef.current) return

    // Mark that we've attempted recovery (one-shot latch).
    hasAttemptedRecoveryRef.current = true

    // Attempt to reopen the tutorial project silently.
    void useProjectStore
      .getState()
      .openProjectForTutorial(tutorialProjectPath)
      .then((result) => {
        if (!result.success) {
          setRecoveryFailed(true)
        }
      })
      .catch(() => {
        // Recovery failed — allow redirect to home on next render.
        setRecoveryFailed(true)
      })
  }, [currentProject, isTutorialRecoverable, tutorialProjectPath])

  useEffect(() => {
    if (currentProject !== null) return
    if (isTutorialRecoverable) return
    if (hasAttemptedProjectRecoveryRef.current) return

    const persistedProjectPath = getPersistedActiveProjectPath()
    if (persistedProjectPath === null) return

    hasAttemptedProjectRecoveryRef.current = true

    void useProjectStore
      .getState()
      .openProject(persistedProjectPath)
      .then((result) => {
        if (!result.success) {
          clearPersistedActiveProjectPath()
          setProjectRecoveryFailed(true)
        }
      })
      .catch(() => {
        clearPersistedActiveProjectPath()
        setProjectRecoveryFailed(true)
      })
  }, [currentProject, isTutorialRecoverable])

  const persistedProjectPath = getPersistedActiveProjectPath()

  // While tutorial is recoverable and we haven't confirmed failure yet,
  // hold rendering to prevent a flash-redirect to "/" before recovery fires.
  if (
    currentProject === null &&
    isTutorialRecoverable &&
    tutorialProjectPath !== null &&
    !recoveryFailed
  ) {
    return null
  }

  if (
    currentProject === null &&
    !isTutorialRecoverable &&
    persistedProjectPath !== null &&
    !projectRecoveryFailed
  ) {
    return null
  }

  if (!currentProject) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
