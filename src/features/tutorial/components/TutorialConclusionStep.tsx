import type React from 'react'
import { Button } from '@/shared/components/ui/button'

interface TutorialConclusionStepProps {
  /** Called when user clicks "Close Tutorial Project" (primary action) */
  readonly onFinish: () => void
  /** Called when user clicks "Keep Exploring" (secondary action) */
  readonly onKeepExploring: () => void
}

const CONCLUSION_BULLETS: readonly string[] = [
  'Install plugins to extend Neovim capabilities',
  'Create keyboard shortcuts for quick actions',
  'Configure Neovim options for your workflow',
  'Browse and install color schemes',
  'Build custom multi-step actions in the Graph Editor (advanced)',
  'Customize app settings and set your output path',
]

/**
 * Conclusion step for the tutorial.
 *
 * Shown as the final step — replaces the standard TutorialControls with
 * two explicit choices:
 *   - "Close Tutorial Project" (primary): completes and cleans up
 *   - "Keep Exploring" (secondary): marks complete but leaves project open
 */
export function TutorialConclusionStep({
  onFinish,
  onKeepExploring,
}: TutorialConclusionStepProps): React.ReactElement {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        You now know how to:
      </p>

      <ul className="space-y-1.5" aria-label="Tutorial summary">
        {CONCLUSION_BULLETS.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-sm">
            <span className="text-green-500 mt-0.5 shrink-0" aria-hidden="true">
              ✓
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground italic">
        💡 You can replay this tutorial anytime from <strong>Settings</strong>.
      </p>

      <div className="flex flex-col gap-2 pt-1 border-t">
        <Button
          size="sm"
          onClick={onFinish}
          data-testid="conclusion-finish-button"
        >
          Close Tutorial Project
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onKeepExploring}
          data-testid="conclusion-keep-exploring-button"
        >
          Keep Exploring
        </Button>
      </div>
    </div>
  )
}
