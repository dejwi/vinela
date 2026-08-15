import { SetOptionForm } from '@/shared/components/action-forms'
import type { SetOptionActionConfig } from '@/shared/types'
import { useIsPortConnected } from '../../../hooks/useIsPortConnected'

interface SetOptionActionEditorProps {
  config: SetOptionActionConfig
  nodeId: string
  onChange: (config: SetOptionActionConfig) => void
}

export function SetOptionActionEditor({
  config,
  nodeId,
  onChange,
}: SetOptionActionEditorProps): React.JSX.Element {
  const isConnected = useIsPortConnected(nodeId, 'value')

  return (
    <SetOptionForm
      config={{
        optionName: config.optionName,
        scope: config.scope,
        valueConfig: config.valueConfig,
      }}
      onChange={(newConfig) =>
        onChange({
          ...config,
          ...newConfig,
          actionConfigType: 'set-option',
        })
      }
      isValueConnected={isConnected}
    />
  )
}
