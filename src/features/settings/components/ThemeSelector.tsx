import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

interface ThemeSelectorProps {
  /** Current theme value */
  value: 'light' | 'dark' | 'system'
  /** Called when theme changes */
  onChange: (theme: 'light' | 'dark' | 'system') => void
  /** Optional reset handler (sets theme back to system) */
  onReset?: () => void
  /** Show reset affordance when true */
  canReset?: boolean
}

const THEME_OPTIONS = [
  {
    value: 'light' as const,
    label: 'Light',
    icon: Sun,
    description:
      'Bright background with dark text. Best for well-lit environments.',
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    icon: Moon,
    description:
      'Dark background with light text. Easier on your eyes in dim lighting.',
  },
  {
    value: 'system' as const,
    label: 'System',
    icon: Monitor,
    description: "Automatically matches your computer's appearance setting.",
  },
] as const

export function ThemeSelector({
  value,
  onChange,
  onReset,
  canReset = false,
}: ThemeSelectorProps): React.JSX.Element {
  return (
    <div className="space-y-3">
      {/* Label and description */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Theme</h3>
        <p className="text-sm text-muted-foreground">
          Choose how the app looks. You can match your system's theme or pick
          your own.
        </p>
      </div>

      {/* Toggle group + reset */}
      <div className="flex items-center gap-2">
        <fieldset className="inline-flex rounded-lg border bg-muted/30 p-1 gap-1">
          <legend className="sr-only">Theme</legend>
          {THEME_OPTIONS.map(
            ({ value: optValue, label, icon: Icon, description }) => (
              <label
                key={optValue}
                htmlFor={`theme-${optValue}`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all cursor-pointer',
                  'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                  value === optValue
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                )}
                title={`${label}: ${description}`}
              >
                <input
                  type="radio"
                  id={`theme-${optValue}`}
                  name="theme"
                  value={optValue}
                  checked={value === optValue}
                  onChange={() => onChange(optValue)}
                  className="sr-only"
                  aria-label={`${label}: ${description}`}
                />
                <Icon className="h-4 w-4" />
                {label}
              </label>
            ),
          )}
        </fieldset>

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
  )
}
