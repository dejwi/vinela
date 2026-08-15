import { useMemo } from 'react'
import { ActionEditorFrame } from '@/shared/components/action-editor/ActionEditorFrame'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { SelectItemWithInfo } from '@/shared/components/ui/select-item-with-info'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import {
  getOptionDefinition,
  NEOVIM_OPTIONS_CATALOG,
} from '@/shared/lib/neovim-options/catalog'
import type { SetOptionFormProps, SetOptionFormValidationResult } from './types'

// Local helper type for suggested value entries
interface SuggestedValueEntry {
  value: string | number | boolean
  label?: string
  description: string
}

// ============================================
// Helper Functions
// ============================================

/**
 * Derive suggested values from option metadata.
 * Returns choices for options with choices, or boolean defaults for booleans.
 */
function deriveSuggestedValues(
  option: ReturnType<typeof getOptionDefinition>,
): SuggestedValueEntry[] | null {
  if (!option) return null

  if (option.choices && option.choices.length > 0) {
    return option.choices.map((c) => ({
      value: c.value,
      label: c.label,
      description: c.description,
    }))
  }

  if (option.valueType === 'boolean') {
    return [
      { value: true, description: 'Enable this option' },
      { value: false, description: 'Disable this option' },
    ]
  }

  return null
}

// ============================================
// Validation Functions
// ============================================

function validateOptionExists(optionName: string): string[] {
  const option = getOptionDefinition(optionName)
  if (option) {
    return []
  }
  return [
    "We don't have a preset for this option. You can still use Custom mode to set any value.",
  ]
}

function validateSuggestedValueMembership(
  option: ReturnType<typeof getOptionDefinition>,
  valueConfig: SetOptionFormProps['config']['valueConfig'],
  isValueConnected: boolean,
): string[] {
  // Skip validation when value comes from connected port
  if (isValueConnected || !option || valueConfig.valueMode !== 'suggested') {
    return []
  }

  const suggestedValues = deriveSuggestedValues(option)
  if (!suggestedValues) {
    return []
  }

  const isMember = suggestedValues.some(
    (entry) => entry.value === valueConfig.suggestedValue,
  )
  if (isMember) {
    return []
  }

  return [
    `Value ${String(valueConfig.suggestedValue)} is not in the list of suggested values for ${option.name}.`,
  ]
}

function validateNumberConstraints(
  option: ReturnType<typeof getOptionDefinition>,
  valueConfig: SetOptionFormProps['config']['valueConfig'],
  isValueConnected: boolean,
): string[] {
  // Skip validation when value comes from connected port
  if (
    isValueConnected ||
    !option ||
    option.valueType !== 'number' ||
    valueConfig.valueMode !== 'suggested'
  ) {
    return []
  }

  const value =
    typeof valueConfig.suggestedValue === 'number'
      ? valueConfig.suggestedValue
      : null
  if (value === null) {
    return []
  }

  const errors: string[] = []
  if (option.min !== undefined && value < option.min) {
    errors.push(`Value must be >= ${option.min}.`)
  }
  if (option.max !== undefined && value > option.max) {
    errors.push(`Value must be <= ${option.max}.`)
  }
  return errors
}

export function validateSetOptionForm(
  config: SetOptionFormProps['config'],
  isValueConnected = false,
): SetOptionFormValidationResult {
  const option = getOptionDefinition(config.optionName)

  const errors = [
    ...validateOptionExists(config.optionName),
    ...validateSuggestedValueMembership(
      option,
      config.valueConfig,
      isValueConnected,
    ),
    ...validateNumberConstraints(option, config.valueConfig, isValueConnected),
  ]

  return { errors, warnings: [] }
}

// ============================================
// Sub-components
// ============================================

interface SuggestedValueSelectProps {
  valueConfig: SetOptionFormProps['config']['valueConfig']
  suggestedValues: readonly SuggestedValueEntry[]
  onChange: (valueConfig: SetOptionFormProps['config']['valueConfig']) => void
}

function SuggestedValueSelect({
  valueConfig,
  suggestedValues,
  onChange,
}: SuggestedValueSelectProps): React.JSX.Element {
  // Find the index of the current value to use as the select value
  const currentIndex =
    valueConfig.valueMode === 'suggested'
      ? suggestedValues.findIndex(
          (entry) => entry.value === valueConfig.suggestedValue,
        )
      : -1
  const currentValue = currentIndex >= 0 ? String(currentIndex) : ''

  return (
    <Select
      value={currentValue}
      onValueChange={(selectedIndex) => {
        const entry = suggestedValues[Number(selectedIndex)]
        if (entry) {
          onChange({
            valueMode: 'suggested',
            suggestedValue: entry.value,
          })
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a value">
          {(() => {
            const entry =
              currentIndex >= 0 ? suggestedValues[currentIndex] : undefined
            return entry ? (entry.label ?? String(entry.value)) : ''
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[var(--radix-select-trigger-width)]">
        {suggestedValues.map((entry, index) => (
          <SelectItemWithInfo
            key={`${index}-${typeof entry.value}`}
            value={String(index)}
            title={entry.label ?? String(entry.value)}
            description={entry.description}
            tooltipContent={entry.description}
            iconPosition="far-right"
          />
        ))}
      </SelectContent>
    </Select>
  )
}

interface ValueSectionProps {
  config: SetOptionFormProps['config']
  isConnected: boolean
  onChange: (config: SetOptionFormProps['config']) => void
}

function ValueSection({
  config,
  isConnected,
  onChange,
}: ValueSectionProps): React.JSX.Element {
  const option = getOptionDefinition(config.optionName)
  const suggestedValues = deriveSuggestedValues(option)

  if (isConnected) {
    return (
      <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
        <p>
          Value comes from connected input port. Disconnect to edit a local
          fallback.
        </p>
      </div>
    )
  }

  // UI shows "Preset" and "Custom" but internal data model uses 'suggested' and 'raw'
  const handleModeChange = (uiMode: 'preset' | 'custom'): void => {
    if (uiMode === 'preset') {
      // Only switch to preset mode if there are actual suggested values
      const firstValue = suggestedValues?.[0]?.value
      if (firstValue === undefined) {
        // No preset values available, stay in custom mode or don't change
        return
      }
      onChange({
        ...config,
        valueConfig: {
          valueMode: 'suggested',
          suggestedValue: firstValue,
        },
      })
    } else {
      // Convert current value to custom string
      const currentValue =
        config.valueConfig.valueMode === 'suggested'
          ? String(config.valueConfig.suggestedValue)
          : config.valueConfig.rawValue
      onChange({
        ...config,
        valueConfig: {
          valueMode: 'raw',
          rawValue: currentValue,
        },
      })
    }
  }

  const handleRawValueChange = (rawValue: string): void => {
    onChange({
      ...config,
      valueConfig: {
        valueMode: 'raw',
        rawValue,
      },
    })
  }

  const currentMode = config.valueConfig.valueMode

  return (
    <div className="space-y-3">
      <Tabs
        value={currentMode === 'raw' ? 'custom' : 'preset'}
        onValueChange={(v) => handleModeChange(v as 'preset' | 'custom')}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger
            value="preset"
            disabled={!suggestedValues || suggestedValues.length === 0}
            title={
              !suggestedValues || suggestedValues.length === 0
                ? 'No preset values available for this option'
                : undefined
            }
          >
            Preset
          </TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Mode explanation text */}
      <p className="text-xs text-muted-foreground">
        {currentMode === 'suggested'
          ? 'Preset: Choose from common preset values'
          : 'Custom: Enter any value manually'}
      </p>

      {currentMode === 'suggested' && suggestedValues && (
        <>
          <SuggestedValueSelect
            valueConfig={config.valueConfig}
            suggestedValues={suggestedValues}
            onChange={(newConfig) =>
              onChange({ ...config, valueConfig: newConfig })
            }
          />
          {/* Selected Suggested Value Description */}
          {(() => {
            const valueConfig = config.valueConfig
            const selectedEntry =
              valueConfig.valueMode === 'suggested'
                ? suggestedValues.find(
                    (entry) => entry.value === valueConfig.suggestedValue,
                  )
                : undefined
            return selectedEntry ? (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">
                  {selectedEntry.label ?? String(selectedEntry.value)}
                </p>
                <p className="text-muted-foreground mt-1">
                  {selectedEntry.description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Value: {String(selectedEntry.value)}
                </p>
              </div>
            ) : null
          })()}
        </>
      )}

      {currentMode === 'suggested' && !suggestedValues && (
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          <p>
            No preset values available for this option. Switch to Custom mode to
            enter any value manually.
          </p>
        </div>
      )}

      {currentMode === 'raw' && (
        <Input
          value={
            config.valueConfig.valueMode === 'raw'
              ? config.valueConfig.rawValue
              : ''
          }
          onChange={(e) => handleRawValueChange(e.target.value)}
          placeholder="Enter custom value"
        />
      )}
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export function SetOptionForm({
  config,
  onChange,
  isValueConnected = false,
  showFrame = true,
}: SetOptionFormProps): React.JSX.Element {
  const selectedOption = getOptionDefinition(config.optionName)
  const validation = useMemo(
    () => validateSetOptionForm(config, isValueConnected),
    [config, isValueConnected],
  )

  const content = (
    <>
      {/* Option Selection with info icons */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Option</p>
        <Select
          value={config.optionName}
          onValueChange={(optionName: string) => {
            const option = getOptionDefinition(optionName)
            if (!option) {
              onChange({
                ...config,
                optionName,
              })
              return
            }

            // Initialize from option's actual defaultValue
            const suggestedValues = deriveSuggestedValues(option)

            // Get scalar default value (handle array defaults by converting to raw)
            const rawDefault = option.defaultValue
            const defaultValue: string | number | boolean = Array.isArray(
              rawDefault,
            )
              ? rawDefault.join(',')
              : (rawDefault as string | number | boolean)

            // Check if defaultValue matches any suggested value
            const defaultInSuggested = suggestedValues?.find(
              (entry) => entry.value === defaultValue,
            )

            const initialValueConfig =
              defaultInSuggested !== undefined
                ? {
                    valueMode: 'suggested' as const,
                    suggestedValue: defaultValue,
                  }
                : {
                    valueMode: 'raw' as const,
                    rawValue: String(defaultValue),
                  }

            // Determine valid scope based on option metadata
            // Always use global scope as default
            const initialScope: 'global' | 'local' = 'global'

            onChange({
              ...config,
              optionName: option.name,
              scope: initialScope,
              valueConfig: initialValueConfig,
            })
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a setting to configure">
              {config.optionName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80 w-[var(--radix-select-trigger-width)]">
            {NEOVIM_OPTIONS_CATALOG.map((option) => (
              <SelectItemWithInfo
                key={option.name}
                value={option.name}
                title={option.name}
                description={option.whatItDoes}
                tooltipContent={
                  <>
                    <p className="font-semibold">{option.name}</p>
                    <p className="text-muted-foreground">{option.whatItDoes}</p>
                  </>
                }
                iconPosition="far-right"
              />
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Option Description */}
      {selectedOption && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">{selectedOption.name}</p>
          <p className="text-muted-foreground mt-1">
            {selectedOption.whatItDoes}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Type: {selectedOption.valueType}
          </p>
        </div>
      )}

      {/* Scope Selection */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Scope</p>
        <Select
          value={config.scope}
          onValueChange={(scope: 'global' | 'local') =>
            onChange({ ...config, scope })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">global</SelectItem>
            <SelectItem value="local">local</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Value Section - Connection Aware */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Value</p>
        <ValueSection
          config={config}
          isConnected={isValueConnected}
          onChange={onChange}
        />
      </div>
    </>
  )

  if (!showFrame) {
    return <TooltipProvider>{content}</TooltipProvider>
  }

  return (
    <TooltipProvider>
      <ActionEditorFrame
        title="Set Option"
        description="Set a curated Neovim option with type-safe value checks."
        errors={validation.errors}
        warnings={validation.warnings}
      >
        {content}
      </ActionEditorFrame>
    </TooltipProvider>
  )
}
