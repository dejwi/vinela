import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import type {
  PluginConfigValue,
  SchemaObjectOption,
  SchemaOption,
} from '@/shared/types'
import type { OptionIdentity } from '../../utils/option-identity'
import { SchemaField } from './SchemaField'
import type { FieldProps } from './types'

interface ObjectFieldProps
  extends FieldProps<Record<string, PluginConfigValue>> {
  option: SchemaObjectOption
  /** Current depth to prevent infinite recursion */
  depth?: number
  /** Root-level allValues for visibleWhen checks */
  allValues?: Record<string, PluginConfigValue>
  optionIndex: Map<string, SchemaOption>
  /** Lua field include overrides keyed by option key */
  luaFieldOverrides?: Record<string, boolean> | undefined
  /** Callback for lua include toggle changes */
  onLuaIncludeChange?: ((key: string, included: boolean) => void) | undefined
  /** Prefix for nested option path resolution */
  keyPathPrefix?: string | undefined
  /** Explicit schema ancestor chain for robust option identity */
  ancestors?: readonly SchemaObjectOption[] | undefined
  /** Per-option reset callback invoked when the user confirms reset for any field type. */
  onResetOption?: ((identity: OptionIdentity) => void) | undefined
  headerSlot?: React.ReactNode
}

const MAX_DEPTH = 5

export function ObjectField({
  option,
  value,
  onChange,
  disabled,
  depth = 0,
  allValues,
  optionIndex,
  luaFieldOverrides,
  onLuaIncludeChange,
  keyPathPrefix,
  ancestors = [],
  onResetOption,
  headerSlot,
}: ObjectFieldProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)

  const objValue = value ?? {}

  if (depth >= MAX_DEPTH) {
    return (
      <p className="text-xs text-muted-foreground">
        Maximum nesting depth reached
      </p>
    )
  }

  const handlePropertyChange = (
    key: string,
    propValue: PluginConfigValue,
  ): void => {
    onChange({ ...objValue, [key]: propValue })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {option.label}
        </button>
        {headerSlot}
      </div>
      {!collapsed && (
        <div className={cn('space-y-3 pl-4 border-l border-border')}>
          {option.properties.map((prop: SchemaOption) => (
            <SchemaField
              key={prop.key}
              option={prop}
              value={objValue[prop.key]}
              onChange={handlePropertyChange}
              allValues={allValues ?? objValue}
              optionIndex={optionIndex}
              disabled={disabled}
              depth={depth + 1}
              luaFieldOverrides={luaFieldOverrides}
              onLuaIncludeChange={onLuaIncludeChange}
              keyPathPrefix={keyPathPrefix}
              ancestors={ancestors}
              onResetOption={onResetOption}
            />
          ))}
        </div>
      )}
    </div>
  )
}
