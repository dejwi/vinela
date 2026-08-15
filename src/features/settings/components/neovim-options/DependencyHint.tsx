import { AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

export interface DependencyHintProps {
  hint: string
  requiredOptionLabel: string
  onEnableRequired: () => void
}

export function DependencyHint({
  hint,
  requiredOptionLabel,
  onEnableRequired,
}: DependencyHintProps): React.JSX.Element {
  return (
    <div className="rounded-md border border-amber-300/70 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm">{hint}</p>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-amber-800 dark:text-amber-300"
            onClick={onEnableRequired}
          >
            Enable {requiredOptionLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
