/**
 * TutorialAutoStart component.
 *
 * Mounts in the app Layout alongside TutorialProvider.
 * On first render, checks tutorial progress and either:
 *   1. Auto-starts tutorial on first launch (no progress exists)
 *   2. Shows resume dialog if tutorial was interrupted
 *   3. Does nothing if tutorial was completed or explicitly skipped
 */
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Button } from '@/shared/components/ui/button'
import {
  CURRENT_TUTORIAL_VERSION,
  type TutorialProgress,
} from '@/shared/types/tutorial'
import { TUTORIAL_STEPS } from '../data/steps'
import { cleanupTutorialProject } from '../lifecycle'
import { loadTutorialProgress, saveTutorialProgress } from '../storage'
import { useTutorialStore } from '../store'

/**
 * Detects if a progress represents a migrated reset (version bump with fresh start).
 * This signature indicates the tutorial should auto-start once to re-offer to the user.
 */
function isMigratedResetSignature(progress: TutorialProgress): boolean {
  return (
    progress.tutorialVersion === CURRENT_TUTORIAL_VERSION &&
    progress.hasCompleted === false &&
    progress.isActive === false &&
    progress.currentStepIndex === 0 &&
    progress.startedAt === 0 &&
    progress.lastInteractedAt === 0 &&
    progress.tutorialProjectPath === null
  )
}

/**
 * Component that handles tutorial auto-start and resume dialog.
 * Mount in Layout alongside TutorialProvider.
 */
export function TutorialAutoStart(): React.ReactElement | null {
  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [resumeProgress, setResumeProgress] = useState<TutorialProgress | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function checkTutorial(): Promise<void> {
      const progress = await loadTutorialProgress()

      if (cancelled) return

      if (progress === null) {
        // First launch — auto-start tutorial
        await useTutorialStore.getState().startTutorial()
        return
      }

      if (progress.isActive && !progress.hasCompleted) {
        // Tutorial was interrupted — show resume dialog
        setResumeProgress(progress)
        setShowResumeDialog(true)
        return
      }

      // Phase 7: Version bump re-offer — auto-start once after migration
      if (isMigratedResetSignature(progress)) {
        await useTutorialStore.getState().startTutorial()
        return
      }

      // Tutorial completed or explicitly skipped — do nothing
    }

    void checkTutorial()

    return () => {
      cancelled = true
    }
  }, [])

  const handleResume = async (): Promise<void> => {
    setShowResumeDialog(false)
    if (resumeProgress !== null) {
      // Use dedicated resume action to restore exact saved step index.
      // This is separate from startTutorial() which always starts at step 0.
      await useTutorialStore
        .getState()
        .resumeTutorialAtStep(resumeProgress.currentStepIndex)
    }
  }

  const handleStartOver = async (): Promise<void> => {
    setShowResumeDialog(false)
    // Clean up old tutorial project if it exists
    if (
      resumeProgress?.tutorialProjectPath !== null &&
      resumeProgress?.tutorialProjectPath !== undefined
    ) {
      await cleanupTutorialProject(resumeProgress.tutorialProjectPath)
    }
    await useTutorialStore.getState().startTutorial(0)
  }

  const handleDismiss = async (): Promise<void> => {
    setShowResumeDialog(false)
    // Mark tutorial as inactive (user dismissed resume dialog)
    if (resumeProgress !== null) {
      await saveTutorialProgress({
        ...resumeProgress,
        isActive: false,
      })
    }
    // Clean up old tutorial project
    if (
      resumeProgress?.tutorialProjectPath !== null &&
      resumeProgress?.tutorialProjectPath !== undefined
    ) {
      await cleanupTutorialProject(resumeProgress.tutorialProjectPath)
    }
  }

  if (!showResumeDialog) {
    return null
  }

  const stepNumber = (resumeProgress?.currentStepIndex ?? 0) + 1
  const totalSteps = TUTORIAL_STEPS.length

  return (
    <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resume Tutorial?</AlertDialogTitle>
          <AlertDialogDescription>
            You were on step {stepNumber} of {totalSteps}. Would you like to
            continue where you left off?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => void handleDismiss()}>
            Dismiss
          </AlertDialogCancel>
          <Button variant="outline" onClick={() => void handleStartOver()}>
            Start Over
          </Button>
          <AlertDialogAction onClick={() => void handleResume()}>
            Resume
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
