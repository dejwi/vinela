import { AlertTriangle, ChevronDown, ExternalLink, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import { useNavigationIntentStore } from '@/shared/lib/navigation-intent'
import { useGenerationStore } from '../store'
import type { GenerationDiagnostic } from '../types'
import { countByLevel, isNavigable } from '../types'

interface DiagnosticListProps {
  diagnostics: readonly GenerationDiagnostic[]
  /** When true, hides the summary header (used inside tab layout) */
  embedded?: boolean
}

function getDiagnosticKey(
  diagnostic: GenerationDiagnostic,
  index: number,
): string {
  const sourcePart = diagnostic.source
    ? `${diagnostic.source.graphId ?? ''}-${diagnostic.source.nodeId ?? ''}`
    : ''
  return `${diagnostic.id}-${diagnostic.severity}-${sourcePart}-${index}`
}

export function DiagnosticList({
  diagnostics,
  embedded = false,
}: DiagnosticListProps): React.JSX.Element {
  const errorCount = countByLevel(diagnostics, 'error')
  const warningCount = countByLevel(diagnostics, 'warning')

  // Sort: errors first, then warnings
  const sorted = [...diagnostics].sort((a, b) => {
    const order: Record<GenerationDiagnostic['severity'], number> = {
      error: 0,
      warning: 1,
    }
    return order[a.severity] - order[b.severity]
  })

  return (
    <div className="space-y-2">
      {/* Summary badges — hidden when embedded inside tab layout */}
      {!embedded && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Diagnostics</span>
          {errorCount > 0 && (
            <Badge variant="destructive">
              {errorCount} error{errorCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary">
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      )}

      {/* Diagnostic items */}
      <div className="space-y-3">
        {sorted.map((diagnostic, index) => (
          <DiagnosticItem
            key={getDiagnosticKey(diagnostic, index)}
            diagnostic={diagnostic}
          />
        ))}
      </div>
    </div>
  )
}

function DiagnosticItem({
  diagnostic,
}: {
  diagnostic: GenerationDiagnostic
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(diagnostic.severity === 'error')
  const navigate = useNavigate()
  const closeDialog = useGenerationStore((s) => s.closeDialog)
  const navigable = isNavigable(diagnostic)

  const handleNavigate = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (
      !navigable ||
      diagnostic.source?.graphId === undefined ||
      diagnostic.source?.nodeId === undefined
    ) {
      return
    }

    // Set navigation intent
    useNavigationIntentStore.getState().setFocusNode({
      graphId: diagnostic.source.graphId,
      nodeId: diagnostic.source.nodeId,
    })

    // Close dialog and navigate to editor
    closeDialog()
    navigate('/editor')
  }

  const hasExpandableContent =
    diagnostic.details !== undefined ||
    (diagnostic.suggestions !== undefined &&
      diagnostic.suggestions.length > 0) ||
    navigable

  return (
    <Card
      className={`p-4 ${hasExpandableContent ? 'cursor-pointer' : ''}`}
      onClick={hasExpandableContent ? () => setIsOpen((o) => !o) : undefined}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          className="flex items-center gap-2 w-full text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <LevelIcon level={diagnostic.severity} />
          <span className="text-base font-medium flex-1 min-w-0 break-words">
            {diagnostic.message}
          </span>
          {hasExpandableContent && (
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180"
              data-state={isOpen ? 'open' : 'closed'}
            />
          )}
        </CollapsibleTrigger>

        {hasExpandableContent && (
          <CollapsibleContent className="pl-7 pt-2 space-y-2">
            {diagnostic.details !== undefined && (
              <p className="text-sm text-muted-foreground">
                {diagnostic.details}
              </p>
            )}

            {diagnostic.suggestions !== undefined &&
              diagnostic.suggestions.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Suggestions:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {diagnostic.suggestions.map((s, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: stable list from diagnostic
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

            {navigable && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-sm"
                onClick={handleNavigate}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Go to{' '}
                {diagnostic.source?.graphName ??
                  diagnostic.source?.graphId ??
                  'graph'}
              </Button>
            )}
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  )
}

function LevelIcon({
  level,
}: {
  level: GenerationDiagnostic['severity']
}): React.JSX.Element {
  switch (level) {
    case 'error':
      return <XCircle className="h-5 w-5 text-destructive shrink-0" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
  }
}
