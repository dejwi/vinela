import { AlertCircle, Package } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { validateConfig } from '@/shared/lib/schema-validation'
import type { PluginConfigValue, SchemaOption } from '@/shared/types'
import { buildGroupTree, groupOptionsByGroup } from '../../format-utils'
import {
  buildOptionIndex,
  isOptionVisible,
  resolveConditionValue,
} from '../../utils/conditions'
import {
  forEachDescendantLuaKey,
  getDefaultResetValue,
} from '../../utils/option-default'
import {
  identityToOverrideKey,
  type OptionIdentity,
  writeIdentityValue,
} from '../../utils/option-identity'
import { seedWithLuaDefaults } from '../../utils/seed-defaults'
import {
  isSchemalessPlugin,
  type ValidPluginDisplayInfo,
} from '../PluginGridCard'
import { SchemaField } from '../schema-fields'

// ============================================
// Props
// ============================================

interface ConfigPanelProps {
  displayInfo: ValidPluginDisplayInfo
  values: Record<string, PluginConfigValue>
  onValuesChange: (next: Record<string, PluginConfigValue>) => void
  /** Currently selected config group from sidebar (undefined = show all) */
  activeGroup?: string | undefined
  /** Navigate to a sub-group from synthetic parent placeholder */
  onNavigateGroup?: ((group: string) => void) | undefined
  onConfigChange: (config: Record<string, PluginConfigValue>) => void
  onDirtyChange: (isDirty: boolean) => void
  /** External save trigger — when this increments, save is attempted */
  saveTrigger?: number | undefined
  /** External reset trigger — when this increments, values are reset */
  resetTrigger?: number | undefined
  /** Lua field include overrides keyed by option key */
  luaFieldOverrides?: Record<string, boolean> | undefined
  /** Callback when lua include toggle changes */
  onLuaIncludeChange?: ((key: string, included: boolean) => void) | undefined
  /** Callback when lua include override should be cleared */
  onLuaIncludeClear?: ((key: string) => void) | undefined
  /** Callback when all config + include overrides should reset */
  onResetAll?: ((schemaId: string) => void) | undefined
}

interface SectionGate {
  key: string
  expected: string | number | boolean
}

function detectSectionGate(
  options: readonly SchemaOption[],
  values: Record<string, PluginConfigValue>,
  optionIndex: Map<string, SchemaOption>,
): SectionGate | null {
  if (options.length === 0) return null
  const first = options[0]?.enabledWhen
  if (first === undefined) return null
  const allShare = options.every(
    (option) =>
      option.enabledWhen?.key === first.key &&
      option.enabledWhen.equals === first.equals,
  )
  if (!allShare) return null

  const resolved = resolveConditionValue(first.key, values, optionIndex)
  if (resolved.source !== 'absent' && resolved.value === first.equals) {
    return null
  }

  return { key: first.key, expected: first.equals }
}

function toParentLabel(conditionKey: string): string {
  const segment = conditionKey.split('.')[0] ?? conditionKey
  return segment.slice(0, 1).toUpperCase() + segment.slice(1)
}

// ============================================
// Helpers
// ============================================
export { seedWithLuaDefaults } from '../../utils/seed-defaults'

// ============================================
// Schema-less empty state
// ============================================

function SchemalessEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-base font-semibold mb-2">
        No configuration available
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
        This plugin was added without a schema file. Configuration options are
        not available.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mt-2">
        If the plugin author adds a{' '}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">
          vinela.schema.json
        </code>{' '}
        file to their repository, you can re-import it to get configuration
        support.
      </p>
    </div>
  )
}

// ============================================
// No options empty state
// ============================================

function NoOptionsEmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="text-base font-semibold mb-2">No configuration options</h3>
      <p className="text-sm text-muted-foreground">
        This plugin has no configurable options.
      </p>
    </div>
  )
}

// ============================================
// Main component
// ============================================

export function ConfigPanel({
  displayInfo,
  values,
  onValuesChange,
  activeGroup,
  onNavigateGroup,
  onConfigChange,
  onDirtyChange,
  saveTrigger,
  resetTrigger,
  luaFieldOverrides,
  onLuaIncludeChange,
  onLuaIncludeClear,
  onResetAll,
}: ConfigPanelProps): React.JSX.Element {
  const { schema } = displayInfo
  const isInstalled = displayInfo.status === 'installed'
  const currentConfig = isInstalled ? displayInfo.installed.config : {}
  const seededCurrentConfig = useMemo(
    () => seedWithLuaDefaults(currentConfig, schema.options),
    [currentConfig, schema.options],
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Track previous displayInfo to detect plugin changes
  const prevDisplayInfoRef = useRef(displayInfo)

  // Sync when the plugin changes (different schema ID)
  useEffect(() => {
    if (
      prevDisplayInfoRef.current.schema.id !== displayInfo.schema.id ||
      prevDisplayInfoRef.current.status !== displayInfo.status
    ) {
      setErrors({})
    }
    prevDisplayInfoRef.current = displayInfo
  }, [displayInfo])

  const isDirty = JSON.stringify(values) !== JSON.stringify(seededCurrentConfig)

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  const handleChange = useCallback(
    (key: string, value: PluginConfigValue): void => {
      onValuesChange({ ...values, [key]: value })
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [onValuesChange, values],
  )

  const handleSave = useCallback((): void => {
    const result = validateConfig(values, schema)
    if (!result.valid) {
      const fieldErrors: Record<string, string> = {}
      for (const err of result.errors) {
        if (err.source !== undefined) {
          fieldErrors[err.source] = err.message
        }
      }
      setErrors(fieldErrors)
      return
    }
    // Persist values as-is. For lua fields, storing a value equal to
    // option.default is intentional; generator inclusion semantics are handled
    // by decideLuaInclusion()/luaFieldOverrides.
    onConfigChange(values)
  }, [values, schema, onConfigChange])

  const applyReset = useCallback(
    (persistReset: boolean): void => {
      const baseline = seedWithLuaDefaults({}, schema.options)
      onValuesChange(baseline)
      setErrors({})
      if (persistReset) {
        onResetAll?.(schema.id)
      }
    },
    [onResetAll, schema.id, schema.options, onValuesChange],
  )

  const handleReset = useCallback((): void => {
    applyReset(false)
  }, [applyReset])

  const handlePersistedReset = useCallback((): void => {
    applyReset(true)
  }, [applyReset])

  const handleResetOption = useCallback(
    (identity: OptionIdentity): void => {
      const resetValue = getDefaultResetValue(identity.option)

      onValuesChange(writeIdentityValue(identity, values, resetValue))

      const overrideKey = identityToOverrideKey(identity)

      if (identity.option.type === 'lua') {
        onLuaIncludeClear?.(overrideKey)
      } else if (identity.option.type === 'object') {
        forEachDescendantLuaKey(identity, (descendantKey) => {
          onLuaIncludeClear?.(descendantKey)
        })
      }

      setErrors((prev) => {
        const next = { ...prev }
        delete next[overrideKey]
        delete next[identity.option.key]
        if (identity.option.type === 'object') {
          const prefix = `${overrideKey}.`
          for (const key of Object.keys(next)) {
            if (key.startsWith(prefix)) {
              delete next[key]
            }
          }
        }
        return next
      })
    },
    [onLuaIncludeClear, onValuesChange, values],
  )

  // Handle external save trigger
  const prevSaveTriggerRef = useRef(saveTrigger ?? 0)
  useEffect(() => {
    const current = saveTrigger ?? 0
    if (current > prevSaveTriggerRef.current) {
      handleSave()
    }
    prevSaveTriggerRef.current = current
  }, [saveTrigger, handleSave])

  // Handle external reset trigger
  const prevResetTriggerRef = useRef(resetTrigger ?? 0)
  useEffect(() => {
    const current = resetTrigger ?? 0
    if (current > prevResetTriggerRef.current) {
      handlePersistedReset()
    }
    prevResetTriggerRef.current = current
  }, [resetTrigger, handlePersistedReset])

  const optionIndex = useMemo(
    () => buildOptionIndex(schema.options),
    [schema.options],
  )
  const groupTree = useMemo(
    () => buildGroupTree(schema.options),
    [schema.options],
  )

  // Schema-less plugin (no options, functions, or commands)
  if (isSchemalessPlugin(schema)) {
    return <SchemalessEmptyState />
  }

  // No options
  if (schema.options.length === 0) {
    return <NoOptionsEmptyState />
  }

  // Group options
  const groups = groupOptionsByGroup(schema.options)
  const groupNames = Array.from(groups.keys())

  // Determine which options to show
  const optionsToShow =
    activeGroup !== undefined ? (groups.get(activeGroup) ?? []) : schema.options

  const groupsToRender: Array<{
    name: string
    options: typeof optionsToShow
  }> =
    activeGroup !== undefined
      ? [{ name: activeGroup, options: optionsToShow }]
      : groupNames.map((name) => ({
          name,
          options: groups.get(name) ?? [],
        }))

  const showGroupHeaders = activeGroup === undefined && groupNames.length > 1

  const activeGroupNode =
    activeGroup === undefined
      ? undefined
      : groupTree.find((node) => node.id === activeGroup)

  if (
    activeGroup !== undefined &&
    activeGroupNode !== undefined &&
    !activeGroupNode.hasOwnOptions
  ) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {activeGroup}
        </h4>
        <p className="text-sm text-muted-foreground">Pick a sub-section:</p>
        <div className="flex flex-wrap gap-2">
          {activeGroupNode.children.map((child) => (
            <Button
              key={child.id}
              size="sm"
              variant="outline"
              onClick={() => onNavigateGroup?.(child.id)}
              disabled={onNavigateGroup === undefined}
            >
              {child.label}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Read-only notice for available plugins */}
      {!isInstalled && (
        <div className="p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
          Install this plugin to configure it. Showing default values.
        </div>
      )}

      {/* Dirty indicator */}
      {isDirty && isInstalled && (
        <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20">
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button size="sm" className="h-6 text-xs" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Option groups */}
      {groupsToRender.map(({ name, options }, idx) => (
        <div key={name}>
          {showGroupHeaders && (
            <>
              {idx > 0 && <Separator className="my-4" />}
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                {name}
              </h4>
            </>
          )}
          <div className="space-y-4">
            {(() => {
              const gate = detectSectionGate(options, values, optionIndex)
              if (gate === null) return null
              const parentLabel = toParentLabel(gate.key)
              return (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 mb-3 flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {parentLabel} is disabled
                    </p>
                    <p className="text-muted-foreground">
                      These settings are inactive until you enable {parentLabel}{' '}
                      in the General section.
                    </p>
                  </div>
                  {isInstalled && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleChange(gate.key, gate.expected)}
                    >
                      Enable {parentLabel}
                    </Button>
                  )}
                </div>
              )
            })()}
            {options.map(
              (option) =>
                isOptionVisible(option, values, optionIndex) && (
                  <SchemaField
                    key={option.key}
                    option={option}
                    value={values[option.key]}
                    onChange={handleChange}
                    error={errors[option.key]}
                    allValues={values}
                    optionIndex={optionIndex}
                    disabled={!isInstalled}
                    luaFieldOverrides={luaFieldOverrides}
                    onLuaIncludeChange={onLuaIncludeChange}
                    onResetOption={handleResetOption}
                  />
                ),
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
