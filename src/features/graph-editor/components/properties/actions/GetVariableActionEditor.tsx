import { ActionEditorFrame } from '@/shared/components/action-editor/ActionEditorFrame'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { SelectItemWithInfo } from '@/shared/components/ui/select-item-with-info'
import { VARIABLE_SCOPE_INFO } from '@/shared/data/neovim'
import type { GetVariableActionConfig } from '@/shared/types'

interface ActionEditorBaseProps {
  nodeId: string
}

interface GetVariableActionEditorProps extends ActionEditorBaseProps {
  config: GetVariableActionConfig
  onChange: (config: GetVariableActionConfig) => void
}

function buildErrors(config: GetVariableActionConfig): string[] {
  const errors: string[] = []
  if (config.variableName.trim().length === 0) {
    errors.push('Variable name is required.')
  }
  return errors
}

export function GetVariableActionEditor({
  config,
  onChange,
}: GetVariableActionEditorProps): React.JSX.Element {
  const selectedScopeInfo = VARIABLE_SCOPE_INFO.find(
    (info) => info.code === config.scope,
  )

  return (
    <ActionEditorFrame
      title="Get Variable"
      description="Read the value of a scoped Vim variable and output it."
      errors={buildErrors(config)}
    >
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Scope</p>
        <Select
          value={config.scope}
          onValueChange={(scope: GetVariableActionConfig['scope']) =>
            onChange({ ...config, scope })
          }
        >
          <SelectTrigger>
            <SelectValue>
              {selectedScopeInfo
                ? `${selectedScopeInfo.label} (${selectedScopeInfo.shortLabel})`
                : undefined}
            </SelectValue>
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
          placeholder="my_setting"
        />
      </div>
    </ActionEditorFrame>
  )
}
