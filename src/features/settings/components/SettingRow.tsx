import { RotateCcw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'

interface SettingRowProps {
  /** Display name of the setting */
  label: string
  /** Plain-language description */
  description: string
  /** Optional hint text shown below the control (e.g., "Tip: ...") */
  hint?: string
  /** The setting control (toggle, input, etc.) */
  children: React.ReactNode
  /** Unique ID for accessibility linking */
  htmlFor?: string
  /** Optional reset handler for this setting */
  onReset?: () => void
  /** True when current value differs from default */
  canReset?: boolean
}

export function SettingRow({
  label,
  description,
  hint,
  children,
  htmlFor,
  onReset,
  canReset = false,
}: SettingRowProps): React.JSX.Element {
  const descriptionId = htmlFor ? `${htmlFor}-desc` : undefined

  return (
    <div className="space-y-2">
      {/* Top row: label + description on left, control on right */}
      <div className="flex items-start justify-between gap-8">
        <div className="space-y-1 flex-1 min-w-0">
          <Label htmlFor={htmlFor} className="text-sm font-medium leading-none">
            {label}
          </Label>
          <p
            id={descriptionId}
            className="text-sm text-muted-foreground leading-relaxed"
          >
            {description}
          </p>
        </div>

        {/* Control (aligned to right, vertically centered with label) */}
        <div className="flex items-center gap-2 pt-0.5 shrink-0">
          {children}
          {canReset && onReset !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onReset}
                    aria-label="Reset to default"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset to default</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Hint text (below everything) */}
      {hint !== undefined && (
        <p className="text-xs text-muted-foreground/70 italic">{hint}</p>
      )}
    </div>
  )
}
