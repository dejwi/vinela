import {
  AlertCircle,
  AlertTriangle,
  Blocks,
  Code2,
  FileCode2,
  Settings,
  Terminal,
  Variable,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import type { RunCustomActionTargetStatus } from '../custom-action-target-status'
import type { KeymapValidationIssue } from '../lib/keymap-validation'
import type { KeymapEntry } from '../types'
import { getActionSummary, getEntryDescription } from '../utils'

interface ActionSummaryProps {
  entry: KeymapEntry
  issues?: readonly KeymapValidationIssue[]
  /** Called when user clicks a graph link (for run-custom-action entries) */
  onNavigateToGraph?: (graphId: string) => void
  getRunCustomActionTargetStatus?: (
    graphId: string,
  ) => RunCustomActionTargetStatus
}

function getRunCustomActionStatusMessage(
  status: RunCustomActionTargetStatus,
): string {
  switch (status.kind) {
    case 'enabled':
      return ''
    case 'disabled':
      return `Target disabled: ${status.reason}`
    case 'missing':
      return 'Target graph missing'
    case 'not-callable':
      return 'Target graph is not callable'
  }
}

function ActionIcon({
  entry,
}: {
  entry: KeymapEntry
}): React.JSX.Element | null {
  if (entry.source === 'graph') {
    return <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  }

  switch (entry.keymap.action.actionType) {
    case 'run-action':
      return <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    case 'run-function':
      return <Code2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    case 'set-option':
      return <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    case 'set-variable':
      return <Variable className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    case 'code-block':
      return (
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )
    case 'run-custom-action':
      return <Blocks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    default: {
      // Exhaustiveness check
      ;((_exhaustive: never) => _exhaustive)(entry.keymap.action)
      return <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    }
  }
}

function CustomActionIconAndText({
  entry,
  displayText,
  tooltipText,
  statusMessage,
  targetStatus,
  canNavigateToGraph,
  onNavigateToGraph,
  issueIcon,
  issueMessage,
  hasIssues,
}: {
  entry: KeymapEntry & { source: 'project' }
  displayText: string
  tooltipText: string
  statusMessage: string
  targetStatus: RunCustomActionTargetStatus
  canNavigateToGraph: boolean
  onNavigateToGraph?: ((graphId: string) => void) | undefined
  issueIcon: React.JSX.Element | null
  issueMessage: string
  hasIssues: boolean
}): React.JSX.Element | null {
  // Must be a run-custom-action because we only render this conditionally
  if (entry.keymap.action.actionType !== 'run-custom-action') {
    return null
  }

  const graphId = entry.keymap.action.graphId

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <ActionIcon entry={entry} />
      <Tooltip>
        <TooltipTrigger asChild>
          {canNavigateToGraph ? (
            <button
              type="button"
              onClick={() => onNavigateToGraph?.(graphId)}
              className="truncate text-sm text-primary hover:underline text-left"
            >
              {displayText}
            </button>
          ) : (
            <span className="truncate text-sm text-left">{displayText}</span>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {canNavigateToGraph
            ? `Click to open this custom action in the Graph Editor. ${tooltipText}`
            : `This custom action target no longer exists. ${tooltipText}`}
        </TooltipContent>
      </Tooltip>

      {statusMessage.length > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={
                targetStatus.kind === 'missing' ||
                targetStatus.kind === 'not-callable'
                  ? 'shrink-0 text-destructive'
                  : 'shrink-0 text-amber-600'
              }
            >
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{statusMessage}</TooltipContent>
        </Tooltip>
      ) : hasIssues ? (
        <Tooltip>
          <TooltipTrigger asChild>{issueIcon}</TooltipTrigger>
          <TooltipContent>{issueMessage}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

export function ActionSummary({
  entry,
  issues = [],
  onNavigateToGraph,
  getRunCustomActionTargetStatus,
}: ActionSummaryProps): React.JSX.Element {
  const description = getEntryDescription(entry)
  const actionSummary = getActionSummary(entry)

  // Use description if provided, otherwise fall back to action summary
  const displayText = description.trim() || actionSummary
  const tooltipText = description.trim()
    ? `Action: ${actionSummary}`
    : 'No description provided'

  // Validation issues takes precedence for styling
  const hasErrors = issues.some((i) => i.level === 'error')
  const hasWarnings = issues.some((i) => i.level === 'warning')

  const issueIcon = hasErrors ? (
    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
  ) : hasWarnings ? (
    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
  ) : null

  const issueMessage = issues.length > 0 ? issues[0]?.message || '' : ''
  const hasIssues = issues.length > 0

  // Check if this is a manual keymap with run-custom-action
  if (
    entry.source === 'project' &&
    entry.keymap.action.actionType === 'run-custom-action'
  ) {
    const graphId = entry.keymap.action.graphId
    const targetStatus = getRunCustomActionTargetStatus
      ? getRunCustomActionTargetStatus(graphId)
      : ({ kind: 'enabled' } as const)
    const statusMessage = getRunCustomActionStatusMessage(targetStatus)
    const canNavigateToGraph =
      onNavigateToGraph !== undefined && targetStatus.kind !== 'missing'

    return (
      <CustomActionIconAndText
        entry={entry}
        displayText={displayText}
        tooltipText={tooltipText}
        statusMessage={statusMessage}
        targetStatus={targetStatus}
        canNavigateToGraph={canNavigateToGraph}
        onNavigateToGraph={onNavigateToGraph}
        issueIcon={issueIcon}
        issueMessage={issueMessage}
        hasIssues={hasIssues}
      />
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <ActionIcon entry={entry} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="truncate text-sm">{displayText}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
      {hasIssues && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{issueIcon}</span>
          </TooltipTrigger>
          <TooltipContent>{issueMessage}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
