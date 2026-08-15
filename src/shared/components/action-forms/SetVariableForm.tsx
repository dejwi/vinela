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
import { Textarea } from '@/shared/components/ui/textarea'
import {
  VARIABLE_SCOPE_INFO,
  VARIABLE_VALUE_TYPE_INFO,
} from '@/shared/data/neovim'
import type {
  SetVariableFormProps,
  SetVariableFormValidationResult,
} from './types'

// ============================================
// Validation Functions
// ============================================

function createDefaultValue(
  valueType: SetVariableFormProps['config']['valueType'],
): string | number | boolean {
  switch (valueType) {
    case 'boolean':
      return false
    case 'number':
      return 0
    case 'string':
    case 'raw':
      return ''
  }
}

export function validateSetVariableForm(
  config: SetVariableFormProps['config'],
  isValueConnected = false,
): SetVariableFormValidationResult {
  const errors: string[] = []
  if (config.variableName.trim().length === 0) {
    errors.push('Variable name is required.')
  }

  // Skip type validation when value comes from connected port
  if (!isValueConnected) {
    if (config.valueType === 'boolean' && typeof config.value !== 'boolean') {
      errors.push('Boolean value type requires true/false value.')
    }
    if (config.valueType === 'number' && typeof config.value !== 'number') {
      errors.push('Number value type requires numeric value.')
    }
    if (config.valueType === 'string' && typeof config.value !== 'string') {
      errors.push('String value type requires text value.')
    }
  }

  return { errors, warnings: [] }
}

// ============================================
// Main Component
// ============================================

export function SetVariableForm({
  config,
  onChange,
  isValueConnected = false,
  showFrame = true,
}: SetVariableFormProps): React.JSX.Element {
  const validation = validateSetVariableForm(config, isValueConnected)

  const content = (
    <>
      <div
        className={`grid gap-2 ${isValueConnected ? 'grid-cols-1' : 'grid-cols-2'}`}
      >
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Scope</p>
          <Select
            value={config.scope}
            onValueChange={(scope: SetVariableFormProps['config']['scope']) =>
              onChange({ ...config, scope })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIABLE_SCOPE_INFO.map((info) => (
                <SelectItemWithInfo
                  key={info.code}
                  value={info.code}
                  title={`${info.label} (${info.shortLabel})`}
                  description={info.description}
                  tooltipContent={info.description}
                  iconPosition="far-right"
                />
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isValueConnected ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Value Type</p>
            <Select
              value={config.valueType}
              onValueChange={(
                valueType: SetVariableFormProps['config']['valueType'],
              ) =>
                onChange({
                  ...config,
                  valueType,
                  value: createDefaultValue(valueType),
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIABLE_VALUE_TYPE_INFO.map((info) => (
                  <SelectItemWithInfo
                    key={info.type}
                    value={info.type}
                    title={info.label}
                    description={info.description}
                    tooltipContent={info.description}
                    iconPosition="far-right"
                  />
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {isValueConnected ? (
        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <p>
            Value type is inferred from the connected input port. Disconnect the
            port to choose a local type and fallback value.
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Variable Name</p>
        <Input
          value={config.variableName}
          onChange={(event) =>
            onChange({
              ...config,
              variableName: event.target.value,
            })
          }
          placeholder="e.g. my_setting, theme_name"
        />
      </div>

      {isValueConnected ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Value</p>
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <p>Value comes from connected input port.</p>
          </div>
        </div>
      ) : (
        <>
          {config.valueType === 'boolean' ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Value</p>
              <Select
                value={config.value ? 'true' : 'false'}
                onValueChange={(value: string) =>
                  onChange({ ...config, value: value === 'true' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">true</SelectItem>
                  <SelectItem value="false">false</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {config.valueType === 'number' ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Value</p>
              <Input
                type="number"
                value={
                  Number.isFinite(config.value) ? String(config.value) : '0'
                }
                onChange={(event) => {
                  const parsed = Number(event.target.value)
                  onChange({
                    ...config,
                    value: Number.isFinite(parsed) ? parsed : 0,
                  })
                }}
              />
            </div>
          ) : null}

          {config.valueType === 'string' ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Value</p>
              <Input
                value={typeof config.value === 'string' ? config.value : ''}
                onChange={(event) =>
                  onChange({
                    ...config,
                    value: event.target.value,
                  })
                }
              />
            </div>
          ) : null}

          {config.valueType === 'raw' ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Lua Code</p>
              <Textarea
                value={typeof config.value === 'string' ? config.value : ''}
                onChange={(event) =>
                  onChange({
                    ...config,
                    value: event.target.value,
                  })
                }
                placeholder="{1, 2, 3} or vim.fn.expand('%')"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Advanced: Enter raw Lua code for tables, function calls, etc.
              </p>
            </div>
          ) : null}
        </>
      )}
    </>
  )

  if (!showFrame) {
    return content
  }

  return (
    <ActionEditorFrame
      title="Set Variable"
      description="Set a variable in global, buffer, window, tabpage, or vim scope."
      errors={validation.errors}
      warnings={validation.warnings}
    >
      {content}
    </ActionEditorFrame>
  )
}
