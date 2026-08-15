import { AlertCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type {
  PluginConfigValue,
  SchemaObjectOption,
  SchemaOption,
  SchemaOptionNotice,
} from '@/shared/types'
import {
  buildOptionIndex,
  isOptionEnabled,
  isOptionVisible,
} from '../../utils/conditions'
import { decideLuaInclusion } from '../../utils/lua-field-include'
import type { OptionIdentity } from '../../utils/option-identity'
import { ArrayField } from './ArrayField'
import { BooleanField } from './BooleanField'
import { ColorField } from './ColorField'
import { KeySequenceField } from './KeySequenceField'
import { LuaField } from './LuaField'
import { MappingTableField } from './MappingTableField'
import { NumberField } from './NumberField'
import { ObjectField } from './ObjectField'
import { PluginKeymapField } from './PluginKeymapField'
import { SelectField } from './SelectField'
import { StringField } from './StringField'
import {
  buildOptionPath,
  buildSchemaFieldResetButton,
  getEffectiveFieldValue,
  getMatchingConfigurationNotices,
} from './schema-field-helpers'

export interface SchemaFieldProps {
  option: SchemaOption
  value: PluginConfigValue | undefined
  onChange: (key: string, value: PluginConfigValue) => void
  disabled?: boolean | undefined
  error?: string | undefined
  /** All current config values (needed for visibleWhen checks) */
  allValues: Record<string, PluginConfigValue>
  optionIndex?: Map<string, SchemaOption> | undefined
  /** Nesting depth for ObjectField recursion control */
  depth?: number | undefined
  /** Lua field include overrides keyed by option key */
  luaFieldOverrides?: Record<string, boolean> | undefined
  /** Callback for lua include toggle changes */
  onLuaIncludeChange?: ((key: string, included: boolean) => void) | undefined
  /** Prefix for nested option path resolution */
  keyPathPrefix?: string | undefined
  /** Explicit schema ancestor chain for robust option identity */
  ancestors?: readonly SchemaObjectOption[] | undefined
  /** Per-option reset callback */
  onResetOption?: ((identity: OptionIdentity) => void) | undefined
}

function toStringValue(
  value: PluginConfigValue | undefined,
): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function toObjectValue(
  value: PluginConfigValue | undefined,
): Record<string, PluginConfigValue> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, PluginConfigValue>
  }
  return undefined
}

function isStringArray(
  value: PluginConfigValue | undefined,
): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}

function renderField(
  option: SchemaOption,
  value: PluginConfigValue | undefined,
  onChange: (value: PluginConfigValue) => void,
  disabled: boolean | undefined,
  depth: number,
  allValues: Record<string, PluginConfigValue>,
  optionIndex: Map<string, SchemaOption>,
  luaFieldOverrides: Record<string, boolean> | undefined,
  onLuaIncludeChange: ((key: string, included: boolean) => void) | undefined,
  keyPathPrefix: string | undefined,
  ancestors: readonly SchemaObjectOption[],
  onResetOption: ((identity: OptionIdentity) => void) | undefined,
  headerSlot: React.ReactNode,
): React.JSX.Element {
  const optionPath = buildOptionPath(keyPathPrefix, option.key)

  switch (option.type) {
    case 'string':
      return (
        <StringField
          option={option}
          value={toStringValue(value)}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'number':
      return (
        <NumberField
          option={option}
          value={typeof value === 'number' ? value : undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'boolean':
      return (
        <BooleanField
          option={option}
          value={typeof value === 'boolean' ? value : undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'select': {
      const resolvedValue = getEffectiveFieldValue(option, value)
      const selectValue =
        option.multi === true
          ? isStringArray(resolvedValue)
            ? resolvedValue
            : []
          : typeof resolvedValue === 'string'
            ? resolvedValue
            : undefined

      return (
        <SelectField
          option={option}
          value={selectValue}
          onChange={(v) => onChange(v)}
          disabled={disabled}
        />
      )
    }
    case 'array':
      return (
        <ArrayField
          option={option}
          value={Array.isArray(value) ? value : undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'mapping-table':
      return (
        <MappingTableField
          option={option}
          value={Array.isArray(value) ? value : undefined}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'object':
      return (
        <ObjectField
          option={option}
          value={toObjectValue(value)}
          onChange={onChange}
          disabled={disabled}
          depth={depth}
          allValues={allValues}
          optionIndex={optionIndex}
          luaFieldOverrides={luaFieldOverrides}
          onLuaIncludeChange={onLuaIncludeChange}
          keyPathPrefix={optionPath}
          ancestors={[...ancestors, option]}
          onResetOption={onResetOption}
          headerSlot={headerSlot}
        />
      )
    case 'color':
      return (
        <ColorField
          option={option}
          value={toStringValue(value)}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'keysequence':
      return (
        <KeySequenceField
          option={option}
          value={toStringValue(value)}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'lua': {
      const explicitOverride = luaFieldOverrides?.[optionPath]
      const decision = decideLuaInclusion(option, value, explicitOverride)

      return (
        <LuaField
          option={option}
          value={toStringValue(value)}
          onChange={onChange}
          disabled={disabled}
          decision={decision}
          onLuaIncludeChange={(included) =>
            onLuaIncludeChange?.(optionPath, included)
          }
        />
      )
    }
    case 'plugin-keymap':
      return (
        <PluginKeymapField
          option={option}
          value={toObjectValue(value)}
          onChange={onChange}
          {...(disabled !== undefined ? { disabled } : {})}
        />
      )
  }
}

function FieldLabel({ option }: { option: SchemaOption }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{option.label}</span>
      {option.required === true && (
        <span className="text-destructive text-xs">*</span>
      )}
    </div>
  )
}

function FieldDescription({
  description,
}: {
  description: string | undefined
}): React.JSX.Element | null {
  if (description === undefined) return null
  return <p className="text-xs text-muted-foreground">{description}</p>
}

function FieldError({
  error,
}: {
  error: string | undefined
}): React.JSX.Element | null {
  if (error === undefined) return null
  return <p className="text-xs text-destructive">{error}</p>
}

function FieldNotices({
  notices,
}: {
  notices: readonly SchemaOptionNotice[]
}): React.JSX.Element | null {
  if (notices.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <div
          key={`${notice.severity}:${notice.message}`}
          className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2 text-sm"
        >
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-foreground">{notice.message}</p>
        </div>
      ))}
    </div>
  )
}

export function SchemaField({
  option,
  value,
  onChange,
  disabled,
  error,
  allValues,
  optionIndex,
  depth = 0,
  luaFieldOverrides,
  onLuaIncludeChange,
  keyPathPrefix,
  ancestors = [],
  onResetOption,
}: SchemaFieldProps): React.JSX.Element | null {
  const effectiveOptionIndex = optionIndex ?? buildOptionIndex([option])

  if (!isOptionVisible(option, allValues, effectiveOptionIndex)) {
    return null
  }

  const optionIsEnabled = isOptionEnabled(
    option,
    allValues,
    effectiveOptionIndex,
  )
  const fieldDisabled = disabled === true || !optionIsEnabled
  const optionPath = buildOptionPath(keyPathPrefix, option.key)
  const matchingConfigurationNotices = getMatchingConfigurationNotices(
    option,
    optionPath,
    allValues,
    getEffectiveFieldValue(option, value),
    fieldDisabled,
  )

  const field = renderField(
    option,
    value,
    (v) => onChange(option.key, v),
    fieldDisabled,
    depth,
    allValues,
    effectiveOptionIndex,
    luaFieldOverrides,
    onLuaIncludeChange,
    keyPathPrefix,
    ancestors,
    onResetOption,
    null,
  )

  const resetButton = buildSchemaFieldResetButton(
    option,
    value,
    optionPath,
    luaFieldOverrides,
    fieldDisabled,
    onResetOption,
    ancestors,
  )

  // For boolean fields, render label inline (beside the toggle)
  if (option.type === 'boolean') {
    return (
      <div
        className={cn(
          'space-y-1',
          !optionIsEnabled && 'opacity-60 pointer-events-none',
        )}
        aria-disabled={optionIsEnabled ? undefined : true}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {field}
            <FieldLabel option={option} />
          </div>
          {resetButton}
        </div>
        <FieldNotices notices={matchingConfigurationNotices} />
        <FieldDescription description={option.description} />
        <FieldError error={error} />
      </div>
    )
  }

  // For object fields, the ObjectField component handles its own label/collapse
  if (option.type === 'object') {
    const objectField = renderField(
      option,
      value,
      (v) => onChange(option.key, v),
      disabled,
      depth,
      allValues,
      effectiveOptionIndex,
      luaFieldOverrides,
      onLuaIncludeChange,
      keyPathPrefix,
      ancestors,
      onResetOption,
      resetButton,
    )

    return (
      <div
        className={cn(
          'space-y-1',
          !optionIsEnabled && 'opacity-60 pointer-events-none',
        )}
        aria-disabled={optionIsEnabled ? undefined : true}
      >
        <FieldNotices notices={matchingConfigurationNotices} />
        <FieldDescription description={option.description} />
        {objectField}
        <FieldError error={error} />
      </div>
    )
  }

  // Standard layout: label above, then field
  return (
    <div
      className={cn(
        'space-y-1.5',
        !optionIsEnabled && 'opacity-60 pointer-events-none',
      )}
      aria-disabled={optionIsEnabled ? undefined : true}
    >
      <div className="flex items-center justify-between gap-2">
        <FieldLabel option={option} />
        {resetButton}
      </div>
      <FieldNotices notices={matchingConfigurationNotices} />
      <FieldDescription description={option.description} />
      {field}
      <FieldError error={error} />
    </div>
  )
}
