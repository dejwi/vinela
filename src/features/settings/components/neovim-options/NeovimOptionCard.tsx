import { RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { getOptionDefinition } from '@/shared/lib/neovim-options/catalog'
import type {
  NeovimOptionDefinition,
  NeovimOptionStoredValue,
  OptionConflictSummary,
  OptionDependency,
} from '@/shared/types/neovim-options'
import { CommunityBadge } from './CommunityBadge'
import { ConflictBadge } from './ConflictBadge'
import { DependencyHint } from './DependencyHint'
import { NeovimOptionInput } from './NeovimOptionInput'

function formatDefaultValue(
  defaultValue: boolean | number | string | readonly string[],
): string {
  if (Array.isArray(defaultValue)) {
    return defaultValue.length > 0 ? defaultValue.join(', ') : '(empty)'
  }
  if (typeof defaultValue === 'boolean') {
    return defaultValue ? 'true' : 'false'
  }
  if (typeof defaultValue === 'string') {
    return defaultValue.length > 0 ? defaultValue : '(empty)'
  }
  return String(defaultValue)
}

function isDependencySatisfied(
  dependency: OptionDependency,
  currentValue: NeovimOptionStoredValue | undefined,
): boolean {
  if (currentValue === undefined) {
    return false
  }

  if (dependency.requiredValue !== undefined) {
    if (
      currentValue.valueType === 'boolean' &&
      typeof dependency.requiredValue === 'boolean'
    ) {
      return currentValue.value === dependency.requiredValue
    }

    if (
      currentValue.valueType === 'number' &&
      typeof dependency.requiredValue === 'number'
    ) {
      return currentValue.value === dependency.requiredValue
    }

    if (
      currentValue.valueType === 'string' &&
      typeof dependency.requiredValue === 'string'
    ) {
      return currentValue.value === dependency.requiredValue
    }

    if (
      (currentValue.valueType === 'string-list' ||
        currentValue.valueType === 'char-list') &&
      typeof dependency.requiredValue === 'string'
    ) {
      return currentValue.value.includes(dependency.requiredValue)
    }

    return false
  }

  if (currentValue.valueType === 'boolean') {
    return currentValue.value === true
  }

  if (currentValue.valueType === 'number') {
    return currentValue.value !== 0
  }

  if (currentValue.valueType === 'string') {
    return currentValue.value.length > 0
  }

  return currentValue.value.length > 0
}

export interface NeovimOptionCardProps {
  option: NeovimOptionDefinition
  value: NeovimOptionStoredValue
  effectiveValues: Record<string, NeovimOptionStoredValue>
  isModified: boolean
  conflict: OptionConflictSummary | undefined
  onChange: (value: NeovimOptionStoredValue) => void
  onReset: () => void
  onEnableDependency: (dependency: OptionDependency) => void
  /** Optional custom control to render instead of NeovimOptionInput */
  customControl?: React.ReactNode
}

export function NeovimOptionCard({
  option,
  value,
  effectiveValues,
  isModified,
  conflict,
  onChange,
  onReset,
  onEnableDependency,
  customControl,
}: NeovimOptionCardProps): React.JSX.Element {
  const unmetDependencies = useMemo(() => {
    return (option.dependencies ?? []).filter((dependency) => {
      return !isDependencySatisfied(
        dependency,
        effectiveValues[dependency.optionName],
      )
    })
  }, [option.dependencies, effectiveValues])

  const formattedDefault = formatDefaultValue(option.defaultValue)

  return (
    <Card
      className={isModified ? 'border-primary/40' : undefined}
      data-tutorial={`neovim-option-${option.name}`}
    >
      <CardHeader className="p-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold leading-tight">
              {option.label}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-mono">
              {option.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {option.isCommunityRecommended && <CommunityBadge />}
            <ConflictBadge
              conflict={conflict ?? { type: 'none', locations: [] }}
            />

            {isModified && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={onReset}
                      aria-label={`Reset ${option.label} to default`}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Reset to default: {formattedDefault}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <CardDescription className="text-sm">
          {option.whatItDoes}
        </CardDescription>
        <p className="text-xs text-muted-foreground">{option.whenToUse}</p>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        {unmetDependencies.map((dependency) => {
          const requiredOption = getOptionDefinition(dependency.optionName)

          return (
            <DependencyHint
              key={`${option.name}-${dependency.optionName}`}
              hint={dependency.hint}
              requiredOptionLabel={
                requiredOption?.label ?? dependency.optionName
              }
              onEnableRequired={() => onEnableDependency(dependency)}
            />
          )
        })}

        {customControl ?? (
          <NeovimOptionInput
            option={option}
            value={value}
            onChange={onChange}
          />
        )}

        {option.technicalNote !== undefined && (
          <details className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">
              Advanced details
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              {option.technicalNote}
            </p>
          </details>
        )}

        <p className="text-xs text-muted-foreground">
          Default: {formattedDefault} ({option.defaultSource})
        </p>
      </CardContent>
    </Card>
  )
}
