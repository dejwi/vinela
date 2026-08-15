/**
 * GroupedOptionsList Component
 *
 * Groups options by category with category headers.
 * Shows section actions per category (reset all modified).
 * Supports "show only changed" filter per category.
 */

import { RotateCcw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from '@/shared/lib/neovim-options/catalog'
import type {
  NeovimOptionCategory,
  NeovimOptionDefinition,
  NeovimOptionStoredValue,
  OptionConflictSummary,
  OptionDependency,
} from '@/shared/types/neovim-options'
import { NeovimOptionCard } from './NeovimOptionCard'

export interface GroupedOptionsListProps {
  /** Options grouped by category */
  groupedOptions: Record<NeovimOptionCategory, NeovimOptionDefinition[]>
  /** Count of modified options per category */
  modifiedByCategory: Record<string, number>
  /** Function to get current value for an option */
  getOptionValue: (optionName: string) => NeovimOptionStoredValue
  /** All effective values (for dependency checking) */
  effectiveValues: Record<string, NeovimOptionStoredValue>
  /** Function to check if an option is modified from default */
  isModified: (optionName: string) => boolean
  /** Conflicts map */
  conflicts: Record<string, OptionConflictSummary>
  /** Change handler */
  onChange: (optionName: string, value: NeovimOptionStoredValue) => void
  /** Reset handler */
  onReset: (optionName: string) => void
  /** Reset category handler */
  onResetCategory: (category: NeovimOptionCategory) => void
  /** Enable dependency handler */
  onEnableDependency: (dependency: OptionDependency) => void
  /** Optional function to render custom control for specific options */
  renderCustomControl?: (
    option: NeovimOptionDefinition,
  ) => React.ReactNode | undefined
}

export function GroupedOptionsList({
  groupedOptions,
  modifiedByCategory,
  getOptionValue,
  effectiveValues,
  isModified,
  conflicts,
  onChange,
  onReset,
  onResetCategory,
  onEnableDependency,
  renderCustomControl,
}: GroupedOptionsListProps): React.JSX.Element {
  // Filter to only categories that have options
  const categoriesWithOptions = CATEGORY_ORDER.filter(
    (category) => (groupedOptions[category]?.length ?? 0) > 0,
  )

  if (categoriesWithOptions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No options match your filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {categoriesWithOptions.map((category) => {
        const options = groupedOptions[category]
        const modifiedCount = modifiedByCategory[category] ?? 0
        const hasModified = modifiedCount > 0

        return (
          <section key={category} className="space-y-3">
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                  {CATEGORY_LABELS[category]}
                </h3>
                <span className="text-xs text-muted-foreground">
                  ({options.length})
                </span>
              </div>

              {hasModified && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onResetCategory(category)}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset {modifiedCount}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {options.map((option) => (
                <NeovimOptionCard
                  key={option.name}
                  option={option}
                  value={getOptionValue(option.name)}
                  effectiveValues={effectiveValues}
                  isModified={isModified(option.name)}
                  conflict={conflicts[option.name]}
                  onChange={(value) => onChange(option.name, value)}
                  onReset={() => onReset(option.name)}
                  onEnableDependency={onEnableDependency}
                  customControl={renderCustomControl?.(option)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
