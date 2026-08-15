import { Switch } from '@/shared/components/ui/switch'
import { Textarea } from '@/shared/components/ui/textarea'
import type { SchemaLuaOption } from '@/shared/types'
import type { LuaInclusionDecision } from '../../utils/lua-field-include'
import type { FieldProps } from './types'

interface LuaFieldProps extends FieldProps<string> {
  option: SchemaLuaOption
  decision: LuaInclusionDecision
  onLuaIncludeChange: (included: boolean) => void
}

export function LuaField({
  option,
  value,
  onChange,
  disabled,
  decision,
  onLuaIncludeChange,
}: LuaFieldProps): React.JSX.Element {
  const isShowingTemplateDefault =
    option.default !== undefined && value === option.default && value !== ''

  const hintText = (() => {
    if (decision.overrideContradiction && decision.reason === 'user-cleared') {
      return 'Field is empty — will be omitted regardless of include toggle.'
    }

    if (
      decision.overrideContradiction &&
      decision.reason === 'explicit-override' &&
      value === undefined
    ) {
      return 'No value or default — will emit nil.'
    }

    if (isShowingTemplateDefault) {
      return 'Showing template default — edit to customize.'
    }

    return undefined
  })()

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={decision.included}
            onCheckedChange={onLuaIncludeChange}
            disabled={disabled}
            size="sm"
            aria-label={`Include "${option.label}" in generated Lua`}
          />
          <span className="text-xs text-muted-foreground">
            {decision.included
              ? 'Included in generated Lua'
              : 'Excluded from generated Lua'}
          </span>
        </div>
      </div>
      {option.expectedReturnType !== undefined && (
        <p className="text-xs text-muted-foreground">
          Expected return type:{' '}
          <code className="font-mono">{option.expectedReturnType}</code>
        </p>
      )}
      <Textarea
        value={value ?? ''}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        placeholder={
          option.inputPlaceholder ?? option.default ?? '-- Lua code here'
        }
        disabled={disabled}
        rows={6}
        className="font-mono text-sm"
      />
      {hintText !== undefined && (
        <p className="text-xs text-muted-foreground">{hintText}</p>
      )}
    </div>
  )
}
