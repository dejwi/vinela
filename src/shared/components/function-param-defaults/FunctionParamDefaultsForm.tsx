import { ChevronDown, Code, PlugZap, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { SelectItemWithInfo } from '@/shared/components/ui/select-item-with-info'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import type { RunFunctionDefaultValue } from '@/shared/types'
import {
  deriveInitialOpenGroups,
  effectiveTier,
  formatParamDefaultForInput,
  getDefaultInputMode,
  getParamGroupName,
  getParamInputPlaceholder,
  parseParamDefaultAsText,
  seedMultiselectDefault,
  seedObjectDefault,
} from './param-default-helpers'
import type {
  FunctionParamDefaultsFormProps,
  FunctionParamInfo,
  ParamInputMode,
} from './types'

const RAW_LUA_SENTINEL = '__raw_lua__'
const CLEAR_DEFAULT_SENTINEL = '__vinela_clear_default__'

type AllowedValuesControlSelection =
  | { kind: 'allowed-value'; value: string }
  | { kind: 'raw-lua' }
  | { kind: 'clear-default' }

const ALLOWED_VALUE_PREFIX = '__vinela_allowed_value__:'

function encodeAllowedValueSelectItem(value: string): string {
  return `${ALLOWED_VALUE_PREFIX}${value}`
}

function decodeAllowedValueSelection(
  value: string,
): AllowedValuesControlSelection {
  if (value === RAW_LUA_SENTINEL) {
    return { kind: 'raw-lua' }
  }
  if (value === CLEAR_DEFAULT_SENTINEL) {
    return { kind: 'clear-default' }
  }
  if (value.startsWith(ALLOWED_VALUE_PREFIX)) {
    return {
      kind: 'allowed-value',
      value: value.slice(ALLOWED_VALUE_PREFIX.length),
    }
  }
  // Backward compatibility: treat unknown values as allowed values.
  return { kind: 'allowed-value', value }
}

// ============================================
// AllowedValues Select Sub-Component
// ============================================

interface AllowedValuesSelectProps {
  param: FunctionParamInfo
  currentDefault: RunFunctionDefaultValue | undefined
  disabled: boolean
  onDefaultChange: (value: RunFunctionDefaultValue | null) => void
}

function AllowedValuesSelect({
  param,
  currentDefault,
  disabled,
  onDefaultChange,
}: AllowedValuesSelectProps): React.JSX.Element {
  const allowedValues = param.allowedValues ?? []

  const rawLuaModeFromProps =
    currentDefault?.kind === 'lua' ||
    (currentDefault?.kind === 'scalar' &&
      typeof currentDefault.value === 'string' &&
      !allowedValues.includes(currentDefault.value))

  // Determine initial raw Lua mode: current default is lua kind, or scalar value
  // not in the allowed list (e.g. loaded from old data).
  const [rawLuaMode, setRawLuaMode] = useState(rawLuaModeFromProps)
  const [rawLuaInput, setRawLuaInput] = useState(
    currentDefault?.kind === 'lua' ? currentDefault.lua : '',
  )

  useEffect(() => {
    setRawLuaMode(rawLuaModeFromProps)
    setRawLuaInput(currentDefault?.kind === 'lua' ? currentDefault.lua : '')
  }, [currentDefault, rawLuaModeFromProps])

  if (disabled) {
    return (
      <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-muted/50 opacity-60">
        <PlugZap className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          Value from connection
        </span>
      </div>
    )
  }

  if (rawLuaMode) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={rawLuaInput}
          onChange={(e) => {
            setRawLuaInput(e.target.value)
            if (e.target.value.trim().length === 0) {
              onDefaultChange(null)
            } else {
              onDefaultChange({ kind: 'lua', lua: e.target.value })
            }
          }}
          placeholder="Lua expression"
          className="h-8 text-xs font-mono flex-1 min-w-0 break-all"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={() => {
            setRawLuaMode(false)
            onDefaultChange(null)
          }}
        >
          Use preset
        </Button>
      </div>
    )
  }

  const selectValue =
    currentDefault?.kind === 'scalar' &&
    typeof currentDefault.value === 'string'
      ? encodeAllowedValueSelectItem(currentDefault.value)
      : ''

  return (
    <Select
      value={selectValue}
      onValueChange={(value) => {
        const selection = decodeAllowedValueSelection(value)
        if (selection.kind === 'clear-default') {
          onDefaultChange(null)
          return
        }
        if (selection.kind === 'raw-lua') {
          setRawLuaMode(true)
          setRawLuaInput('')
          onDefaultChange(null)
          return
        }
        onDefaultChange({ kind: 'scalar', value: selection.value })
      }}
    >
      <SelectTrigger className="min-h-8 text-xs">
        <SelectValue placeholder="Select a value..." />
      </SelectTrigger>
      <SelectContent className="max-h-80 w-[var(--radix-select-trigger-width)]">
        {allowedValues.map((av) => {
          const desc = param.allowedValueDescriptions?.[av]
          return desc !== undefined ? (
            <SelectItemWithInfo
              key={av}
              value={encodeAllowedValueSelectItem(av)}
              title={av}
              description={desc}
              tooltipContent={desc}
              iconPosition="far-right"
            />
          ) : (
            <SelectItem key={av} value={encodeAllowedValueSelectItem(av)}>
              {av}
            </SelectItem>
          )
        })}
        <SelectItem
          value={RAW_LUA_SENTINEL}
          className="text-muted-foreground italic"
        >
          Raw Lua expression...
        </SelectItem>
        {currentDefault !== undefined && (
          <SelectItem
            value={CLEAR_DEFAULT_SENTINEL}
            className="text-muted-foreground italic"
          >
            Clear (use function default)
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

// ============================================
// Preview Formatting Helper
// ============================================

/**
 * Format a default value for the live preview line below the input.
 *
 * - Lua mode: show the raw expression verbatim (no quotes)
 * - Text mode, boolean scalar: `true` / `false` (no quotes — they're Lua literals)
 * - Text mode, number scalar: `42` (no quotes)
 * - Text mode, string scalar: `"hello"` (quoted — it will be a Lua string)
 * - Fallback: show textValue quoted
 *
 * Returns null when there is nothing to preview (empty input).
 */
function formatPreviewValue(
  currentDefault: RunFunctionDefaultValue | undefined,
  mode: ParamInputMode,
  textValue: string,
): string | null {
  if (textValue.trim().length === 0) return null
  if (mode === 'lua') return textValue
  if (currentDefault?.kind === 'scalar') {
    const v = currentDefault.value
    if (typeof v === 'boolean') return String(v)
    if (typeof v === 'number') return String(v)
    return `"${String(v)}"`
  }
  return `"${textValue}"`
}

// ============================================
// FreeTextInput Sub-Component (with mode toggle)
// ============================================

interface FreeTextInputProps {
  param: FunctionParamInfo
  currentDefault: RunFunctionDefaultValue | undefined
  onDefaultChange: (value: RunFunctionDefaultValue | null) => void
}

/**
 * Input widget for free-text (non-allowedValues) params.
 *
 * Shows a compact [Text | Lua] mode toggle button next to the input:
 * - **Text mode** (`Abc` / Type icon): value stored as `{ kind: 'scalar' }` — auto-quoted in generation
 * - **Lua mode** (`</>` / Code icon): value stored as `{ kind: 'lua' }` — inserted verbatim
 *
 * A small preview line below the input shows how the value will be interpreted.
 *
 * The toggle is hidden for `string`-typed params (always text) and `void` params (no input).
 */
function FreeTextInput({
  param,
  currentDefault,
  onDefaultChange,
}: FreeTextInputProps): React.JSX.Element {
  // `string` and `void` never need the toggle
  const showToggle = param.type !== 'string' && param.type !== 'void'

  const [mode, setMode] = useState<ParamInputMode>(() =>
    getDefaultInputMode(param.type, currentDefault),
  )

  const [textValue, setTextValue] = useState(() =>
    formatParamDefaultForInput(currentDefault),
  )

  // Sync local state when the external default changes (e.g. function switch)
  useEffect(() => {
    setMode(getDefaultInputMode(param.type, currentDefault))
    setTextValue(formatParamDefaultForInput(currentDefault))
  }, [param.type, currentDefault])

  function handleInputChange(rawValue: string): void {
    setTextValue(rawValue)
    if (rawValue.trim().length === 0) {
      onDefaultChange(null)
      return
    }
    if (mode === 'lua') {
      onDefaultChange({ kind: 'lua', lua: rawValue })
    } else {
      onDefaultChange(parseParamDefaultAsText(param.type, rawValue))
    }
  }

  function handleModeToggle(): void {
    const newMode: ParamInputMode = mode === 'text' ? 'lua' : 'text'
    setMode(newMode)
    // Re-parse the current text under the new mode so the stored value stays in sync
    if (textValue.trim().length > 0) {
      if (newMode === 'lua') {
        onDefaultChange({ kind: 'lua', lua: textValue })
      } else {
        const parsed = parseParamDefaultAsText(param.type, textValue)
        // For boolean params switching to text mode: if the parsed value isn't
        // an actual boolean (e.g. the Lua expression was `vim.g.foo`), clear it —
        // the Select only supports true/false and must not hold a stale string scalar.
        if (
          param.type === 'boolean' &&
          parsed !== null &&
          parsed.kind === 'scalar' &&
          typeof parsed.value !== 'boolean'
        ) {
          onDefaultChange(null)
          setTextValue('')
        } else {
          onDefaultChange(parsed)
        }
      }
    }
  }

  const placeholder = getParamInputPlaceholder(param.type, mode, param.example)
  const isBooleanTextMode = param.type === 'boolean' && mode === 'text'
  const isNumberTextMode = param.type === 'number' && mode === 'text'

  if (isNumberTextMode) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Input
            value={textValue}
            onChange={(e) => {
              const raw = e.target.value
              setTextValue(raw)
              if (raw.trim().length === 0) {
                onDefaultChange(null)
                return
              }
              const asNumber = Number(raw)
              if (Number.isFinite(asNumber)) {
                onDefaultChange({ kind: 'scalar', value: asNumber })
              } else {
                // Store as string — will show validation hint
                onDefaultChange({ kind: 'scalar', value: raw })
              }
            }}
            placeholder={
              param.example !== undefined ? `e.g. ${param.example}` : 'Number'
            }
            className="h-8 text-xs flex-1 min-w-0"
            inputMode="numeric"
          />
          {showToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleModeToggle}
                  type="button"
                  aria-label="Switch number input to Lua expression"
                >
                  <span className="text-xs font-mono font-semibold">N</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[220px] text-center">
                Number mode — enter a numeric value. Click to switch to Lua
                expression.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {/* Preview + validation */}
        {textValue.trim().length > 0 && (
          <p
            className={cn(
              'text-[10px] whitespace-normal break-all pl-1',
              currentDefault?.kind === 'scalar' &&
                typeof currentDefault.value === 'number'
                ? 'text-muted-foreground'
                : 'text-destructive',
            )}
          >
            {currentDefault?.kind === 'scalar' &&
            typeof currentDefault.value === 'number'
              ? `→ ${currentDefault.value}`
              : '⚠ Not a valid number'}
          </p>
        )}
      </div>
    )
  }

  if (isBooleanTextMode) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Select
            value={
              currentDefault?.kind === 'scalar' &&
              typeof currentDefault.value === 'boolean'
                ? String(currentDefault.value)
                : ''
            }
            onValueChange={(value) => {
              if (value === CLEAR_DEFAULT_SENTINEL) {
                onDefaultChange(null)
                setTextValue('')
                return
              }
              const boolVal = value === 'true'
              onDefaultChange({ kind: 'scalar', value: boolVal })
            }}
          >
            <SelectTrigger className="min-h-8 text-xs flex-1">
              <SelectValue placeholder="Select true or false..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">
                <span className="flex items-center gap-1.5">
                  <span>true</span>
                  <span className="text-muted-foreground text-[10px]">
                    — enabled
                  </span>
                </span>
              </SelectItem>
              <SelectItem value="false">
                <span className="flex items-center gap-1.5">
                  <span>false</span>
                  <span className="text-muted-foreground text-[10px]">
                    — disabled
                  </span>
                </span>
              </SelectItem>
              {currentDefault?.kind === 'scalar' &&
                typeof currentDefault.value === 'boolean' && (
                  <SelectItem
                    value={CLEAR_DEFAULT_SENTINEL}
                    className="text-muted-foreground italic"
                  >
                    Clear (use function default)
                  </SelectItem>
                )}
            </SelectContent>
          </Select>
          {/* Toggle button — always shown for boolean params */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleModeToggle}
                type="button"
                aria-label="Switch boolean input to Lua expression"
              >
                <Type className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[220px] text-center">
              Pick true or false from the list. Click to switch to a Lua
              expression instead.
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Preview — only shown when a boolean value is selected */}
        {currentDefault?.kind === 'scalar' &&
          typeof currentDefault.value === 'boolean' && (
            <p className="text-[10px] text-muted-foreground whitespace-normal break-all pl-1">
              {'→ '}
              {String(currentDefault.value)}
            </p>
          )}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <Input
          value={textValue}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'h-8 text-xs flex-1 min-w-0 break-all',
            mode === 'lua' && 'font-mono',
          )}
        />
        {showToggle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleModeToggle}
                type="button"
                aria-label={
                  mode === 'text'
                    ? 'Switch input to Lua expression mode'
                    : 'Switch input to text mode'
                }
              >
                {mode === 'text' ? (
                  <Type className="h-3.5 w-3.5" />
                ) : (
                  <Code className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[220px] text-center">
              {mode === 'text'
                ? 'Text mode — value will be quoted as a string. Click to switch to Lua expression.'
                : 'Lua mode — value is a raw Lua expression. Click to switch to plain text.'}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Live preview — only shown when input is non-empty */}
      {(() => {
        const preview = formatPreviewValue(currentDefault, mode, textValue)
        if (preview === null) return null
        return (
          <p
            className={cn(
              'text-[10px] text-muted-foreground whitespace-normal break-all pl-1',
              mode === 'lua' && 'font-mono',
            )}
          >
            {'→ '}
            {preview}
          </p>
        )
      })()}
    </div>
  )
}

// ============================================
// Single Param Row
// ============================================

interface ParamRowProps {
  param: FunctionParamInfo
  currentDefault: RunFunctionDefaultValue | undefined
  isConnected: boolean
  onDefaultChange: (value: RunFunctionDefaultValue | null) => void
}

function MultiSelectInput({
  param,
  currentDefault,
  disabled,
  onDefaultChange,
}: AllowedValuesSelectProps): React.JSX.Element {
  const selectedValues =
    currentDefault?.kind === 'multiselect' ? currentDefault.values : []
  const allowedValues = param.allowedValues ?? []

  if (disabled) {
    return (
      <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-muted/50 opacity-60">
        <PlugZap className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          Value from connection
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {allowedValues.map((value) => {
          const checked = selectedValues.includes(value)
          return (
            <Button
              key={value}
              size="sm"
              type="button"
              variant={checked ? 'default' : 'outline'}
              className="h-7 text-[11px]"
              onClick={() => {
                const next = checked
                  ? selectedValues.filter((candidate) => candidate !== value)
                  : [...selectedValues, value]
                onDefaultChange(
                  next.length > 0 ? seedMultiselectDefault(next) : null,
                )
              }}
            >
              {value}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function ObjectInput({
  param,
  currentDefault,
  disabled,
  onDefaultChange,
}: AllowedValuesSelectProps): React.JSX.Element {
  const entries =
    currentDefault?.kind === 'object' ? currentDefault.entries : {}
  if (disabled) {
    return (
      <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-muted/50 opacity-60">
        <PlugZap className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">
          Value from connection
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2 border rounded-md p-2">
      {(param.objectShape ?? []).map((child) => {
        const childValue = entries[child.name]
        return (
          <div key={child.name} className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              {child.name}
            </Label>
            <FreeTextInput
              param={child}
              currentDefault={childValue}
              onDefaultChange={(value) => {
                const next = { ...entries }
                if (value === null) {
                  delete next[child.name]
                } else {
                  next[child.name] = value
                }
                onDefaultChange(
                  Object.keys(next).length > 0 ? seedObjectDefault(next) : null,
                )
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

function ParamRow({
  param,
  currentDefault,
  isConnected,
  onDefaultChange,
}: ParamRowProps): React.JSX.Element {
  const required = !param.optional

  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium">{param.name}</Label>
        {param.type !== 'any' && (
          <span className="text-[10px] text-muted-foreground">
            {param.type}
          </span>
        )}
        {required && (
          <span className="text-[10px] text-destructive">required</span>
        )}
      </div>

      {/* Inline description — always visible with line clamp */}
      {param.description !== undefined && (
        <p className="text-[10px] text-muted-foreground leading-relaxed -mt-0.5 line-clamp-2">
          {param.description}
        </p>
      )}

      {/* Input widget */}
      {param.multi === true &&
      param.allowedValues !== undefined &&
      param.allowedValues.length > 0 ? (
        <MultiSelectInput
          param={param}
          currentDefault={currentDefault}
          disabled={isConnected}
          onDefaultChange={onDefaultChange}
        />
      ) : param.objectShape !== undefined && param.objectShape.length > 0 ? (
        <ObjectInput
          param={param}
          currentDefault={currentDefault}
          disabled={isConnected}
          onDefaultChange={onDefaultChange}
        />
      ) : param.allowedValues !== undefined &&
        param.allowedValues.length > 0 ? (
        <AllowedValuesSelect
          param={param}
          currentDefault={currentDefault}
          disabled={isConnected}
          onDefaultChange={onDefaultChange}
        />
      ) : isConnected ? (
        <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-input bg-muted/50 opacity-60">
          <PlugZap className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">
            Value from connection
          </span>
        </div>
      ) : (
        <FreeTextInput
          param={param}
          currentDefault={currentDefault}
          onDefaultChange={onDefaultChange}
        />
      )}
    </div>
  )
}

// ============================================
// Main Form Component
// ============================================

/**
 * Shared form component for editing Run Function parameter defaults.
 * Used by both the graph editor properties panel and the keymaps editor.
 */
export function FunctionParamDefaultsForm({
  selectedFunctionKey,
  params,
  paramDefaults,
  onParamDefaultsChange,
  connectedParams,
}: FunctionParamDefaultsFormProps): React.JSX.Element | null {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const initializedKeyRef = useRef<string | null>(null)
  const hasParams = params.length > 0

  const grouped = useMemo(() => {
    const nextGrouped: Record<string, FunctionParamInfo[]> = {}
    for (const param of params) {
      const isConnected = connectedParams?.[param.name] === true
      const tier = effectiveTier(param, paramDefaults[param.name], isConnected)
      if (tier === 'advanced' && !showAdvanced) continue
      const groupName = getParamGroupName(param)
      nextGrouped[groupName] ??= []
      nextGrouped[groupName].push(param)
    }
    return nextGrouped
  }, [params, paramDefaults, connectedParams, showAdvanced])

  const groupEntries = useMemo(() => Object.entries(grouped), [grouped])

  useEffect(() => {
    if (initializedKeyRef.current !== selectedFunctionKey) {
      initializedKeyRef.current = null
      setOpenGroups({})
    }
  }, [selectedFunctionKey])

  // biome-ignore lint/correctness/useExhaustiveDependencies: key changes reset group state; first parameter availability initializes once without later mutable-input resets
  useEffect(() => {
    if (!hasParams) {
      return
    }
    if (initializedKeyRef.current === selectedFunctionKey) {
      return
    }
    setOpenGroups(
      deriveInitialOpenGroups(groupEntries, paramDefaults, connectedParams),
    )
    initializedKeyRef.current = selectedFunctionKey
  }, [selectedFunctionKey, hasParams])

  if (!hasParams) {
    return null
  }

  function handleDefaultChange(
    paramName: string,
    value: RunFunctionDefaultValue | null,
  ): void {
    const nextDefaults = { ...paramDefaults }
    if (value === null) {
      delete nextDefaults[paramName]
    } else {
      nextDefaults[paramName] = value
    }
    onParamDefaultsChange(nextDefaults)
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          {showAdvanced
            ? 'Hide advanced parameters'
            : 'Show advanced parameters'}
        </Button>
        {groupEntries.map(([groupName, groupParams]) => (
          <Collapsible
            key={groupName}
            open={openGroups[groupName] ?? groupName === 'General'}
            onOpenChange={(open) =>
              setOpenGroups((current) => ({ ...current, [groupName]: open }))
            }
          >
            <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  !(openGroups[groupName] ?? groupName === 'General') &&
                    '-rotate-90',
                )}
              />
              {groupName}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {groupParams.map((param) => (
                <ParamRow
                  key={`${selectedFunctionKey}:${param.name}`}
                  param={param}
                  currentDefault={paramDefaults[param.name]}
                  isConnected={connectedParams?.[param.name] === true}
                  onDefaultChange={(value) =>
                    handleDefaultChange(param.name, value)
                  }
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </TooltipProvider>
  )
}
