/**
 * OptionsList Component
 *
 * Flat list of option cards. Renders NeovimOptionCard for each option.
 */

import type {
  NeovimOptionDefinition,
  NeovimOptionStoredValue,
  OptionConflictSummary,
  OptionDependency,
} from '@/shared/types/neovim-options'
import { NeovimOptionCard } from './NeovimOptionCard'

export interface OptionsListProps {
  /** Options to display */
  options: NeovimOptionDefinition[]
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
  /** Enable dependency handler */
  onEnableDependency: (dependency: OptionDependency) => void
  /** Optional function to render custom control for specific options */
  renderCustomControl?: (
    option: NeovimOptionDefinition,
  ) => React.ReactNode | undefined
}

export function OptionsList({
  options,
  getOptionValue,
  effectiveValues,
  isModified,
  conflicts,
  onChange,
  onReset,
  onEnableDependency,
  renderCustomControl,
}: OptionsListProps): React.JSX.Element {
  if (options.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No options match your filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
  )
}
