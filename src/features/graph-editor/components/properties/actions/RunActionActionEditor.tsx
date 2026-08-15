import { RunActionForm } from '@/shared/components/action-forms'
import type { RunActionActionConfig } from '@/shared/types'
import { isCatalogActionEntry } from '@/shared/types/catalog'
import { useCatalog } from '../../../hooks/useCatalog'

interface RunActionActionEditorProps {
  config: RunActionActionConfig
  onChange: (config: RunActionActionConfig) => void
}

export function RunActionActionEditor({
  config,
  onChange,
}: RunActionActionEditorProps): React.JSX.Element {
  const catalog = useCatalog().filter(isCatalogActionEntry)
  return (
    <RunActionForm
      config={{
        mode: config.mode,
        actionType: config.actionType,
        action: config.action,
        selectedActionKey: config.selectedActionKey,
        paramValues: config.paramValues ?? {},
      }}
      catalog={catalog}
      onChange={(newConfig) =>
        onChange({
          ...config,
          ...newConfig,
          actionConfigType: 'run-action',
        })
      }
    />
  )
}
