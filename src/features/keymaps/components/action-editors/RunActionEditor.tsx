import { RunActionForm } from '@/shared/components/action-forms'
import type { CatalogActionEntry } from '@/shared/types/catalog'

export interface RunActionEditorProps {
  catalog: readonly CatalogActionEntry[]
  mode: 'catalog' | 'custom-command' | 'custom-keys'
  actionType: 'command' | 'keys'
  action: string
  selectedActionKey: string
  paramValues: Record<string, string>
  onChange: (updates: {
    mode?: 'catalog' | 'custom-command' | 'custom-keys'
    actionType?: 'command' | 'keys'
    action?: string
    selectedActionKey?: string
    paramValues?: Record<string, string>
  }) => void
}

export function RunActionEditor({
  mode,
  actionType,
  action,
  selectedActionKey,
  paramValues,
  onChange,
  catalog,
}: RunActionEditorProps): React.JSX.Element {
  return (
    <RunActionForm
      config={{
        mode,
        actionType,
        action,
        selectedActionKey,
        paramValues,
      }}
      catalog={catalog}
      onChange={(newConfig) => {
        onChange({
          mode: newConfig.mode,
          actionType: newConfig.actionType,
          action: newConfig.action,
          selectedActionKey: newConfig.selectedActionKey,
          paramValues: newConfig.paramValues,
        })
      }}
      showFrame={false}
    />
  )
}
