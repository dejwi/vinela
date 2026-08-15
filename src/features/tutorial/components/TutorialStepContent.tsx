import type React from 'react'
import { renderSimpleMarkdown } from '@/features/tutorial/utils'

interface TutorialStepContentProps {
  readonly content: string
  readonly hint?: string | undefined
}

/**
 * Renders tutorial step content with simple markdown support and an optional hint.
 */
export function TutorialStepContent({
  content,
  hint,
}: TutorialStepContentProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="text-sm leading-relaxed" aria-live="polite">
        {renderSimpleMarkdown(content)}
      </div>
      {hint !== undefined && (
        <p className="text-xs text-muted-foreground italic">💡 {hint}</p>
      )}
    </div>
  )
}
