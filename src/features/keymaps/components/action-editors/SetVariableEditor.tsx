import { SetVariableForm } from '@/shared/components/action-forms'
import type { ActionScalarValue } from '@/shared/types'

interface SetVariableEditorProps {
  scope: 'g' | 'b' | 'w' | 't' | 'v'
  variableName: string
  valueType: 'string' | 'number' | 'boolean' | 'raw'
  value: ActionScalarValue
  onChange: (updates: {
    scope?: 'g' | 'b' | 'w' | 't' | 'v'
    variableName?: string
    valueType?: 'string' | 'number' | 'boolean' | 'raw'
    value?: ActionScalarValue
  }) => void
}

export function SetVariableEditor({
  scope,
  variableName,
  valueType,
  value,
  onChange,
}: SetVariableEditorProps): React.JSX.Element {
  return (
    <SetVariableForm
      config={{
        scope,
        variableName,
        valueType,
        value,
      }}
      onChange={(newConfig) => {
        onChange({
          scope: newConfig.scope,
          variableName: newConfig.variableName,
          valueType: newConfig.valueType,
          value: newConfig.value,
        })
      }}
      showFrame={false}
    />
  )
}
