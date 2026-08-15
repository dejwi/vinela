import { AlertTriangle, CheckCircle2, Loader2, Play } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { selectIsOperationInProgress, useGenerationStore } from '../store'
import type { GenerationDialogPhase, GenerationResult } from '../types'
import { countByLevel } from '../types'

function getButtonState(
  dialogPhase: GenerationDialogPhase,
  lastResult: GenerationResult | null,
): {
  icon: React.ReactNode
  tooltipText: string
  variant: 'default' | 'success' | 'error'
} {
  // During active operations
  if (dialogPhase.type === 'deploying') {
    return {
      icon: <Loader2 className="w-5 h-5 animate-spin" />,
      tooltipText: 'Deploying...',
      variant: 'default',
    }
  }

  if (dialogPhase.type === 'generation') {
    const t = dialogPhase.progress.type
    const isActive =
      t === 'validating' ||
      t === 'generating-sections' ||
      t === 'generating-graphs' ||
      t === 'validating-output'
    if (isActive) {
      return {
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
        tooltipText: 'Generating...',
        variant: 'default',
      }
    }
  }

  // After successful generation/deploy
  if (lastResult?.success === true) {
    const hasErrorDiagnostics = lastResult.diagnostics.some(
      (d) => d.severity === 'error',
    )
    return {
      icon: hasErrorDiagnostics ? (
        <AlertTriangle className="w-5 h-5" />
      ) : (
        <CheckCircle2 className="w-5 h-5" />
      ),
      tooltipText: hasErrorDiagnostics
        ? 'Generation has errors — click to view'
        : 'Generate Lua Config',
      variant: hasErrorDiagnostics ? 'error' : 'success',
    }
  }

  // After failed generation
  if (lastResult?.success === false) {
    return {
      icon: <AlertTriangle className="w-5 h-5" />,
      tooltipText: 'Generation failed — click to view',
      variant: 'error',
    }
  }

  // Default idle state
  return {
    icon: <Play className="w-5 h-5" />,
    tooltipText: 'Generate Lua Config',
    variant: 'default',
  }
}

export function GenerateButton(): React.JSX.Element {
  const openDialog = useGenerationStore((s) => s.openDialog)
  const dialogPhase = useGenerationStore((s) => s.dialogPhase)
  const lastResult = useGenerationStore((s) => s.lastResult)
  const isOperating = useGenerationStore(selectIsOperationInProgress)

  // Determine icon and visual state
  const { icon, tooltipText, variant } = getButtonState(dialogPhase, lastResult)

  // Count issues from last result for badge
  const errorCount = lastResult
    ? countByLevel(lastResult.diagnostics, 'error')
    : 0
  const warningCount = lastResult
    ? countByLevel(lastResult.diagnostics, 'warning')
    : 0
  const totalIssues = errorCount + warningCount

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <Button
            variant="default"
            size="icon"
            className={cn(
              'w-10 h-10',
              // Accent styling to stand out
              variant === 'success' &&
                'bg-green-600 hover:bg-green-700 text-white',
              variant === 'error' &&
                'bg-destructive hover:bg-destructive/90 text-white',
            )}
            onClick={openDialog}
            disabled={isOperating}
            aria-label={tooltipText}
          >
            {icon}
          </Button>

          {/* Issue count badge */}
          {totalIssues > 0 && !isOperating && (
            <Badge
              variant={errorCount > 0 ? 'destructive' : 'secondary'}
              className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[10px]"
            >
              {totalIssues}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  )
}
