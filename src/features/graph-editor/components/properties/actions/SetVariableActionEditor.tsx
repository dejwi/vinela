import { SetVariableForm } from '@/shared/components/action-forms'
import type { SetVariableActionConfig } from '@/shared/types'
import { useIsPortConnected } from '../../../hooks/useIsPortConnected'

interface SetVariableActionEditorProps {
  config: SetVariableActionConfig
  nodeId: string
  onChange: (config: SetVariableActionConfig) => void
}

export function SetVariableActionEditor({
  config,
  nodeId,
  onChange,
}: SetVariableActionEditorProps): React.JSX.Element {
  const isValueConnected = useIsPortConnected(nodeId, 'value')

  return (
    <SetVariableForm
      config={{
        scope: config.scope,
        variableName: config.variableName,
        valueType: config.valueType,
        value: config.value,
      }}
      onChange={(newConfig) =>
        onChange({
          ...config,
          ...newConfig,
          actionConfigType: 'set-variable',
        })
      }
      isValueConnected={isValueConnected}
    />
  )
}
