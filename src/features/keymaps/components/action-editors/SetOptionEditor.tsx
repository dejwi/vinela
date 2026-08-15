import { SetOptionForm } from '@/shared/components/action-forms'
import type { SetOptionValueConfig } from '@/shared/types'

interface SetOptionEditorProps {
  optionName: string
  scope: 'global' | 'local'
  valueConfig: SetOptionValueConfig
  onChange: (updates: {
    optionName?: string
    scope?: 'global' | 'local'
    valueConfig?: SetOptionValueConfig
  }) => void
}

export function SetOptionEditor({
  optionName,
  scope,
  valueConfig,
  onChange,
}: SetOptionEditorProps): React.JSX.Element {
  return (
    <SetOptionForm
      config={{
        optionName,
        scope,
        valueConfig,
      }}
      onChange={(newConfig) => {
        onChange({
          optionName: newConfig.optionName,
          scope: newConfig.scope,
          valueConfig: newConfig.valueConfig,
        })
      }}
      showFrame={false}
    />
  )
}
